const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const graphCommand = require('../src/commands/graph');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const syncCommand = require('../src/commands/sync');
const updateCommand = require('../src/commands/update');
const upgradeCommand = require('../src/commands/upgrade');
const { readPlans, getTaskStates, readJSONL } = require('../src/commands/shared');

async function stressTest() {
  console.log('=== STARTING PLAN+TASK STRESS TESTS ===');
  const emptyDir = path.join('/tmp', `stress-empty-${Date.now()}`);
  fs.mkdirSync(emptyDir, { recursive: true });
  await initCommand({ target: emptyDir, workspace: '.test-manager', discover: true });
  assert(fs.existsSync(path.join(emptyDir, '.test-manager', 'plans')));
  assert(fs.existsSync(path.join(emptyDir, '.test-manager', 'tasks')));
  assert(!fs.existsSync(path.join(emptyDir, '.test-manager', 'specs')));
  assert(!fs.existsSync(path.join(emptyDir, '.test-manager', 'epics')));

  const goDir = path.join('/tmp', `stress-go-${Date.now()}`);
  fs.mkdirSync(goDir, { recursive: true });
  fs.writeFileSync(path.join(goDir, 'go.mod'), 'module example.com/foo\n\ngo 1.22\n');
  fs.writeFileSync(path.join(goDir, 'main.go'), 'package main\n');
  await initCommand({ target: goDir, workspace: '.go-manager', discover: true });
  await graphCommand({ target: goDir, workspace: '.go-manager' });
  assert(fs.readdirSync(path.join(goDir, '.go-manager', 'graph', 'nodes')).length > 0);

  const fullDir = path.join('/tmp', `stress-full-${Date.now()}`);
  const ws = '.full-manager';
  const aiDir = path.join(fullDir, ws);
  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(path.join(fullDir, 'package.json'), '{"name":"stress"}\n');
  await initCommand({ target: fullDir, workspace: ws, discover: false });

  const legacyAgents = path.join(fullDir, '.devin', 'agents');
  fs.mkdirSync(legacyAgents, { recursive: true });
  fs.writeFileSync(path.join(legacyAgents, 'implementer.md'), 'obsolete generated profile\n');
  fs.writeFileSync(path.join(legacyAgents, 'personal.md'), 'user profile\n');
  await upgradeCommand({ target: fullDir, workspace: ws });
  assert(!fs.existsSync(path.join(legacyAgents, 'implementer.md')), 'upgrade kept obsolete managed profile');
  assert(fs.existsSync(path.join(legacyAgents, 'personal.md')), 'upgrade removed unrelated user profile');
  assert.deepStrictEqual(
    fs.readdirSync(path.join(aiDir, '.agents', 'skills')).filter((name) => name.startsWith('pc-')).sort(),
    ['pc-plan'],
  );

  await addCommand({ type: 'plan', title: 'First Plan', status: 'committed', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir)[0].status, 'committed', 'sync changed a childless plan');

  await addCommand({ type: 'task', title: 'First Task', parent: 'PLAN-001', target: fullDir, workspace: ws });
  await updateCommand({
    id: 'TASK-001', title: 'Bounded First Task', skills: 'node-testing',
    target: fullDir, workspace: ws,
  });
  await setStatusCommand({ id: 'TASK-001', status: 'done', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir).find((plan) => plan.id === 'PLAN-001').status, 'done', 'tasks did not roll up to plan');

  await addCommand({ type: 'plan', title: 'Second Plan', status: 'committed', target: fullDir, workspace: ws });
  await addCommand({ type: 'task', title: 'Planning Gap', parent: 'PLAN-002', target: fullDir, workspace: ws });
  await setStatusCommand({ id: 'TASK-002', status: 'needs_planning', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir).find((plan) => plan.id === 'PLAN-002').status, 'needs_planning', 'needs_planning did not propagate to plan');

  const states = getTaskStates(aiDir);
  assert.strictEqual(states.get('TASK-001').title, 'Bounded First Task');
  assert.strictEqual(states.get('TASK-001').skills, 'node-testing');
  assert.strictEqual(states.get('TASK-002').status, 'needs_planning');
  const timeline = readJSONL(path.join(aiDir, 'plans', 'PLAN-002.timeline.jsonl'));
  assert(timeline.some((event) => event.task === 'TASK-002' && event.status === 'needs_planning'));

  fs.rmSync(emptyDir, { recursive: true, force: true });
  fs.rmSync(goDir, { recursive: true, force: true });
  fs.rmSync(fullDir, { recursive: true, force: true });
  console.log('=== PLAN+TASK STRESS TESTS PASSED ===');
}

stressTest().catch((error) => {
  console.error('Stress test failed:', error);
  process.exit(1);
});
