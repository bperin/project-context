const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');
const contextCommand = require('../src/commands/context');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  readIdentity,
  readSkills,
  appendTaskEvent,
  updateMarkdownStatus,
  parseMarkdownField,
  writeJSON,
} = require('../src/commands/shared');

async function runTests() {
  console.log('Running project-context test suite...');
  const targetDir = path.join('/tmp', 'pc-test-' + Date.now());
  fs.mkdirSync(targetDir, { recursive: true });

  // Create a minimal source file so graph has something to walk
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), "module.exports = {};\n");
  fs.writeFileSync(path.join(targetDir, 'package.json'), '{"name":"test"}\n');

  // --- Test init ---
  console.log('Testing init...');
  const ws = '.test-manager';
  await initCommand({ target: targetDir, workspace: ws, discover: true });
  assert(fs.existsSync(path.join(targetDir, ws, 'AGENTS.md')), 'AGENTS.md missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'specs')), 'specs dir missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'data', 'tasks.jsonl')), 'tasks.jsonl missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'data', 'identity.json')), 'identity.json missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'data', 'skills.json')), 'skills.json missing');

  // Verify identity.json has expected fields
  const identity = readIdentity(path.join(targetDir, ws));
  assert(identity.stack, 'identity.json missing stack');
  assert(identity.primaryLanguage, 'identity.json missing primaryLanguage');

  // Verify skills.json has expected structure
  const skillsData = readSkills(path.join(targetDir, ws));
  assert(Array.isArray(skillsData.skills), 'skills.json missing skills array');
  assert(Array.isArray(skillsData.matrix), 'skills.json missing matrix array');
  assert(skillsData.skills.length > 0, 'skills.json has no skill entries');

  // Verify custom subagent profiles are copied
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'reviewer.md')), 'reviewer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'code-optimizer.md')), 'code-optimizer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'implementer.md')), 'implementer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'task-writer.md')), 'task-writer agent profile missing');

  // --- Test graph ---
  console.log('Testing graph...');
  await graphCommand({ target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(targetDir, ws, 'graph', 'nodes')), 'graph nodes missing');
  const nodeFiles = fs.readdirSync(path.join(targetDir, ws, 'graph', 'nodes'));
  assert(nodeFiles.length > 0, 'graph generated no nodes');

  // --- Test overview ---
  console.log('Testing overview...');
  await overviewCommand({ target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(targetDir, ws, 'data', 'workflows.json')), 'workflows.json missing after overview');

  // --- Test inspect ---
  console.log('Testing inspect...');
  // Create spec, plan, task MD files for inspect to read
  const specsDir = path.join(targetDir, ws, 'specs');
  const plansDir = path.join(targetDir, ws, 'plans');
  const tasksDir = path.join(targetDir, ws, 'tasks');

  fs.writeFileSync(path.join(specsDir, 'SPEC-001.md'),
    '# SPEC-001: Test Spec\n\n**UUID**: test-uuid-001\n**Status**: committed\n**Dependencies**: none\n**Skills**: go-crypto\n**Triggers**: crypto\n');
  fs.writeFileSync(path.join(plansDir, 'PLAN-001.md'),
    '# PLAN-001: Test Plan\n\n**UUID**: test-uuid-plan\n**Status**: committed\n**Parent**: SPEC-001\n**Dependencies**: SPEC-001\n**Skills**: go-crypto\n**Triggers**: crypto\n');
  fs.writeFileSync(path.join(tasksDir, 'TASK-001.md'),
    '# TASK-001: Test Task\n\n**UUID**: test-uuid-002\n**Status**: committed\n**Parent**: PLAN-001\n**Dependencies**: PLAN-001\n**Skills**: \n**Triggers**: ed25519\n');

  // Append a task event to JSONL
  appendTaskEvent(path.join(targetDir, ws), {
    id: 'TASK-001',
    event: 'created',
    title: 'Test Task',
    plan: 'PLAN-001',
    status: 'draft',
  });

  // Update skills.json with test layers
  writeJSON(path.join(targetDir, ws, 'data', 'skills.json'), {
    skills: [
      { skill: 'go-systems-programmer', path: 'user-level', layer: 'always-on', workflowTrigger: 'all', purpose: 'Base Go style' },
      { skill: 'project-linter', path: 'user-level', layer: 'project-local', workflowTrigger: 'all', purpose: 'Base project lint' },
      { skill: 'security-check', path: 'user-level', layer: 'user-local', workflowTrigger: 'security', purpose: 'Security guardrails' },
      { skill: 'ed25519-user', path: 'user-level', layer: 'user-local', workflowTrigger: 'ed25519', purpose: 'Ed25519 user helper' },
    ],
    matrix: [
      { trigger: 'ed25519', language: 'Go', primarySkills: 'ed25519-skill', secondarySkills: 'wycheproof, crypto', notes: 'Ed25519 implementation' },
    ],
  });

  // Update identity to Go
  const identityPath = path.join(targetDir, ws, 'data', 'identity.json');
  const ident = readIdentity(path.join(targetDir, ws));
  ident.primaryLanguage = 'Go';
  ident.stack = 'Go';
  writeJSON(identityPath, ident);

  await inspectCommand({ target: targetDir, workspace: ws });

  // --- Test context (dynamic skill layers) ---
  console.log('Testing context...');
  let output = '';
  const originalLog = console.log;
  console.log = (msg) => { output += msg + '\n'; };
  await contextCommand({ target: targetDir, workspace: ws, id: 'TASK-001' });
  console.log = originalLog;
  const packet = JSON.parse(output.trim());
  assert.deepStrictEqual(packet.skillLayers.alwaysOn, ['go-systems-programmer']);
  assert.deepStrictEqual(packet.skillLayers.projectLocal, ['project-linter']);
  assert.deepStrictEqual(packet.skillLayers.userLocal, ['ed25519-user']);
  assert.deepStrictEqual(packet.skillLayers.matrixSkills.sort(), ['ed25519-skill', 'wycheproof', 'crypto'].sort());
  assert.deepStrictEqual(packet.skillLayers.primarySkills, ['ed25519-skill']);
  assert.deepStrictEqual(packet.skillLayers.secondarySkills.sort(), ['wycheproof', 'crypto'].sort());
  assert(packet.allSkills.includes('go-systems-programmer'), 'allSkills missing alwaysOn');
  assert(packet.allSkills.includes('ed25519-skill'), 'allSkills missing matrix primary');

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
