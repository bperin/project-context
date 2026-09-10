const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// readSheet reads a worksheet and returns an array of row objects keyed by
// the sheet's headers (lowercased).
async function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return [];

  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let hasData = false;
    row.eachCell((cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      let val = cell.value;
      if (val && typeof val === 'object' && val.text) val = val.text;
      obj[key.toLowerCase()] = val || '';
      if (val) hasData = true;
    });
    if (hasData) rows.push(obj);
  }
  return rows;
}

// parseSkills splits a comma-separated skills string into an array.
function parseSkills(skillsStr) {
  if (!skillsStr || typeof skillsStr !== 'string') return [];
  return skillsStr.split(',').map(s => s.trim()).filter(Boolean);
}

// readSkillLayers reads the unified Skills sheet and returns the three layers
// filtered by the current workflow and task triggers.
//
// Skills sheet schema:
//   Skill | Path | Layer | Workflow/Trigger | Purpose
//
// Layer values:
//   - always-on     : loaded at session start for the given workflow (or 'all')
//   - project-local : loaded for any task in this project for the given workflow (or 'all')
//   - user-local    : loaded when the task's trigger matches Workflow/Trigger
//
// The workflow argument is the current workflow name (e.g. 'task-implementation',
// 'spec-creation'). If omitted, 'all' is used as the default.
async function readSkillLayers(wb, taskTriggers, workflow = 'all') {
  const rows = await readSheet(wb, 'Skills');
  const triggerSet = new Set(taskTriggers.map(t => t.toLowerCase()));
  const workflowNorm = String(workflow || 'all').toLowerCase().trim();

  const alwaysOn = [];
  const projectLocal = [];
  const userLocal = [];

  for (const r of rows) {
    const skill = String(r.skill || '').trim();
    if (!skill) continue;
    const layer = String(r.layer || '').trim().toLowerCase();
    const wfOrTrigger = String(r['workflow/trigger'] || '').trim().toLowerCase();

    if (layer === 'always-on') {
      if (wfOrTrigger === 'all' || wfOrTrigger === workflowNorm) {
        alwaysOn.push(...parseSkills(skill));
      }
    } else if (layer === 'project-local') {
      if (wfOrTrigger === 'all' || wfOrTrigger === workflowNorm) {
        projectLocal.push(...parseSkills(skill));
      }
    } else if (layer === 'user-local') {
      if (triggerSet.has(wfOrTrigger)) {
        userLocal.push(...parseSkills(skill));
      }
    }
  }

  return { alwaysOn, projectLocal, userLocal };
}

// readProjectLanguage reads the Identity sheet and returns the primary
// language / stack value. Falls back to 'any' if not found.
async function readProjectLanguage(wb) {
  const rows = await readSheet(wb, 'Identity');
  for (const r of rows) {
    const field = String(r.field || '').trim().toLowerCase();
    if (field === 'primary language' || field === 'stack') {
      const value = String(r.value || '').trim();
      if (value) return value;
    }
  }
  return 'any';
}

// readSkillMatrix reads the Skill Matrix sheet and returns a map of
// trigger -> { primary: [...], secondary: [...] }, filtered by language.
// A row is included if its Language column is empty, 'any', or matches
// the project's primary language.
async function readSkillMatrix(wb, language = 'any') {
  const rows = await readSheet(wb, 'Skill Matrix');
  const matrix = {};
  const langNorm = String(language || 'any').toLowerCase().trim();
  for (const r of rows) {
    const trigger = (r.trigger || '').trim();
    if (!trigger) continue;
    const rowLang = String(r.language || 'any').toLowerCase().trim();
    if (rowLang !== 'any' && rowLang !== langNorm) continue;
    matrix[trigger] = {
      primary: parseSkills(r['primary skills'] || r.primaryskills || ''),
      secondary: parseSkills(r['secondary skills'] || r.secondaryskills || ''),
    };
  }
  return matrix;
}

