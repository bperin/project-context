const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ExcelJS = require('exceljs');
const initCommand = require('../src/commands/init');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const uuidCommand = require('../src/commands/uuid');
const contextCommand = require('../src/commands/context');

async function runTests() {
  console.log('=== RUNNING COMMANDS TESTS ===');
  const targetDir = path.join('/tmp', 'pc-cmd-' + Date.now());
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), "module.exports = {};\n");
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
  const spec = addCommand({ type: 'spec', title: 'Test Spec', target: targetDir, workspace: ws });
  assert.strictEqual(spec.id, 'SPEC-002', 'wrong spec id');
  assert(spec.uuid, 'spec uuid missing');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const specs = wb.getWorksheet('Specs');
  assert(specs.rowCount === 2, 'expected 2 spec rows (1 seeded + 1 added)');
  const specRow = specs.getRow(2);
  assert.strictEqual(specRow.getCell(2).value, 'SPEC-002');

  // --- add plan ---
  console.log('Testing add plan...');
  const plan = addCommand({ type: 'plan', title: 'Test Plan', target: targetDir, workspace: ws });
  assert.strictEqual(plan.id, 'PLAN-002');
  assert(plan.uuid, 'plan uuid missing');
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const plans = wb2.getWorksheet('Plans');
  const planRow = plans.getRow(2);
  assert.strictEqual(planRow.getCell(2).value, 'PLAN-002');
  assert.strictEqual(planRow.getCell(6).value, 'SPEC-001', 'plan dependency not set');

  // --- add task ---
  console.log('Testing add task...');
  const task = addCommand({ type: 'task', title: 'Test Task', target: targetDir, workspace: ws });
  assert.strictEqual(task.id, 'TASK-002');
  assert(task.uuid, 'task uuid missing');
  const wb3 = new ExcelJS.Workbook();
  await wb3.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const tasks = wb3.getWorksheet('Tasks');
  const taskRow = tasks.getRow(2);
  assert.strictEqual(taskRow.getCell(2).value, 'TASK-002');
  assert.strictEqual(taskRow.getCell(6).value, 'PLAN-001', 'task dependency not set');

  // --- status ---
  console.log('Testing status...');
  const updated = setStatusCommand({ id: 'TASK-002', status: 'implementing', target: targetDir, workspace: ws });
  assert.strictEqual(updated.status, 'implementing');
  const wb4 = new ExcelJS.Workbook();
  await wb4.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const tasks4 = wb4.getWorksheet('Tasks');
  const taskRow2 = tasks4.getRow(2);
  assert.strictEqual(taskRow2.getCell(5).value, 'implementing');

  // --- context packet ---
  console.log('Testing context...');
  let output = '';
  const originalLog = console.log;
  console.log = (msg) => { output += msg + '\n'; };
  await contextCommand({ target: targetDir, workspace: ws, id: 'TASK-002' });
  console.log = originalLog;
  const packet = JSON.parse(output.trim());
  assert.strictEqual(packet.target.id, 'TASK-002');
  assert.strictEqual(packet.parent.id, 'PLAN-001');
  assert.strictEqual(packet.grandparent.id, 'SPEC-001');
  assert(Array.isArray(packet.allSkills));

  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log('=== COMMANDS TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('Commands test failed:', err);
  process.exit(1);
});
