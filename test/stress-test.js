const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ExcelJS = require('exceljs');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');

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
  assert(fs.existsSync(path.join(dir1, ws1, 'overview.xlsx')));

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
  assert(fs.existsSync(path.join(dir2, ws2, 'overview.xlsx')));

  // Scenario 3: Populating xlsx with specs/plans/tasks and testing inspect + overview
  const dir3 = path.join('/tmp', 'stress-full-' + Date.now());
  fs.mkdirSync(dir3, { recursive: true });
  const ws3 = '.full-manager';
  await initCommand({ target: dir3, workspace: ws3, discover: false });

  const xlsxPath = path.join(dir3, ws3, 'overview.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  wb.getWorksheet('Specs').addRow(['uuid-001', 'SPEC-001', 'Core Engine', 'committed', '50% (1/2 plans done)', 'none', '', '']);
  wb.getWorksheet('Plans').addRow(['uuid-002', 'PLAN-001', 'Database Layer', 'in_progress', '60% (3/5 tasks done)', 'SPEC-001', '', '']);
  wb.getWorksheet('Tasks').addRow(['uuid-003', 'TASK-001', 'Connection Pool', 'done', 'none', '', 'abc1234']);
  await wb.xlsx.writeFile(xlsxPath);

  console.log('[Scenario 3] Testing inspect and overview with xlsx data...');
  await inspectCommand({ target: dir3, workspace: ws3 });
  await overviewCommand({ target: dir3, workspace: ws3 });

  // Verify the xlsx still has our data after overview (overview only refreshes Workflows)
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(xlsxPath);
  const specsSheet = wb2.getWorksheet('Specs');
  assert(specsSheet.rowCount > 1, 'Specs sheet lost data after overview');
  const tasksSheet = wb2.getWorksheet('Tasks');
  assert(tasksSheet.rowCount > 1, 'Tasks sheet lost data after overview');

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
