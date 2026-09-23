const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const initCommand = require('../src/commands/init');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const updateCommand = require('../src/commands/update');
const archiveCommand = require('../src/commands/archive');
const inspectCommand = require('../src/commands/inspect');
const uuidCommand = require('../src/commands/uuid');
const {
  readPlans,
  readJSONL,
  parseMarkdownField,
  parseMarkdownStatus,
} = require('../src/commands/shared');

async function runTests() {
  console.log('=== RUNNING PLAN+TASK COMMAND TESTS ===');
  const targetDir = path.join('/tmp', `pc-cmd-${Date.now()}`);
  const ws = '.test-manager';
  const aiDir = path.join(targetDir, ws);
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(targetDir, 'package.json'), '{"name":"test"}\n');
  await initCommand({ target: targetDir, workspace: ws, discover: true });

  const u1 = uuidCommand({ id: 'PLAN-001' });
  const u2 = uuidCommand({ id: 'PLAN-001' });
  assert.strictEqual(u1, u2, 'UUID should be deterministic');
  assert.match(u1, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  const plan = await addCommand({ type: 'plan', title: 'Current Plan', target: targetDir, workspace: ws });
  assert.strictEqual(plan.id, 'PLAN-001');
  assert(fs.existsSync(path.join(aiDir, 'plans', 'PLAN-001.md')));
  assert.strictEqual(readPlans(aiDir).length, 1);

  await assert.rejects(
    addCommand({ type: 'plan', title: 'Second Plan', target: targetDir, workspace: ws }),
    /Only one plan may be active/i,
  );

  const invalidType = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'bin', 'cli.js'),
    'add', '--type', 'spec', '--title', 'Legacy Spec', '-t', targetDir, '-w', ws,
  ], { encoding: 'utf8' });
  assert.notStrictEqual(invalidType.status, 0, 'add accepted a legacy spec');
  assert.match(`${invalidType.stdout}\n${invalidType.stderr}`, /plan or task|legacy read-only/i);

  const task = await addCommand({
    type: 'task', title: 'Narrow Task', parent: 'PLAN-001', dependencies: 'none',
    target: targetDir, workspace: ws,
  });
  assert.strictEqual(task.id, 'TASK-001');
  const taskPath = path.join(aiDir, 'tasks', 'TASK-001.md');
  assert.strictEqual(parseMarkdownField(taskPath, 'Parent'), 'PLAN-001', 'task is not parented to its plan');
  const events = readJSONL(path.join(aiDir, 'data', 'tasks.jsonl'));
  assert(events.some((event) => event.id === 'TASK-001' && event.event === 'created' && event.plan === 'PLAN-001'));
  assert(readJSONL(path.join(aiDir, 'plans', 'PLAN-001.timeline.jsonl'))
    .some((event) => event.task === 'TASK-001' && event.event === 'queued'));

  await updateCommand({
    id: 'TASK-001', title: 'Renamed Narrow Task', skills: 'node-testing',
    target: targetDir, workspace: ws,
  });
  const updatedEvents = readJSONL(path.join(aiDir, 'data', 'tasks.jsonl'));
  assert(updatedEvents.some((event) => event.id === 'TASK-001' && event.event === 'updated' && event.title === 'Renamed Narrow Task'));
  assert(updatedEvents.some((event) => event.id === 'TASK-001' && event.event === 'updated' && event.skills === 'node-testing'));

  await setStatusCommand({ id: 'TASK-001', status: 'in_progress', target: targetDir, workspace: ws });
  assert.strictEqual(parseMarkdownStatus(taskPath), 'in_progress');
  assert(readJSONL(path.join(aiDir, 'data', 'tasks.jsonl'))
    .some((event) => event.id === 'TASK-001' && event.event === 'started'));

  await assert.rejects(
    archiveCommand({ id: 'TASK-001', target: targetDir, workspace: ws }),
    /terminal/i,
  );
  await setStatusCommand({ id: 'TASK-001', status: 'done', target: targetDir, workspace: ws });
  const packetPath = path.join(targetDir, '.context-TASK-001.json');
  fs.writeFileSync(packetPath, '{}\n');
  await archiveCommand({ id: 'TASK-001', target: targetDir, workspace: ws });
  assert(!fs.existsSync(packetPath), 'task archive kept transient context packet');
  assert(fs.existsSync(path.join(aiDir, 'archive', 'tasks', 'TASK-001.md')));
  const archivedEvents = readJSONL(path.join(aiDir, 'data', 'tasks.jsonl'));
  assert(archivedEvents.some((event) => event.id === 'TASK-001' && event.event === 'created'), 'archive rewrote task history');
  assert(archivedEvents.some((event) => event.id === 'TASK-001' && event.event === 'archived'), 'archive event missing');

  await assert.rejects(
    archiveCommand({ id: 'PLAN-001', target: targetDir, workspace: ws }),
    /terminal/i,
  );
  await setStatusCommand({ id: 'PLAN-001', status: 'done', target: targetDir, workspace: ws });
  await archiveCommand({ id: 'PLAN-001', target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(aiDir, 'archive', 'plans', 'PLAN-001.md')));
  assert(fs.existsSync(path.join(aiDir, 'archive', 'timelines', 'PLAN-001.timeline.jsonl')));

  let inspectOutput = '';
  const originalLog = console.log;
  console.log = (message) => { inspectOutput += `${message}\n`; };
  await inspectCommand({ target: targetDir, workspace: ws, includeArchived: true });
  console.log = originalLog;
  assert(inspectOutput.includes('PLAN-001') && inspectOutput.includes('TASK-001'));
  assert(inspectOutput.includes('archived'));

  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log('=== PLAN+TASK COMMAND TESTS PASSED ===');
}

runTests().catch((error) => {
  console.error('Commands test failed:', error);
  process.exit(1);
});
