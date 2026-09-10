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

  const sheetLabels = {
    Specs: 'SPEC',
    Plans: 'PLAN',
    Tasks: 'TASK',
  };
  const allRows = [];
  for (const [name, label] of Object.entries(sheetLabels)) {
    const rows = await readSheet(wb, name);
    for (const row of rows) {
      allRows.push({ ...row, _type: label });
    }
  }

  if (allRows.length === 0) {
    console.log('  (no specs, plans, or tasks)\n');
  } else {
    // Compute column widths
    const cols = ['Type', 'ID', 'Title', 'Status', 'Progress', 'Dependencies', 'Skills', 'Triggers'];
    const keys = ['_type', 'id', 'title', 'status', 'progress', 'dependencies', 'skills', 'triggers'];
    const widths = cols.map(c => c.length);
    for (const row of allRows) {
      for (let i = 0; i < keys.length; i++) {
        const val = String(row[keys[i]] || '—');
        widths[i] = Math.max(widths[i], val.length);
      }
    }

    // Print table header
    console.log('  ' + cols.map((c, i) => c.padEnd(widths[i])).join('  '));
    console.log('  ' + cols.map((_, i) => '─'.repeat(widths[i])).join('  '));

    // Print rows
    for (const row of allRows) {
      const line = cols.map((_, i) => {
        const val = String(row[keys[i]] || '—');
        return val.padEnd(widths[i]);
      }).join('  ');
      console.log('  ' + line);
    }
    console.log('');
  }

  // Summary counts
  const specs = await readSheet(wb, 'Specs');
  const plans = await readSheet(wb, 'Plans');
  const tasks = await readSheet(wb, 'Tasks');
  const doneTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  console.log('--- Summary ---');
  console.log(`  Specs: ${specs.length}  |  Plans: ${plans.length}  |  Tasks: ${tasks.length} (${doneTasks} done)`);
}

module.exports = inspectCommand;