// collectMatrixSkills resolves trigger strings from a row against the matrix.
function collectMatrixSkills(matrix, triggersStr) {
  const skills = [];
  for (const trigger of parseSkills(triggersStr || '')) {
    const entry = matrix[trigger];
    if (entry) {
      skills.push(...entry.primary, ...entry.secondary);
    }
  }
  return skills;
}

// findRow finds a row by ID in a sheet.
function findRow(rows, id) {
  return rows.find(r => r.id === id) || null;
}

// findChildren finds rows that depend on a given ID.
function findChildren(rows, parentId) {
  return rows.filter(r => {
    const deps = String(r.dependencies || '');
    return deps.includes(parentId);
  });
}

// collectSkills gathers skills from all applicable levels for a target.
async function collectSkills(wb, type, row, matrix) {
  const skills = new Set();

  // Target-level: the Skills and Triggers columns on the row itself
  for (const s of parseSkills(row.skills)) skills.add(s);
  for (const s of collectMatrixSkills(matrix, row.triggers)) skills.add(s);

  return [...skills];
}

// buildPacket constructs a minimal context packet for a spec/plan/task.
async function buildPacket(xlsxPath, targetId, options = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const specs = await readSheet(wb, 'Specs');
  const plans = await readSheet(wb, 'Plans');
  const tasks = await readSheet(wb, 'Tasks');
  const modules = await readSheet(wb, 'Modules');
  const components = await readSheet(wb, 'Components');

  // Determine type by ID prefix
  let type, row, parent, children, grandparent;

  if (targetId.startsWith('SPEC-')) {
    type = 'spec';
    row = findRow(specs, targetId);
    if (!row) throw new Error(`Spec ${targetId} not found`);
    children = findChildren(plans, targetId);
  } else if (targetId.startsWith('PLAN-')) {
    type = 'plan';
    row = findRow(plans, targetId);
    if (!row) throw new Error(`Plan ${targetId} not found`);
    // Find parent spec from dependencies
    const depMatch = String(row.dependencies || '').match(/SPEC-\d+/);
    parent = depMatch ? findRow(specs, depMatch[0]) : null;
    children = findChildren(tasks, targetId);
  } else if (targetId.startsWith('TASK-')) {
    type = 'task';
    row = findRow(tasks, targetId);
    if (!row) throw new Error(`Task ${targetId} not found`);
    // Walk the dependency chain to find the parent plan.
    // Tasks may depend on other tasks, which eventually depend on a plan.
    let current = row;
    const visited = new Set([targetId]);
    while (current) {
      const depMatch = String(current.dependencies || '').match(/PLAN-\d+/);
      if (depMatch) {
        parent = findRow(plans, depMatch[0]);
        break;
      }
      // Try to find a task dependency and walk up
      const taskDepMatch = String(current.dependencies || '').match(/TASK-\d+/);
      if (taskDepMatch && !visited.has(taskDepMatch[0])) {
        visited.add(taskDepMatch[0]);
        current = findRow(tasks, taskDepMatch[0]);
      } else {
        break;
      }
    }
    // Find grandparent spec from parent plan's dependencies
    if (parent) {
      const specMatch = String(parent.dependencies || '').match(/SPEC-\d+/);
      grandparent = specMatch ? findRow(specs, specMatch[0]) : null;
    }
  } else {
    throw new Error(`Unknown ID format: ${targetId}. Expected SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
  }

  // Project-level skill layers (filtered by workflow and task triggers)
  const projectLanguage = await readProjectLanguage(wb);
  const taskTriggers = parseSkills(row.triggers || '');
  const workflow = options.workflow || 'all';
  const skillLayers = await readSkillLayers(wb, taskTriggers, workflow);
  const skillMatrix = await readSkillMatrix(wb, projectLanguage);

  const { alwaysOn, projectLocal, userLocal } = skillLayers;

  // Collect applicable skills (async now because collectSkills reads the matrix)
  const targetSkills = await collectSkills(wb, type, row, skillMatrix);
  const parentSkills = parent ? await collectSkills(wb, 'plan', parent, skillMatrix) : [];
  const grandparentSkills = grandparent ? await collectSkills(wb, 'spec', grandparent, skillMatrix) : [];
  const matrixSkills = collectMatrixSkills(skillMatrix, row.triggers);

  // Determine primary and secondary skills from the matrix if available,
  // otherwise fall back to the first target skill as primary and the rest as secondary.
  const triggers = parseSkills(row.triggers || '');
  let primarySkills = [];
  let secondarySkills = [];
  for (const trigger of triggers) {
    const entry = skillMatrix[trigger];
    if (entry) {
      primarySkills.push(...entry.primary);
      secondarySkills.push(...entry.secondary);
    }
  }
  if (primarySkills.length === 0 && targetSkills.length > 0) {
    primarySkills = [targetSkills[0]];
  }
  if (secondarySkills.length === 0 && targetSkills.length > 1) {
    secondarySkills = targetSkills.slice(1);
  }

  // Build the packet — only what's relevant, nothing else
  const packet = {
    target: {
      type,
      id: row.id,
      uuid: row.uuid || '',
      title: row.title || '',
      status: row.status || '',
      progress: row.progress || '',
      dependencies: row.dependencies || '',
      skills: targetSkills,
      commit: row.commit || '',
    },
    parent: parent ? {
      type: parent.id.startsWith('SPEC-') ? 'spec' : 'plan',
      id: parent.id,
      title: parent.title || '',
      status: parent.status || '',
      progress: parent.progress || '',
      skills: parentSkills,
    } : null,
    grandparent: grandparent ? {
      type: 'spec',
      id: grandparent.id,
      title: grandparent.title || '',
      status: grandparent.status || '',
      skills: grandparentSkills,
    } : null,
    children: children ? children.map(c => ({
      id: c.id,
      title: c.title || '',
      status: c.status || '',
    })) : [],
    modules: modules.map(m => ({
      module: m.module || '',
      path: m.path || '',
      purpose: m.purpose || '',
    })),
    components: components.map(c => ({
      component: c.component || '',
      module: c.module || '',
      layer: c.layer || '',
      status: c.status || '',
    })),
    // Skill layers — these tell the orchestrator what to load and when.
    // alwaysOn: loaded at session start for every task in this project.
    // projectLocal: loaded for any task in this project.
    // userLocal: loaded when the trigger condition in the sheet matches.
    // matrixSkills: skills mapped from this task's Triggers via the Skill Matrix.
    // primarySkills / secondarySkills: the implementer's skill lenses.
    skillLayers: {
      alwaysOn,
      projectLocal,
      userLocal,
      matrixSkills,
      primarySkills,
      secondarySkills,
    },
    // All applicable skills (deduplicated, ordered: alwaysOn → projectLocal → userLocal → matrix → target → parent → grandparent)
    allSkills: [...new Set([...alwaysOn, ...projectLocal, ...userLocal, ...matrixSkills, ...targetSkills, ...parentSkills, ...grandparentSkills])],
  };

  return packet;
}

async function contextCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);
  const targetId = options.id;

  if (!targetId) {
    console.error('Usage: project-context context <ID> [-w .ai] [-t .]');
    process.exit(1);
  }

  const xlsxPath = path.join(aiDir, 'overview.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error('overview.xlsx not found. Run init first.');
    process.exit(1);
  }

  try {
    const packet = await buildPacket(xlsxPath, targetId, options);
    const json = JSON.stringify(packet, null, 2);

    if (options.output) {
      const outPath = path.resolve(options.output);
      fs.writeFileSync(outPath, json);
      console.log(`Context packet for ${targetId} written to ${outPath}`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = contextCommand;
