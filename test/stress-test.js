const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const syncCommand = require('../src/commands/sync');
const updateCommand = require('../src/commands/update');
const upgradeCommand = require('../src/commands/upgrade');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  readJSONL,
} = require('../src/commands/shared');

async function stressTest() {
  console.log('=== STARTING STRESS TESTS & EDGE CASE VALIDATION ===');

  // Scenario 1: Empty directory with --discover
  const dir1 = path.join('/tmp', 'stress-empty-' + Date.now());
  fs.mkdirSync(dir1, { recursive: true });
  console.log('[Scenario 1] Testing empty directory initialization with discover...');
  const ws1 = '.test-manager';
  await initCommand({ target: dir1, workspace: ws1, discover: true });
  assert(fs.existsSync(path.join(dir1, ws1, 'AGENTS.md')));
  assert(fs.existsSync(path.join(dir1, ws1, 'identity', 'project.md')));
  assert(fs.existsSync(path.join(dir1, ws1, 'data', 'tasks.jsonl')));
  assert(fs.existsSync(path.join(dir1, ws1, 'data', 'identity.json')));

  // Scenario 2: Go project topology
  const dir2 = path.join('/tmp', 'stress-go-' + Date.now());
  fs.mkdirSync(dir2, { recursive: true });
  fs.writeFileSync(path.join(dir2, 'go.mod'), 'module example.com/foo\n\ngo 1.22\n');
  fs.writeFileSync(path.join(dir2, 'main.go'), 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("hello") }\n');
  console.log('[Scenario 2] Testing Go project initialization & graph parsing...');
  const ws2 = '.custom-manager';
  await initCommand({ target: dir2, workspace: ws2, discover: true });
  await graphCommand({ target: dir2, workspace: ws2 });
  assert(fs.existsSync(path.join(dir2, ws2, 'graph', 'nodes')));
  assert(fs.existsSync(path.join(dir2, ws2, 'data', 'tasks.jsonl')));

  // Scenario 3: Populating with specs/plans/tasks and testing inspect + overview
  const dir3 = path.join('/tmp', 'stress-full-' + Date.now());
  fs.mkdirSync(dir3, { recursive: true });
  fs.writeFileSync(path.join(dir3, 'package.json'), '{"name":"test"}\n');
  const ws3 = '.full-manager';
  await initCommand({ target: dir3, workspace: ws3, discover: false });

  // Upgrade removes old duplicate managed profiles from .devin/agents while
  // preserving unrelated user profiles.
  const legacyAgentsDir = path.join(dir3, '.devin', 'agents');
  fs.mkdirSync(legacyAgentsDir, { recursive: true });
  fs.writeFileSync(path.join(legacyAgentsDir, 'reviewer.md'), 'old generated reviewer\n');
  fs.writeFileSync(path.join(legacyAgentsDir, 'personal.md'), 'user profile\n');
  await upgradeCommand({ target: dir3, workspace: ws3 });
  assert(!fs.existsSync(path.join(legacyAgentsDir, 'reviewer.md')), 'upgrade kept duplicate managed reviewer');
  assert(fs.existsSync(path.join(legacyAgentsDir, 'personal.md')), 'upgrade removed unrelated user profile');

  // Add spec, plan, task via CLI
  await addCommand({ type: 'spec', title: 'Core Engine', target: dir3, workspace: ws3 });
  await addCommand({ type: 'plan', title: 'Database Layer', parent: 'SPEC-001', status: 'committed', target: dir3, workspace: ws3 });

  // A committed plan remains committed before task creation.
  await syncCommand({ target: dir3, workspace: ws3 });
  let plans = readPlans(path.join(dir3, ws3));
  assert.strictEqual(plans[0].status, 'committed', 'sync demoted a childless committed plan');

  await addCommand({ type: 'task', title: 'Connection Pool', parent: 'PLAN-001', target: dir3, workspace: ws3 });
  await updateCommand({
    id: 'TASK-001',
    title: 'Bounded Connection Pool',
    skills: 'database-testing',
    target: dir3,
    workspace: ws3,
  });

  // Set task to done
  await setStatusCommand({ id: 'TASK-001', status: 'done', target: dir3, workspace: ws3 });

  console.log('[Scenario 3] Testing inspect and overview with data...');
  await inspectCommand({ target: dir3, workspace: ws3 });
  await overviewCommand({ target: dir3, workspace: ws3 });

  // Verify data persists
  const specs = readSpecs(path.join(dir3, ws3));
  assert(specs.length === 1, 'Specs not persisted');
  plans = readPlans(path.join(dir3, ws3));
  assert(plans.length === 1, 'Plans not persisted');
  const taskStates = getTaskStates(path.join(dir3, ws3));
  assert(taskStates.size === 1, 'Tasks not persisted in JSONL');
  assert.strictEqual(taskStates.get('TASK-001').status, 'done', 'Task not marked done');
  assert.strictEqual(taskStates.get('TASK-001').title, 'Bounded Connection Pool', 'Task title update not reduced from JSONL');
  assert.strictEqual(taskStates.get('TASK-001').skills, 'database-testing', 'Task skills update not reduced from JSONL');

  // Verify plan timeline has events
  const timeline = readJSONL(path.join(dir3, ws3, 'plans', 'PLAN-001.timeline.jsonl'));
  assert(timeline.length >= 2, 'Plan timeline should have queued + done events');

  // Scenario 4: Error handling when workspace does not exist
  console.log('[Scenario 4] Testing error handling when workspace does not exist...');
  const nonExistent = path.join('/tmp', 'non-existent-dir-' + Date.now());
  const origExit = process.exit;
  let exited = false;
  process.exit = (code) => { exited = true; throw new Error(`process.exit(${code})`); };
  try {
    await inspectCommand({ target: nonExistent, workspace: '.test-manager' });
    assert.fail('Should have thrown or exited for non-existent workspace');
  } catch (err) {
    console.log('Caught expected error/exit pathway:', err.message);
    assert(exited || err.message.includes('does not exist'), 'Expected error about missing workspace');
  } finally {
    process.exit = origExit;
  }

  // Cleanup fake projects
  console.log('Cleaning up stress test directories...');
  fs.rmSync(dir1, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
  fs.rmSync(dir3, { recursive: true, force: true });

  console.log('=== ALL STRESS TESTS PASSED SUCCESSFULLY! ===');
}

stressTest().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
