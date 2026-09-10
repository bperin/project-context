const { test } = require('node:test');
const assert = require('node:assert');
const {
  computeNextAction,
  buildContext,
  isDone,
  toolTouchedXlsx,
} = require('../scripts/task-done-hook');

// === Fixtures ===

const tasksPlan1 = [
  { id: 'TASK-001', title: 'Task 1', status: 'done', dependencies: 'PLAN-001' },
  { id: 'TASK-002', title: 'Task 2', status: 'done', dependencies: 'PLAN-001' },
  { id: 'TASK-003', title: 'Task 3', status: 'committed', dependencies: 'PLAN-001' },
];

const tasksPlan1AllDone = [
  { id: 'TASK-001', title: 'Task 1', status: 'done', dependencies: 'PLAN-001' },
  { id: 'TASK-002', title: 'Task 2', status: 'done', dependencies: 'PLAN-001' },
  { id: 'TASK-003', title: 'Task 3', status: 'done', dependencies: 'PLAN-001' },
];

const plansSpec1 = [
  { id: 'PLAN-001', title: 'Plan 1', status: 'committed', dependencies: 'SPEC-001', progress: '0%' },
  { id: 'PLAN-002', title: 'Plan 2', status: 'committed', dependencies: 'SPEC-001', progress: '0%' },
];

const plansSpec1AllDone = [
  { id: 'PLAN-001', title: 'Plan 1', status: 'done', dependencies: 'SPEC-001', progress: '100%' },
  { id: 'PLAN-002', title: 'Plan 2', status: 'done', dependencies: 'SPEC-001', progress: '100%' },
];

const specs = [
  { id: 'SPEC-001', title: 'Spec 1', status: 'committed', progress: '0%' },
  { id: 'SPEC-002', title: 'Spec 2', status: 'committed', progress: '0%' },
];

const specsAllDone = [
  { id: 'SPEC-001', title: 'Spec 1', status: 'done', progress: '100%' },
];

// === computeNextAction tests ===

test('computeNextAction: remaining tasks in plan → returns next task', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', dependencies: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(result.action, /TASK-003/);
  assert.match(result.action, /Task 3/);
  assert.match(result.action, /PLAN-001/);
});

test('computeNextAction: all tasks in plan done, next plan exists → returns next plan', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', dependencies: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansSpec1, specs);
  assert.match(result.action, /Plan PLAN-001 is complete/);
  assert.match(result.action, /PLAN-002/);
  assert.match(result.action, /Plan 2/);
  assert.match(result.action, /SPEC-001/);
});

test('computeNextAction: all plans in spec done, next spec exists → returns next spec', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', dependencies: 'PLAN-002' }];
  const tasksAllDone = [
    ...tasksPlan1AllDone,
    { id: 'TASK-004', title: 'Task 4', status: 'done', dependencies: 'PLAN-002' },
  ];
  const result = computeNextAction(newlyDone, tasksAllDone, plansSpec1AllDone, specs);
  assert.match(result.action, /Spec SPEC-001 is complete/);
  assert.match(result.action, /SPEC-002/);
  assert.match(result.action, /Spec 2/);
});

test('computeNextAction: all specs done → project complete', () => {
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', dependencies: 'PLAN-001' }];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansSpec1AllDone, specsAllDone);
  assert.match(result.action, /All specs, plans, and tasks are complete/);
  assert.match(result.action, /project is done/);
});

test('computeNextAction: handles multiple newly-done tasks', () => {
  const newlyDone = [
    { id: 'TASK-002', title: 'Task 2', dependencies: 'PLAN-001' },
    { id: 'TASK-003', title: 'Task 3', dependencies: 'PLAN-001' },
  ];
  const result = computeNextAction(newlyDone, tasksPlan1, plansSpec1, specs);
  // Should still point to the remaining task
  assert.match(result.action, /TASK-003/);
});

test('computeNextAction: plan with no remaining tasks but plan status not "done" still advances', () => {
  // The hook should advance based on task completion, not plan status field.
  // Even if plan status is still "committed", if all tasks are done, advance.
  const newlyDone = [{ id: 'TASK-003', title: 'Task 3', dependencies: 'PLAN-001' }];
  const plansNotDone = [
    { id: 'PLAN-001', title: 'Plan 1', status: 'committed', dependencies: 'SPEC-001' },
    { id: 'PLAN-002', title: 'Plan 2', status: 'committed', dependencies: 'SPEC-001' },
  ];
  const result = computeNextAction(newlyDone, tasksPlan1AllDone, plansNotDone, specs);
  assert.match(result.action, /Plan PLAN-001 is complete/);
  assert.match(result.action, /PLAN-002/);
});

