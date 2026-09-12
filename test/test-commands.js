const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const uuidCommand = require('../src/commands/uuid');
const contextCommand = require('../src/commands/context');
const inspectCommand = require('../src/commands/inspect');
const archiveCommand = require('../src/commands/archive');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  readJSONL,
  parseMarkdownStatus,
} = require('../src/commands/shared');

async function runTests() {
  console.log('=== RUNNING COMMANDS TESTS ===');
  const targetDir = path.join('/tmp', 'pc-cmd-' + Date.now());
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), "module.exports = {};\n");
  fs.writeFileSync(path.join(targetDir, 'package.json'), '{"name":"test"}\n');
  const ws = '.test-manager';
  await initCommand({ target: targetDir, workspace: ws, discover: true });

  // --- uuid ---
  console.log('Testing uuid...');
  const u1 = uuidCommand({ id: 'SPEC-001' });
  const u2 = uuidCommand({ id: 'SPEC-001' });
  assert.strictEqual(u1, u2, 'uuid should be deterministic');
  assert.match(u1, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'not a v5 UUID');

  // --- add spec ---
  console.log('Testing add spec...');
  const spec = await addCommand({ type: 'spec', title: 'Test Spec', target: targetDir, workspace: ws });
  assert.strictEqual(spec.id, 'SPEC-001', 'wrong spec id');
  assert(spec.uuid, 'spec uuid missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'specs', 'SPEC-001.md')), 'spec MD file not created');
  const specs = readSpecs(path.join(targetDir, ws));
  assert(specs.length === 1, 'expected 1 spec');
  assert.strictEqual(specs[0].id, 'SPEC-001');
  assert.strictEqual(specs[0].title, 'SPEC-001: Test Spec');

  // --- add plan ---
  console.log('Testing add plan...');
  const plan = await addCommand({ type: 'plan', title: 'Test Plan', parent: 'SPEC-001', target: targetDir, workspace: ws });
  assert.strictEqual(plan.id, 'PLAN-001');
  assert(plan.uuid, 'plan uuid missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'plans', 'PLAN-001.md')), 'plan MD file not created');
  const plans = readPlans(path.join(targetDir, ws));
  assert(plans.length === 1, 'expected 1 plan');
  assert.strictEqual(plans[0].id, 'PLAN-001');
  assert.strictEqual(plans[0].parent, 'SPEC-001');

  // --- add task ---
  console.log('Testing add task...');
  const task = await addCommand({ type: 'task', title: 'Test Task', parent: 'PLAN-001', target: targetDir, workspace: ws });
  assert.strictEqual(task.id, 'TASK-001');
  assert(task.uuid, 'task uuid missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'tasks', 'TASK-001.md')), 'task MD file not created');

  // Verify task event was appended to JSONL
  const taskEvents = readJSONL(path.join(targetDir, ws, 'data', 'tasks.jsonl'));
  const createdEvents = taskEvents.filter(e => e.event === 'created' && e.id === 'TASK-001');
  assert(createdEvents.length === 1, 'task created event not in JSONL');
  assert.strictEqual(createdEvents[0].plan, 'PLAN-001', 'task plan not set in JSONL');

  // Verify plan timeline was created
  assert(fs.existsSync(path.join(targetDir, ws, 'plans', 'PLAN-001.timeline.jsonl')), 'plan timeline not created');
  const timeline = readJSONL(path.join(targetDir, ws, 'plans', 'PLAN-001.timeline.jsonl'));
  const queuedEvents = timeline.filter(e => e.event === 'queued' && e.task === 'TASK-001');
  assert(queuedEvents.length === 1, 'task queued event not in plan timeline');

  // --- status ---
  console.log('Testing status...');
  await setStatusCommand({ id: 'TASK-001', status: 'in_progress', target: targetDir, workspace: ws });

  // Verify MD file status was updated
  const taskStatus = parseMarkdownStatus(path.join(targetDir, ws, 'tasks', 'TASK-001.md'));
  assert.strictEqual(taskStatus, 'in_progress', 'task MD status not updated');

  // Verify JSONL event was appended
  const taskEvents2 = readJSONL(path.join(targetDir, ws, 'data', 'tasks.jsonl'));
  const startedEvents = taskEvents2.filter(e => e.event === 'started' && e.id === 'TASK-001');
  assert(startedEvents.length === 1, 'task started event not in JSONL');

  // Verify plan timeline was updated
  const timeline2 = readJSONL(path.join(targetDir, ws, 'plans', 'PLAN-001.timeline.jsonl'));
  const startedTimelineEvents = timeline2.filter(e => e.event === 'started' && e.task === 'TASK-001');
  assert(startedTimelineEvents.length === 1, 'task started event not in plan timeline');

  // --- context packet ---
  console.log('Testing context...');
  let output = '';
  const originalLog = console.log;
  console.log = (msg) => { output += msg + '\n'; };
  await contextCommand({ target: targetDir, workspace: ws, id: 'TASK-001' });
  console.log = originalLog;
  const packet = JSON.parse(output.trim());
  assert.strictEqual(packet.target.id, 'TASK-001');
  assert.strictEqual(packet.parent.id, 'PLAN-001');
  assert.strictEqual(packet.grandparent.id, 'SPEC-001');
  assert(Array.isArray(packet.allSkills));

  // --- archive: refuse non-terminal task ---
  console.log('Testing archive (refuse non-terminal)...');
  // TASK-001 is in_progress; archiving should fail without --force
  let archiveErr = null;
  try {
    await archiveCommand({ id: 'TASK-001', target: targetDir, workspace: ws });
  } catch (e) { archiveErr = e; }
  assert(archiveErr, 'expected archive of non-terminal task to fail');
  assert.match(archiveErr.message, /terminal/i, 'wrong error message');
  // MD file should still be in active dir
  assert(fs.existsSync(path.join(targetDir, ws, 'tasks', 'TASK-001.md')), 'task MD should not have moved');

  // --- archive: mark task done, then archive ---
  console.log('Testing archive (terminal task)...');
  await setStatusCommand({ id: 'TASK-001', status: 'done', target: targetDir, workspace: ws });
  await archiveCommand({ id: 'TASK-001', target: targetDir, workspace: ws });
  // MD file moved to archive/tasks/
  assert(!fs.existsSync(path.join(targetDir, ws, 'tasks', 'TASK-001.md')), 'task MD should have moved');
  assert(fs.existsSync(path.join(targetDir, ws, 'archive', 'tasks', 'TASK-001.md')), 'task MD should be in archive');
  // JSONL history preserved + archived event appended
  const taskEvents3 = readJSONL(path.join(targetDir, ws, 'data', 'tasks.jsonl'));
  const archivedEvents = taskEvents3.filter(e => e.event === 'archived' && e.id === 'TASK-001');
  assert(archivedEvents.length === 1, 'archived event not in JSONL');
  const createdEventsStill = taskEvents3.filter(e => e.event === 'created' && e.id === 'TASK-001');
  assert(createdEventsStill.length === 1, 'created event should still be in JSONL (append-only)');
  // Plan timeline stays in active plans/ (it only moves when the PLAN is archived)
  assert(fs.existsSync(path.join(targetDir, ws, 'plans', 'PLAN-001.timeline.jsonl')), 'plan timeline should stay until plan archived');

  // --- archive: refuse plan with active children, then archive spec ---
  console.log('Testing archive (refuse plan with active children)...');
  // PLAN-001 is still draft and has no active children (TASK-001 archived), but it's non-terminal
  let planArchiveErr = null;
  try {
    await archiveCommand({ id: 'PLAN-001', target: targetDir, workspace: ws });
  } catch (e) { planArchiveErr = e; }
  assert(planArchiveErr, 'expected archive of non-terminal plan to fail');

  // Mark PLAN-001 done and archive it
  await setStatusCommand({ id: 'PLAN-001', status: 'done', target: targetDir, workspace: ws });
  await archiveCommand({ id: 'PLAN-001', target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(targetDir, ws, 'archive', 'plans', 'PLAN-001.md')), 'plan MD should be in archive');
  // Now the plan timeline should have moved to archive/timelines/
  assert(!fs.existsSync(path.join(targetDir, ws, 'plans', 'PLAN-001.timeline.jsonl')), 'plan timeline should have moved when plan archived');
  assert(fs.existsSync(path.join(targetDir, ws, 'archive', 'timelines', 'PLAN-001.timeline.jsonl')), 'plan timeline should be in archive after plan archived');

  // Mark SPEC-001 done and archive it
  await setStatusCommand({ id: 'SPEC-001', status: 'done', target: targetDir, workspace: ws });
  await archiveCommand({ id: 'SPEC-001', target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(targetDir, ws, 'archive', 'specs', 'SPEC-001.md')), 'spec MD should be in archive');

  // --- archive: already archived ---
  console.log('Testing archive (already archived)...');
  let alreadyErr = null;
  try {
    await archiveCommand({ id: 'TASK-001', target: targetDir, workspace: ws });
  } catch (e) { alreadyErr = e; }
  assert(alreadyErr, 'expected archive of already-archived task to fail');
  assert.match(alreadyErr.message, /already archived/i, 'wrong error message');

  // --- inspect hides archived by default ---
  console.log('Testing inspect hides archived...');
  let inspectOut = '';
  const origLog2 = console.log;
  console.log = (msg) => { inspectOut += msg + '\n'; };
  await inspectCommand({ target: targetDir, workspace: ws });
  console.log = origLog2;
  assert(!inspectOut.includes('TASK-001'), 'inspect should hide archived TASK-001 by default');
  assert(!inspectOut.includes('PLAN-001'), 'inspect should hide archived PLAN-001 by default');
  assert(!inspectOut.includes('SPEC-001'), 'inspect should hide archived SPEC-001 by default');

  // --- inspect --include-archived shows them ---
  console.log('Testing inspect --include-archived...');
  let inspectOut2 = '';
  console.log = (msg) => { inspectOut2 += msg + '\n'; };
  await inspectCommand({ target: targetDir, workspace: ws, includeArchived: true });
  console.log = origLog2;
  assert(inspectOut2.includes('TASK-001'), 'inspect --include-archived should show archived TASK-001');
  assert(inspectOut2.includes('archived'), 'inspect --include-archived should mark it archived');

  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log('=== COMMANDS TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('Commands test failed:', err);
  process.exit(1);
});
