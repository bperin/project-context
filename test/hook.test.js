const { test } = require('node:test');
const assert = require('node:assert');
const {
  computeNextAction,
  buildContext,
  isDone,
  toolTouchedTaskData,
} = require('../scripts/task-done-hook');
const path = require('path');

// === Fixtures ===

const tasksPlan1 = [
  { id: 'TASK-001', title: 'Task 1', status: 'done', plan: 'PLAN-001' },
  { id: 'TASK-002', title: 'Task 2', status: 'done', plan: 'PLAN-001' },
  { id: 'TASK-003', title: 'Task 3', status: 'committed', plan: 'PLAN-001' },
];

const tasksPlan1AllDone = [
  { id: 'TASK-001', title: 'Task 1', status: 'done', plan: 'PLAN-001' },
  { id: 'TASK-002', title: 'Task 2', status: 'done', plan: 'PLAN-001' },
  { id: 'TASK-003', title: 'Task 3', status: 'done', plan: 'PLAN-001' },
];

const plansSpec1 = [
  { id: 'PLAN-001', title: 'Plan 1', status: 'committed', parent: 'SPEC-001' },
  { id: 'PLAN-002', title: 'Plan 2', status: 'committed', parent: 'SPEC-001' },
];

const plansSpec1AllDone = [
  { id: 'PLAN-001', title: 'Plan 1', status: 'done', parent: 'SPEC-001' },
  { id: 'PLAN-002', title: 'Plan 2', status: 'done', parent: 'SPEC-001' },
];

const specs = [
  { id: 'SPEC-001', title: 'Spec 1', status: 'committed' },
  { id: 'SPEC-002', title: 'Spec 2', status: 'committed' },
];

const specsAllDone = [
  { id: 'SPEC-001', title: 'Spec 1', status: 'done' },
];

// === computeNextAction tests ===

test('computeNextAction: remaining tasks in plan → returns next task', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', plan: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(result.action, /TASK-003/);
  assert.match(result.action, /Task 3/);
  assert.match(result.action, /PLAN-001/);
});

test('computeNextAction: all tasks in plan done, next plan exists → returns next plan', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', plan: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansSpec1, specs);
  assert.match(result.action, /Plan PLAN-001 is complete/);
  assert.match(result.action, /PLAN-002/);
  assert.match(result.action, /Plan 2/);
  assert.match(result.action, /SPEC-001/);
});

test('computeNextAction: all plans in spec done, next spec exists → returns next spec', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', plan: 'PLAN-002' }];
  const tasksAllDone = [
    ...tasksPlan1AllDone,
    { id: 'TASK-004', title: 'Task 4', status: 'done', plan: 'PLAN-002' },
  ];
  const result = computeNextAction(newlyDone, tasksAllDone, plansSpec1AllDone, specs);
  assert.match(result.action, /Spec SPEC-001 is complete/);
  assert.match(result.action, /SPEC-002/);
  assert.match(result.action, /Spec 2/);
});

test('computeNextAction: all specs done → project complete', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', plan: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansSpec1AllDone, specsAllDone);
  assert.match(result.action, /All specs, plans, and tasks are complete/);
  assert.match(result.action, /project is done/);
});

test('computeNextAction: handles multiple newly-done tasks', () => {
  const newlyDone = [
    { id: 'TASK-002', title: 'Task 2', plan: 'PLAN-001' },
    { id: 'TASK-003', title: 'Task 3', plan: 'PLAN-001' },
  ];
  const result = computeNextAction(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(result.action, /TASK-003/);
});

test('computeNextAction: plan with no remaining tasks but plan status not "done" still advances', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', plan: 'PLAN-001' }];
  const plansNotDone = [
    { id: 'PLAN-001', title: 'Plan 1', status: 'committed', parent: 'SPEC-001' },
    { id: 'PLAN-002', title: 'Plan 2', status: 'committed', parent: 'SPEC-001' },
  ];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansNotDone, specs);
  assert.match(result.action, /Plan PLAN-001 is complete/);
  assert.match(result.action, /PLAN-002/);
});