// === buildContext tests ===

test('buildContext: includes next action in output', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', dependencies: 'PLAN-001' }];
  const ctx = buildContext(newlyDone, tasksPlan1, plansSpec1, specs);
  assert.match(ctx, /task-done-hook/);
  assert.match(ctx, /TASK-002/);
  assert.match(ctx, /Next action:/);
  assert.match(ctx, /TASK-003/);
});

test('buildContext: includes session rename suggestion', () => {
  const newlyDone = [{ id: 'TASK-002', title: 'Task 2', dependencies: 'PLAN-001' }];
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

// === toolTouchedXlsx tests ===

test('toolTouchedXlsx: write tool matching path returns true', () => {
  const event = {
    tool_name: 'write',
    tool_input: { file_path: '/foo/overview.xlsx' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), true);
});

test('toolTouchedXlsx: write tool non-matching path returns false', () => {
  const event = {
    tool_name: 'write',
    tool_input: { file_path: '/foo/other.txt' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), false);
});

test('toolTouchedXlsx: exec tool with xlsx path in command returns true', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'node cli.js status TASK-001 done -t /foo' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), true);
});

test('toolTouchedXlsx: exec tool with basename in command returns true', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'cp overview.xlsx backup/' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), true);
});

test('toolTouchedXlsx: exec tool unrelated command returns false', () => {
  const event = {
    tool_name: 'exec',
    tool_input: { command: 'npm test' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), false);
});

test('toolTouchedXlsx: unknown tool returns false', () => {
  const event = {
    tool_name: 'read',
    tool_input: { file_path: '/foo/overview.xlsx' },
  };
  assert.strictEqual(toolTouchedXlsx(event, '/foo/overview.xlsx'), false);
});

// === Integration: end-to-end with a real xlsx ===

test('readWorkbook: reads tasks, plans, specs from xlsx', async () => {
  const ExcelJS = require('exceljs');
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  const xlsxPath = path.join(tmpDir, 'test.xlsx');

  // Build a test workbook
  const wb = new ExcelJS.Workbook();
  const tasksWs = wb.addWorksheet('Tasks');
  tasksWs.columns = [
    { header: 'UUID', key: 'uuid' },
    { header: 'ID', key: 'id' },
    { header: 'Title', key: 'title' },
    { header: 'Status', key: 'status' },
    { header: 'Dependencies', key: 'dependencies' },
  ];
  tasksWs.addRow({ uuid: 'u1', id: 'TASK-001', title: 'Task 1', status: 'done', dependencies: 'PLAN-001' });
  tasksWs.addRow({ uuid: 'u2', id: 'TASK-002', title: 'Task 2', status: 'committed', dependencies: 'PLAN-001' });

  const plansWs = wb.addWorksheet('Plans');
  plansWs.columns = [
    { header: 'UUID', key: 'uuid' },
    { header: 'ID', key: 'id' },
    { header: 'Title', key: 'title' },
    { header: 'Status', key: 'status' },
    { header: 'Progress', key: 'progress' },
    { header: 'Dependencies', key: 'dependencies' },
  ];
  plansWs.addRow({ uuid: 'u3', id: 'PLAN-001', title: 'Plan 1', status: 'committed', progress: '0%', dependencies: 'SPEC-001' });

  const specsWs = wb.addWorksheet('Specs');
  specsWs.columns = [
    { header: 'UUID', key: 'uuid' },
    { header: 'ID', key: 'id' },
    { header: 'Title', key: 'title' },
    { header: 'Status', key: 'status' },
    { header: 'Progress', key: 'progress' },
  ];
  specsWs.addRow({ uuid: 'u4', id: 'SPEC-001', title: 'Spec 1', status: 'committed', progress: '0%' });

  await wb.xlsx.writeFile(xlsxPath);

  try {
    const { readWorkbook } = require('../scripts/task-done-hook');
    const result = await readWorkbook(xlsxPath);
    assert.strictEqual(result.tasks.length, 2);
    assert.strictEqual(result.plans.length, 1);
    assert.strictEqual(result.specs.length, 1);
    assert.strictEqual(result.tasks[0].id, 'TASK-001');
    assert.strictEqual(result.tasks[1].status, 'committed');
    assert.strictEqual(result.plans[0].dependencies, 'SPEC-001');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const path = require('path');
