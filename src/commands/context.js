const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  readIdentity,
  readSkills,
  parseMarkdownField,
} = require('./shared');

// parseSkills splits a comma-separated skills string into an array.
function parseSkills(skillsStr) {
  if (!skillsStr || typeof skillsStr !== 'string') return [];
  return skillsStr.split(',').map(s => s.trim()).filter(Boolean);
}

// readSkillLayers reads the skills.json and returns the three layers
// filtered by the current workflow and task triggers.
function readSkillLayers(skillsData, taskTriggers, workflow = 'all') {
  const triggerSet = new Set(taskTriggers.map(t => t.toLowerCase()));
  const workflowNorm = String(workflow || 'all').toLowerCase().trim();

  const alwaysOn = [];
  const projectLocal = [];
  const userLocal = [];

  for (const r of skillsData.skills || []) {
    const skill = String(r.skill || '').trim();
    if (!skill) continue;
    const layer = String(r.layer || '').trim().toLowerCase();
    const wfOrTrigger = String(r.workflowTrigger || r['workflow/trigger'] || '').trim().toLowerCase();

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

// readProjectLanguage reads identity.json and returns the primary language.
function readProjectLanguage(identity) {
  return identity.primaryLanguage || identity.stack || 'any';
}

// readSkillMatrix reads the skill matrix from skills.json.
function readSkillMatrix(skillsData, language = 'any') {
  const matrix = {};
  const langNorm = String(language || 'any').toLowerCase().trim();
  for (const r of skillsData.matrix || []) {
    const trigger = (r.trigger || '').trim();
    if (!trigger) continue;
    const rowLang = String(r.language || 'any').toLowerCase().trim();
    if (rowLang !== 'any' && rowLang !== langNorm) continue;
    matrix[trigger] = {
      primary: parseSkills(r.primarySkills || r['primary skills'] || ''),
      secondary: parseSkills(r.secondarySkills || r['secondary skills'] || ''),
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

// findRow finds a row by ID in an array.
function findRow(rows, id) {
  return rows.find(r => r.id === id || r.id === id.toUpperCase()) || null;
}

// findChildren finds rows whose parent matches a given ID.
function findChildren(rows, parentId) {
  return rows.filter(r => {
    const parent = String(r.parent || r.dependencies || '').trim().toUpperCase();
    return parent === parentId.toUpperCase();
  });
}

// readMarkdown reads a companion markdown file for a spec/plan/task.
function readMarkdown(aiDir, id) {
  const type = id.toUpperCase().startsWith('SPEC-') ? 'specs'
    : id.toUpperCase().startsWith('PLAN-') ? 'plans'
    : id.toUpperCase().startsWith('TASK-') ? 'tasks'
    : null;
  if (!type) return { body: '', testing: '', criteria: '' };

  const filePath = path.join(aiDir, type, `${id.toUpperCase()}.md`);
  if (!fs.existsSync(filePath)) return { body: '', testing: '', criteria: '' };

  const content = fs.readFileSync(filePath, 'utf8');

  function section(name) {
    const pattern = new RegExp(`##\\s+${name}[\\r\\n]+([\\s\\S]*?)(?=##\\s|$)`, 'i');
    const m = content.match(pattern);
    return m ? m[1].trim() : '';
  }

  return {
    body: content.trim(),
    testing: section('Testing'),
    criteria: section('Completion Criteria') || section('Acceptance Criteria') || section('Success Criteria'),
  };
}

// collectSkills gathers skills from all applicable levels for a target.
function collectSkills(row, matrix) {
  const skills = new Set();
  for (const s of parseSkills(row.skills)) skills.add(s);
  for (const s of collectMatrixSkills(matrix, row.triggers)) skills.add(s);
  return [...skills];
}

// buildPacket constructs a minimal context packet for a spec/plan/task.
async function buildPacket(aiDir, targetId, options = {}) {
  const specs = readSpecs(aiDir);
  const plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);

  // Merge task MD metadata with JSONL state (JSONL wins for status)
  const tasks = taskFiles.map(tf => {
    const state = taskStates.get(tf.id);
    return state ? { ...tf, status: state.status } : tf;
  });

  const identity = readIdentity(aiDir);
  const skillsData = readSkills(aiDir);

  // Graph nodes/edges
  const graphNodesDir = path.join(aiDir, 'graph', 'nodes');
  const graphEdgesDir = path.join(aiDir, 'graph', 'edges');
  let modules = [];
  let components = [];
  try {
    if (fs.existsSync(graphNodesDir)) {
      modules = fs.readdirSync(graphNodesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const node = JSON.parse(fs.readFileSync(path.join(graphNodesDir, f), 'utf8'));
          return { module: node.id || '', path: node.path || '', purpose: node.type || '' };
        });
    }
  } catch (e) {}

  let type, row, parent, children, grandparent;

  if (targetId.toUpperCase().startsWith('SPEC-')) {
    type = 'spec';
    row = findRow(specs, targetId);
    if (!row) throw new Error(`Spec ${targetId} not found`);
    children = findChildren(plans, targetId);
  } else if (targetId.toUpperCase().startsWith('PLAN-')) {
    type = 'plan';
    row = findRow(plans, targetId);
    if (!row) throw new Error(`Plan ${targetId} not found`);
    parent = findRow(specs, row.parent || row.dependencies || '');
    children = findChildren(tasks, targetId);
  } else if (targetId.toUpperCase().startsWith('TASK-')) {
    type = 'task';
    row = findRow(tasks, targetId);
    if (!row) throw new Error(`Task ${targetId} not found`);
    parent = findRow(plans, row.parent || row.dependencies || '');
    if (parent) {
      grandparent = findRow(specs, parent.parent || parent.dependencies || '');
    }
  } else {
    throw new Error(`Unknown ID format: ${targetId}. Expected SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
  }

  const projectLanguage = readProjectLanguage(identity);
  const taskTriggers = parseSkills(row.triggers || '');
  const workflow = options.workflow || 'all';
  const skillLayers = readSkillLayers(skillsData, taskTriggers, workflow);
  const skillMatrix = readSkillMatrix(skillsData, projectLanguage);

  const { alwaysOn, projectLocal, userLocal } = skillLayers;

  const targetSkills = collectSkills(row, skillMatrix);
  const parentSkills = parent ? collectSkills(parent, skillMatrix) : [];
  const grandparentSkills = grandparent ? collectSkills(grandparent, skillMatrix) : [];
  const matrixSkills = collectMatrixSkills(skillMatrix, row.triggers);

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

  const targetMd = readMarkdown(aiDir, row.id);
  const parentMd = parent ? readMarkdown(aiDir, parent.id) : { body: '', testing: '', criteria: '' };
  const grandparentMd = grandparent ? readMarkdown(aiDir, grandparent.id) : { body: '', testing: '', criteria: '' };

  const packet = {
    target: {
      type,
      id: row.id,
      uuid: row.uuid || '',
      title: row.title || '',
      status: row.status || '',
      dependencies: row.dependencies || row.parent || '',
      skills: targetSkills,
      commit: row.commit || '',
      body: targetMd.body,
      testing: targetMd.testing,
      criteria: targetMd.criteria,
    },
    parent: parent ? {
      type: parent.id.startsWith('SPEC-') ? 'spec' : 'plan',
      id: parent.id,
      title: parent.title || '',
      status: parent.status || '',
      skills: parentSkills,
      body: parentMd.body,
      testing: parentMd.testing,
      criteria: parentMd.criteria,
    } : null,
    grandparent: grandparent ? {
      type: 'spec',
      id: grandparent.id,
      title: grandparent.title || '',
      status: grandparent.status || '',
      skills: grandparentSkills,
      body: grandparentMd.body,
      testing: grandparentMd.testing,
      criteria: grandparentMd.criteria,
    } : null,
    children: children ? children.map(c => ({
      id: c.id,
      title: c.title || '',
      status: c.status || '',
    })) : [],
    modules,
    components,
    skillLayers: {
      alwaysOn,
      projectLocal,
      userLocal,
      matrixSkills,
      primarySkills,
      secondarySkills,
    },
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

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  try {
    const packet = await buildPacket(aiDir, targetId, options);
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