// === buildContext tests ===

test('buildContext: includes next action in output', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', plan: 'PLAN-001' }];
  const ctx = buildContext(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(ctx, /task-done-hook/);
  assert.match(ctx, /TASK-002/);
  assert.match(ctx, /Next action:/);
  assert.match(ctx, /TASK-003/);
});

test('buildContext: includes session rename suggestion', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', plan: 'PLAN-001' }];
  const ctx = buildContext(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(ctx, /Rename this session/);
  assert.match(ctx, /Task 2/);
});

// === isDone tests ===

test('isDone: recognizes done variants', () => {
  assert.strictEqual(isDone('done'), true);
  assert.strictEqual(isDone('complete'), true);
  assert.strictEqual(isDone('completed'), true);
  assert.strictEqual(isDone('DONE'), true);
  assert.strictEqual(isDone(' done '), true);
});

test('isDone: rejects non-done statuses', () => {
  assert.strictEqual(isDone('committed'), false);
  assert.strictEqual(isDone('in_progress'), false);
  assert.strictEqual(isDone('draft'), false);
  assert.strictEqual(isDone(null), false);
  assert.strictEqual(isDone(undefined), false);
  assert.strictEqual(isDone(''), false);
});

// === toolTouchedTaskData tests ===

test('toolTouchedTaskData: write tool matching tasks.jsonl returns true', () => {
  const event = {
    tool_name: 'write',
    tool_input: { file_path: '/foo/.bar-manager/data/tasks.jsonl' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), true);
});

test('toolTouchedTaskData: write tool matching task MD file returns true', () => {
  const event = {
    tool_name: 'write',
    tool_input: { file_path: '/foo/.bar-manager/tasks/TASK-001.md' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), true);
});

test('toolTouchedTaskData: write tool non-matching path returns false', () => {
  const event = {
    tool_name: 'write',
    tool_input: { file_path: '/foo/other.txt' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), false);
});

test('toolTouchedTaskData: exec tool with status command returns true', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'node cli.js status TASK-001 done -t /foo' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), true);
});

test('toolTouchedTaskData: exec tool with tasks.jsonl in command returns true', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'cat /foo/.bar-manager/data/tasks.jsonl' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), true);
});

test('toolTouchedTaskData: exec tool unrelated command returns false', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'npm test' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), false);
});

test('toolTouchedTaskData: unknown tool returns false', () => {
  const event = {
    tool_name: 'read',
    tool_input: { file_path: '/foo/.bar-manager/data/tasks.jsonl' },
  };
  assert.strictEqual(toolTouchedTaskData(event, '/foo/.bar-manager'), false);
});

// === Integration: end-to-end with real JSONL ===

test('getTaskStates: reads tasks from JSONL', async () => {
  const fs = require('fs');
  const os = require('os');
  const { getTaskStates, appendTaskEvent } = require('../src/commands/shared');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  const aiDir = path.join(tmpDir, '.test-manager');

  fs.mkdirSync(path.join(aiDir, 'data'), { recursive: true });

  appendTaskEvent(aiDir, { id: 'TASK-001', event: 'created', title: 'Task 1', plan: 'PLAN-001', status: 'draft' });
  appendTaskEvent(aiDir, { id: 'TASK-001', event: 'done' });
  appendTaskEvent(aiDir, { id: 'TASK-002', event: 'created', title: 'Task 2', plan: 'PLAN-001', status: 'draft' });

  try {
    const states = getTaskStates(aiDir);
    assert.strictEqual(states.size, 2);
    assert.strictEqual(states.get('TASK-001').status, 'done');
    assert.strictEqual(states.get('TASK-001').title, 'Task 1');
    assert.strictEqual(states.get('TASK-001').plan, 'PLAN-001');
    assert.strictEqual(states.get('TASK-002').status, 'draft');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
