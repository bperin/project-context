const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ExcelJS = require('exceljs');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');
const contextCommand = require('../src/commands/context');

async function runTests() {
  console.log('Running project-context test suite...');
  const targetDir = path.join('/tmp', 'pc-test-' + Date.now());
  fs.mkdirSync(targetDir, { recursive: true });

  // Create a minimal source file so graph has something to walk
  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), "module.exports = {};\n");

  // --- Test init ---
  console.log('Testing init...');
  const ws = '.test-manager';
  await initCommand({ target: targetDir, workspace: ws, discover: true });
  assert(fs.existsSync(path.join(targetDir, ws, 'AGENTS.md')), 'AGENTS.md missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'specs')), 'specs dir missing');
  assert(fs.existsSync(path.join(targetDir, ws, 'overview.xlsx')), 'overview.xlsx missing');

  // Verify the xlsx has all expected sheets
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const expectedSheets = [
    'Identity', 'Specs', 'Plans', 'Tasks', 'Modules', 'Code Structure',
    'Components', 'Dependencies', 'Data Ownership', 'Realtime   Events   Channels',
    'Deployment', 'Skills', 'Skill Matrix', 'Decisions', 'Workflows',
  ];
  const actualSheets = wb.worksheets.map(ws => ws.name);
  for (const name of expectedSheets) {
    assert(actualSheets.includes(name), `sheet "${name}" missing from overview.xlsx`);
  }

  // Verify custom subagent profiles are copied
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'spec-optimizer.md')), 'spec-optimizer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'plan-optimizer.md')), 'plan-optimizer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'task-optimizer.md')), 'task-optimizer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'reviewer.md')), 'reviewer agent profile missing');
  assert(fs.existsSync(path.join(targetDir, ws, '.agents', 'agents', 'code-optimizer.md')), 'code-optimizer agent profile missing');
  console.log('Testing graph...');
  await graphCommand({ target: targetDir, workspace: ws });
  assert(fs.existsSync(path.join(targetDir, ws, 'graph', 'nodes')), 'graph nodes missing');
  const nodeFiles = fs.readdirSync(path.join(targetDir, ws, 'graph', 'nodes'));
  assert(nodeFiles.length > 0, 'graph generated no nodes');

  // --- Test overview (refreshes Workflows sheet) ---
  console.log('Testing overview...');
  await overviewCommand({ target: targetDir, workspace: ws });
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const wfSheet = wb2.getWorksheet('Workflows');
  assert(wfSheet, 'Workflows sheet missing after overview');
  assert(wfSheet.rowCount > 1, 'Workflows sheet has no data rows');

  // --- Test inspect (reads from xlsx) ---
  console.log('Testing inspect...');
  const wb3 = new ExcelJS.Workbook();
  await wb3.xlsx.readFile(path.join(targetDir, ws, 'overview.xlsx'));
  const specs = wb3.getWorksheet('Specs');
  specs.spliceRows(2, specs.rowCount);
  specs.addRow(['uuid-001', 'SPEC-001', 'Test Spec', 'committed', '0%', 'none', '', '', '']);
  const plans = wb3.getWorksheet('Plans');
  plans.spliceRows(2, plans.rowCount);
  plans.addRow(['uuid-plan', 'PLAN-001', 'Test Plan', 'committed', '0%', 'SPEC-001', 'go-crypto', 'crypto', '']);
  const tasks = wb3.getWorksheet('Tasks');
  tasks.spliceRows(2, tasks.rowCount);
  tasks.addRow(['uuid-002', 'TASK-001', 'Test Task', 'committed', 'PLAN-001', '', '', 'ed25519', '']);

  const identity = wb3.getWorksheet('Identity');
  for (let r = 2; r <= identity.rowCount; r++) {
    const row = identity.getRow(r);
    const field = String(row.getCell(1).value || '').trim().toLowerCase();
    if (field === 'primary language' || field === 'stack') {
      row.getCell(2).value = 'Go';
    }
  }

  // Clear seeded skill rows and populate test layers
  const skills = wb3.getWorksheet('Skills');
  skills.spliceRows(2, skills.rowCount);
  skills.addRow(['go-systems-programmer', 'user-level', 'always-on', 'all', 'Base Go style']);
  skills.addRow(['project-linter', 'user-level', 'project-local', 'all', 'Base project lint']);
  skills.addRow(['security-check', 'user-level', 'user-local', 'security', 'Security guardrails']);
  skills.addRow(['ed25519-user', 'user-level', 'user-local', 'ed25519', 'Ed25519 user helper']);
  const matrix = wb3.getWorksheet('Skill Matrix');
  matrix.spliceRows(2, matrix.rowCount);
  matrix.addRow(['ed25519', 'Go', 'ed25519-skill', 'wycheproof, crypto', 'Ed25519 implementation']);

  await wb3.xlsx.writeFile(path.join(targetDir, ws, 'overview.xlsx'));

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
