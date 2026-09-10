const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// readSheet reads a worksheet and returns an array of row objects keyed by
// the sheet's headers (lowercased).
async function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return [];

  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let hasData = false;
    row.eachCell((cell, col) => {
      const key = headers[col - 1];
      if (!key) return;
      let val = cell.value;
      // Unwrap hyperlink cell objects { text, hyperlink }
      if (val && typeof val === 'object' && val.text) val = val.text;
      obj[key.toLowerCase()] = val || '';
      if (val) hasData = true;
    });
    if (hasData) rows.push(obj);
  }
  return rows;
}

async function inspectCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  const xlsxPath = path.join(aiDir, 'overview.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.error('overview.xlsx not found. Run init first.');
    process.exit(1);
  }

  console.log(`Inspecting workspace at ${aiDir}...\n`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const sheets = [
    { label: 'SPEC', name: 'Specs' },
    { label: 'PLAN', name: 'Plans' },
    { label: 'TASK', name: 'Tasks' },
  ];

  for (const { label, name } of sheets) {
    const rows = await readSheet(wb, name);
    console.log(`=== ${label}s (${rows.length}) ===`);
    if (rows.length === 0) {
      console.log('  (none)\n');
      continue;
    }
    for (const row of rows) {
      const id = row.id || '?';
      const title = row.title || id;
      const status = row.status || 'unknown';
      const progress = row.progress || '—';
      console.log(`  ${id}  [${status}]  ${title}`);
      if (progress && progress !== '—') {
        console.log(`    Progress: ${progress}`);
      }
    }
    console.log('');
  }

  // Summary counts
  const specs = await readSheet(wb, 'Specs');
  const plans = await readSheet(wb, 'Plans');
  const tasks = await readSheet(wb, 'Tasks');
  const doneTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  console.log('--- Summary ---');
  console.log(`  Specs: ${specs.length}`);
  console.log(`  Plans: ${plans.length}`);
  console.log(`  Tasks: ${tasks.length} (${doneTasks} done)`);
}

module.exports = inspectCommand;
