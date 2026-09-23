const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const graphCommand = require('../src/commands/graph');
const contextCommand = require('../src/commands/context');
const {
  appendTaskEvent,
  ensureMemoryLakeIdentity,
  ensureMemoryLakeMcp,
  readIdentity,
  readSkills,
  writeJSON,
} = require('../src/commands/shared');

function captureContext(options) {
  let output = '';
  const originalLog = console.log;
  console.log = (message) => { output += `${message}\n`; };
  return contextCommand(options).then(() => {
    console.log = originalLog;
    return JSON.parse(output.trim());
  }, (error) => {
    console.log = originalLog;
    throw error;
  });
}

async function runTests() {
  console.log('Running project-context PLAN+TASK test suite...');
  const targetDir = path.join('/tmp', `pc-test-${Date.now()}`);
  const ws = '.test-manager';
  const aiDir = path.join(targetDir, ws);
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'owned.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(targetDir, 'src', 'other.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(targetDir, 'package.json'), '{"name":"test-repo"}\n');
  fs.mkdirSync(path.join(targetDir, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, '.codex', 'config.toml'), 'model = "existing-model"\n');

  await initCommand({ target: targetDir, workspace: ws, discover: true });
  assert(fs.existsSync(path.join(aiDir, 'plans')), 'plans dir missing');
  assert(fs.existsSync(path.join(aiDir, 'tasks')), 'tasks dir missing');
  assert(!fs.existsSync(path.join(aiDir, 'epics')), 'init created legacy epics dir');
  assert(!fs.existsSync(path.join(aiDir, 'specs')), 'init created legacy specs dir');
  assert(fs.existsSync(path.join(aiDir, 'data', 'tasks.jsonl')), 'tasks.jsonl missing');
  assert(fs.existsSync(path.join(aiDir, 'data', 'identity.json')), 'identity.json missing');
  assert(fs.existsSync(path.join(aiDir, 'data', 'skills.json')), 'skills.json missing');
  const codexConfigPath = path.join(targetDir, '.codex', 'config.toml');
  const codexConfig = fs.readFileSync(codexConfigPath, 'utf8');
  assert.match(codexConfig, /model = "existing-model"/, 'existing Codex config was replaced');
  assert.match(codexConfig, /\[mcp_servers\.memorylake\]/, 'MemoryLake MCP section missing');
  assert.match(codexConfig, /https:\/\/app\.memorylake\.ai\/memorylake\/mcp\/v2/, 'MemoryLake MCP URL missing');
  const firstConfig = codexConfig;
  assert.strictEqual(ensureMemoryLakeMcp(targetDir).changed, false, 'MemoryLake MCP setup is not idempotent');
  assert.strictEqual(fs.readFileSync(codexConfigPath, 'utf8'), firstConfig, 'idempotent MCP setup changed config');

  const generatedSkills = fs.readdirSync(path.join(aiDir, '.agents', 'skills'))
    .filter((name) => name.startsWith('pc-')).sort();
  assert.deepStrictEqual(generatedSkills, ['pc-plan'], 'init generated public legacy workflow skills');
  const generatedProfiles = fs.readdirSync(path.join(aiDir, '.agents', 'agents'))
    .filter((name) => name.endsWith('.md')).sort();
  assert.deepStrictEqual(generatedProfiles, ['challenger.md', 'writer.md'], 'init generated unexpected agent profiles');

  const planTemplate = fs.readFileSync(path.join(aiDir, 'templates', 'PLAN-NNN.template.md'), 'utf8');
  for (const heading of ['## Human Summary', '## Resume Checkpoint', '## Blocking Questions', '## Advisory Questions', '## Planning Gate']) {
    assert(planTemplate.includes(heading), `plan template missing ${heading}`);
  }
  assert.match(planTemplate, /Self-challenge complete.*no/i);
  assert.match(planTemplate, /Blocking questions resolved.*no/i);
  assert.match(planTemplate, /User accepted.*no/i);

  const identity = readIdentity(aiDir);
  assert(identity.stack && identity.primaryLanguage, 'identity data incomplete');
  assert.deepStrictEqual(identity.memoryLake, { workspace: 'default', project: path.basename(targetDir) });
  ensureMemoryLakeIdentity(aiDir, path.basename(targetDir), {
    workspaceId: 'ws-test',
    projectId: 'prj-test',
  });
  ensureMemoryLakeIdentity(aiDir, path.basename(targetDir));
  assert.deepStrictEqual(readIdentity(aiDir).memoryLake, {
    workspace: 'default',
    project: path.basename(targetDir),
    workspaceId: 'ws-test',
    projectId: 'prj-test',
  }, 'MemoryLake IDs were not preserved');
  const skillsData = readSkills(aiDir);
  assert(skillsData.skills.some((skill) => skill.skill === 'grilling' && skill.workflowTrigger === 'planning'));
  assert(skillsData.skills.some((skill) => skill.skill === 'adhd' && skill.workflowTrigger === 'planning'));

  await graphCommand({ target: targetDir, workspace: ws });
  fs.writeFileSync(path.join(aiDir, 'plans', 'PLAN-001.md'), `# PLAN-001: Compact plan

**UUID**: plan-uuid
**Status**: committed
**Dependencies**:
**Skills**:
**Triggers**:

## Goal

Deliver the bounded behavior.

## Human Summary

Human-readable planning summary.

## Scope and Boundaries

Only the owned module changes.

## Repositories

- \`test-repo\`

## Architecture and Data Boundaries

The public API remains stable and data ownership stays local.

## Decisions

Use the existing interface.

## Acceptance and Verification

The exact task verification passes.

## Planning Gate

- **Self-challenge complete**: yes
- **Blocking questions resolved**: yes
- **User accepted**: yes
`);
  fs.writeFileSync(path.join(aiDir, 'tasks', 'TASK-001.md'), `# TASK-001: Narrow task

**UUID**: task-uuid
**Status**: draft
**Parent**: PLAN-001
**Dependencies**: none
**Skills**:
**Triggers**: node

## Goal

Change one owned symbol.

## Repositories

- \`test-repo\`

## Relevant Files

### To create

None.

### To modify

- \`src/owned.js\` — update the owned behavior

## Relevant Symbols

- \`ownedFunction\`

## Required Change

Update the bounded implementation.

## Constraints

Keep the API and data boundary unchanged.

## Proof Obligations

1. Return test output proving the behavior.

## Acceptance Criteria

1. The owned behavior passes.

## Tests

### Success cases
- expected input succeeds

### Failure cases
- invalid input fails safely

### Boundary cases
- empty input is handled

## Verification

\`node test-owned.js\`

## Do-Not-Touch

- \`src/other.js\`

## Planning Gap Protocol

- Stop and return \`needs_planning\` if the write set must expand.
`);
  appendTaskEvent(aiDir, {
    id: 'TASK-001', event: 'created', title: 'Narrow task', plan: 'PLAN-001', status: 'draft', triggers: 'node',
  });
  writeJSON(path.join(aiDir, 'data', 'skills.json'), {
    skills: [
      { skill: 'grilling', path: 'user-level', layer: 'user-local', workflowTrigger: 'planning' },
      { skill: 'adhd', path: 'user-level', layer: 'user-local', workflowTrigger: 'planning' },
      { skill: 'project-linter', path: 'user-level', layer: 'project-local', workflowTrigger: 'all' },
    ],
    matrix: [],
  });
  writeJSON(path.join(aiDir, 'graph', 'nodes', 'owned.json'), {
    id: 'owned', path: 'test-repo/src/owned.js', type: 'source',
  });
  writeJSON(path.join(aiDir, 'graph', 'nodes', 'other.json'), {
    id: 'other', path: 'test-repo/src/other.js', type: 'source',
  });

  const planPacket = await captureContext({ target: targetDir, workspace: ws, id: 'PLAN-001', workflow: 'planning' });
  assert(planPacket.allSkills.includes('grilling'), 'PLAN context missing grilling');
  assert(planPacket.allSkills.includes('adhd'), 'PLAN context missing adhd');

  const taskPacket = await captureContext({ target: targetDir, workspace: ws, id: 'TASK-001' });
  assert(!taskPacket.allSkills.includes('grilling') && !taskPacket.allSkills.includes('adhd'), 'planning skills leaked into TASK context');
  assert.strictEqual(taskPacket.parent.id, 'PLAN-001');
  assert(taskPacket.parent.summary, 'TASK context missing compact parent summary');
  assert(!taskPacket.parent.body, 'TASK context includes full parent plan body');
  assert.strictEqual(taskPacket.grandparent, null);
  const contract = taskPacket.target.contract;
  assert(contract.writeSet.includes('src/owned.js'), 'contract missing exact file');
  assert(contract.symbols.includes('ownedFunction'), 'contract missing exact symbol');
  assert(contract.dataApiBoundaries.includes('API and data boundary'), 'contract missing boundary');
  assert(contract.tests.includes('Success cases') && contract.tests.includes('Failure cases') && contract.tests.includes('Boundary cases'), 'contract missing tests');
  assert(contract.verification.includes('node test-owned.js'), 'contract missing verification');
  assert(contract.doNotTouch.includes('src/other.js'), 'contract missing do-not-touch');
  assert(contract.proofObligations.includes('test output'), 'contract missing proof obligations');
  assert(contract.planningGapProtocol.includes('needs_planning'), 'contract missing planning-gap protocol');
  assert.deepStrictEqual(taskPacket.modules.map((module) => module.path), ['test-repo/src/owned.js']);

  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log('PLAN+TASK tests passed.');
}

runTests().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
