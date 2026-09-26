const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  readSpecs,
  readEpics,
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
      // User-local skills may be selected by a task trigger or by an explicit
      // workflow. Planning methods use the latter so they never leak into a
      // default/task-implementation packet.
      if (triggerSet.has(wfOrTrigger) || wfOrTrigger === workflowNorm) {
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

function stripInstructions(content) {
  return String(content || '').replace(/<instructions>[\s\S]*?<\/instructions>\s*/i, '').trim();
}

function extractSection(content, name) {
  content = stripInstructions(content);
  const heading = new RegExp(`^(#{2,3})\\s+${name}\\s*$`, 'im').exec(content);
  if (!heading) return '';
  const start = heading.index + heading[0].length;
  const nextHeading = new RegExp(`^#{${heading[1].length}}\\s+`, 'gim');
  nextHeading.lastIndex = start;
  const next = nextHeading.exec(content);
  return content.slice(start, next ? next.index : content.length).trim();
}

// readMarkdown reads a companion markdown file for a epic/spec/plan/task.
function readMarkdown(aiDir, id) {
  const type = id.toUpperCase().startsWith('EPIC-') ? 'epics'
    : id.toUpperCase().startsWith('SPEC-') ? 'specs'
    : id.toUpperCase().startsWith('PLAN-') ? 'plans'
    : id.toUpperCase().startsWith('TASK-') ? 'tasks'
    : null;
  if (!type) return { body: '', testing: '', criteria: '', source: null };

  const filePath = path.join(aiDir, type, `${id.toUpperCase()}.md`);
  if (!fs.existsSync(filePath)) return { body: '', testing: '', criteria: '', source: null };

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const content = stripInstructions(rawContent);

  return {
    body: content.trim(),
    testing: extractSection(content, 'Testing') || extractSection(content, 'Tests'),
    criteria: extractSection(content, 'Completion Criteria') || extractSection(content, 'Acceptance Criteria') || extractSection(content, 'Success Criteria'),
    source: {
      path: path.relative(aiDir, filePath).split(path.sep).join('/'),
      sha256: crypto.createHash('sha256').update(rawContent).digest('hex'),
    },
  };
}

function firstSection(content, names) {
  for (const name of names) {
    const section = extractSection(content, name);
    if (section) return section;
  }
  return '';
}

function compactMarkdownContext(markdown) {
  const body = markdown.body || '';
  const boundaries = [
    firstSection(body, ['Architecture and Data Boundaries']),
    firstSection(body, ['API/Data Boundary', 'API and Data Boundary', 'API Boundary']),
    firstSection(body, ['Data Boundary']),
    firstSection(body, ['Constraints']),
  ].filter(Boolean).join('\n\n');

  return {
    goal: firstSection(body, ['Goal', 'Purpose', 'Objective']),
    scope: firstSection(body, ['Scope and Boundaries', 'Scope', 'Required Change', 'Architecture']),
    repositories: firstSection(body, ['Repositories']),
    boundaries,
    acceptanceCriteria: markdown.criteria || firstSection(body, ['Acceptance Criteria', 'Completion Criteria', 'Success Criteria']),
    testing: markdown.testing || firstSection(body, ['Testing', 'Tests']),
    verification: firstSection(body, ['Verification']),
    doNotTouch: firstSection(body, ['Do-Not-Touch', 'Do Not Touch']),
    decisions: firstSection(body, ['Decisions']),
  };
}

function taskContract(row, markdown) {
  const body = markdown.body || '';
  return {
    goal: firstSection(body, ['Goal', 'Purpose', 'Objective']),
    repositories: firstSection(body, ['Repositories']),
    writeSet: firstSection(body, ['Relevant Files', 'Write Set', 'Files']),
    symbols: firstSection(body, ['Relevant Symbols', 'Symbols']),
    requiredChange: firstSection(body, ['Required Change', 'Implementation']),
    dataApiBoundaries: [
      firstSection(body, ['API/Data Boundary', 'API and Data Boundary', 'API Boundary']),
      firstSection(body, ['Data Boundary']),
      firstSection(body, ['Constraints']),
    ].filter(Boolean).join('\n\n'),
    dependencies: row.dependencies || row.parent || '',
    acceptanceCriteria: markdown.criteria || firstSection(body, ['Acceptance Criteria', 'Completion Criteria', 'Success Criteria']),
    tests: firstSection(body, ['Tests', 'Testing']),
    verification: firstSection(body, ['Verification']),
    doNotTouch: firstSection(body, ['Do-Not-Touch', 'Do Not Touch']),
    proofObligations: firstSection(body, ['Proof Obligations']),
    planningGapProtocol: firstSection(body, ['Planning Gap Protocol']),
  };
}

const REQUIRED_TASK_CONTRACT_FIELDS = [
  ['goal', 'goal'],
  ['writeSet', 'write set'],
  ['requiredChange', 'required change'],
  ['acceptanceCriteria', 'acceptance criteria'],
  ['tests', 'tests'],
  ['verification', 'verification'],
];

function validateTaskContract(taskId, contract, source) {
  const missing = REQUIRED_TASK_CONTRACT_FIELDS
    .filter(([key]) => !String(contract[key] || '').trim())
    .map(([, label]) => label);
  if (missing.length > 0) {
    const error = new Error(`Task ${taskId} has incomplete context contract: ${missing.join(', ')}`);
    error.code = 'NEEDS_PLANNING';
    error.missing = missing;
    throw error;
  }
  if (!source || !source.path || !source.sha256) {
    const error = new Error(`Task ${taskId} has no source fingerprint`);
    error.code = 'NEEDS_PLANNING';
    error.missing = ['source fingerprint'];
    throw error;
  }
}

function canonicalSkillReferences(skillsData, selectedSkills) {
  const root = path.resolve(
    skillsData.sharedSkillsRoot
      || skillsData.canonicalSkillsRoot
      || '/Users/brian/.agents/skills',
  );
  const missing = [];
  const references = selectedSkills.map((name) => {
    const skillPath = path.join(root, name);
    if (!fs.existsSync(path.join(skillPath, 'SKILL.md'))) missing.push(name);
    return { name, path: skillPath };
  });

  if (missing.length > 0) {
    throw new Error(`Missing selected canonical skills: ${missing.join(', ')}`);
  }
  return references;
}

// collectSkills gathers skills from all applicable levels for a target.
function collectSkills(row, matrix) {
  const skills = new Set();
  for (const s of parseSkills(row.skills)) skills.add(s);
  for (const s of collectMatrixSkills(matrix, row.triggers)) skills.add(s);
  return [...skills];
}

// parseRepositories extracts repository names from a Markdown body's
// ## Repositories section. Returns an array of repo names (e.g. ['trakt2-api']).
function parseRepositories(body) {
  body = stripInstructions(body);
  if (!body) return [];
  const pattern = /##\s+Repositories[\r\n]+([\s\S]*?)(?=##\s|$)/i;
  const m = body.match(pattern);
  if (!m) return [];
  const repos = [];
  for (const line of m[1].split('\n')) {
    const repoMatch = line.match(/[-*]\s+(?:`([^`]+)`|(\S+))/);
    if (!repoMatch) continue;
    const value = (repoMatch[1] || repoMatch[2]).replace(/[\\/]$/, '');
    const repo = value.startsWith('/') ? path.basename(value) : value.split('/')[0];
    if (repo) repos.push(repo);
  }
  return repos;
}

function parseRelevantFiles(body) {
  const section = extractSection(body, 'Relevant Files') || extractSection(body, 'Write Set') || extractSection(body, 'Files');
  if (!section) return [];
  return [...section.matchAll(/`([^`]+)`/g)]
    .map(match => match[1].replace(/[\\/]$/, ''))
    .filter(value => value && !value.includes(' — '));
}

// buildPacket constructs a minimal context packet for a spec/plan/task.
async function buildPacket(aiDir, targetId, options = {}) {
  const specs = readSpecs(aiDir);
  const epics = readEpics(aiDir);
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

  // Graph nodes/edges — loaded after target resolution so we can filter
  // modules to only those from the target's declared repositories.
  const graphNodesDir = path.join(aiDir, 'graph', 'nodes');
  const graphEdgesDir = path.join(aiDir, 'graph', 'edges');
  let modules = [];
  let components = [];

  let type, row, parent, children;

  if (targetId.toUpperCase().startsWith('EPIC-')) {
    type = 'epic';
    row = findRow(epics, targetId);
    if (!row) throw new Error(`Epic ${targetId} not found`);
    children = findChildren(specs, targetId);
  } else if (targetId.toUpperCase().startsWith('SPEC-')) {
    type = 'spec';
    row = findRow(specs, targetId);
    if (!row) throw new Error(`Spec ${targetId} not found`);
    parent = findRow(epics, row.dependencies || '');
    children = findChildren(plans, targetId);
  } else if (targetId.toUpperCase().startsWith('PLAN-')) {
    type = 'plan';
    row = findRow(plans, targetId);
    if (!row) throw new Error(`Plan ${targetId} not found`);
    parent = findRow(specs, row.parent || row.dependencies || row.source || '');
    children = findChildren(tasks, targetId);
  } else if (targetId.toUpperCase().startsWith('TASK-')) {
    type = 'task';
    row = findRow(tasks, targetId);
    if (!row) throw new Error(`Task ${targetId} not found`);
    parent = findRow(plans, row.parent || row.dependencies || '');
  } else {
    throw new Error(`Unknown ID format: ${targetId}. Expected EPIC-NNN, SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
  }

  const projectLanguage = readProjectLanguage(identity);
  const taskTriggers = parseSkills(row.triggers || '');
  const workflow = options.workflow || 'all';
  const skillLayers = readSkillLayers(skillsData, taskTriggers, workflow);
  const skillMatrix = readSkillMatrix(skillsData, projectLanguage);

  const { alwaysOn, projectLocal, userLocal } = skillLayers;

  const targetSkills = collectSkills(row, skillMatrix);
  const parentSkills = parent ? collectSkills(parent, skillMatrix) : [];
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
  const parentMd = parent ? readMarkdown(aiDir, parent.id) : { body: '', testing: '', criteria: '', source: null };

  // Collect declared repositories from the task and its single planning parent.
  // to filter graph modules to only those repos.
  const declaredRepos = new Set([
    ...parseRepositories(targetMd.body),
    ...parseRepositories(parentMd.body),
  ]);

  try {
    if (fs.existsSync(graphNodesDir)) {
      modules = fs.readdirSync(graphNodesDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const node = JSON.parse(fs.readFileSync(path.join(graphNodesDir, f), 'utf8'));
          return { module: node.id || '', path: node.path || '', purpose: node.type || '' };
        });
      // In multi-repo workspaces, filter modules to only those from the
      // target's declared repositories. If no repos are declared, keep all.
      if (declaredRepos.size > 0) {
        modules = modules.filter(m => {
          const repo = (m.path || '').split('/')[0];
          return declaredRepos.has(repo);
        });
      }
      // Implementation packets carry only graph nodes for the exact declared
      // write set. A task without a matching graph node gets no graph context;
      // it never receives an unbounded repository inventory.
      if (type === 'task') {
        const relevantFiles = parseRelevantFiles(targetMd.body);
        modules = modules.filter(m => relevantFiles.some(file => (
          m.path === file || m.path.endsWith(`/${file}`) || m.path.startsWith(`${file}/`)
        )));
      }
    }
  } catch (e) {}

  const allSkills = [...new Set([
    ...alwaysOn,
    ...projectLocal,
    ...userLocal,
    ...primarySkills,
    ...secondarySkills,
    ...targetSkills,
  ])];
  const contract = type === 'task' ? taskContract(row, targetMd) : null;
  if (type === 'task') validateTaskContract(row.id, contract, targetMd.source);
  const skillReferences = canonicalSkillReferences(skillsData, allSkills);

  const target = {
    type,
    id: row.id,
    uuid: row.uuid || '',
    title: row.title || '',
    status: row.status || '',
    dependencies: row.dependencies || row.parent || '',
    skills: targetSkills,
    commit: row.commit || '',
  };
  if (type === 'task') {
    target.source = targetMd.source;
    target.contract = contract;
  } else {
    target.body = targetMd.body;
    target.testing = targetMd.testing;
    target.criteria = targetMd.criteria;
  }

  const packet = {
    version: type === 'task' ? 2 : 1,
    target,
    parent: parent ? {
      type: parent.id.startsWith('EPIC-') ? 'epic' : parent.id.startsWith('SPEC-') ? 'spec' : 'plan',
      id: parent.id,
      title: parent.title || '',
      status: parent.status || '',
      skills: parentSkills,
      ...(type === 'task'
        ? { summary: compactMarkdownContext(parentMd) }
        : { body: parentMd.body, testing: parentMd.testing, criteria: parentMd.criteria }),
    } : null,
    grandparent: null,
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
    // allSkills is the minimal set the implementer should load.
    // Only always-on (filtered by workflow), project-local, matched
    // user-local (by trigger), matrix primary/secondary for this
    // task's triggers, and the task's own declared skills. Not the
    // full parent/grandparent cascade — those are for context, not
    // for loading.
    allSkills,
    skillReferences,
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
    if (err.code === 'NEEDS_PLANNING') {
      const result = {
        status: 'needs_planning',
        target: targetId,
        missing: err.missing,
        message: err.message,
      };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = contextCommand;
module.exports.buildPacket = buildPacket;
