const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// sheetForID picks the right sheet based on the ID prefix.
function sheetForID(id) {
  if (id.toUpperCase().startsWith('SPEC-')) return 'Specs';
  if (id.toUpperCase().startsWith('PLAN-')) return 'Plans';
  if (id.toUpperCase().startsWith('TASK-')) return 'Tasks';
  return null;
}

// nextID finds the highest NNN suffix in a sheet and returns NNN+1 zero-padded.
function nextID(rows, prefix) {
  let max = 0;
  for (const r of rows) {
    const id = String(r.id || '');
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// readSheet reads a worksheet and returns an array of row objects keyed by
// lowercased headers.
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
      if (val && typeof val === 'object' && val.text) val = val.text;
      obj[key.toLowerCase()] = val || '';
      if (val) hasData = true;
    });
    if (hasData) rows.push(obj);
  }
  return rows;
}

// addRow appends a row to a sheet by header name.
async function addRow(xlsxPath, sheetName, data) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found in overview.xlsx`);
  }

  // Read headers
  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  // Check for duplicate ID
  const idCol = headers.findIndex(h => h.toLowerCase() === 'id');
  if (idCol !== -1 && data.id) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const existing = ws.getRow(r).getCell(idCol + 1).value;
      if (existing && String(existing).toUpperCase() === String(data.id).toUpperCase()) {
        throw new Error(`${data.id} already exists in sheet "${sheetName}"`);
      }
    }
  }

  // Build row in header order
  const rowValues = headers.map(h => data[h.toLowerCase()] || '');
  ws.addRow(rowValues);
  await wb.xlsx.writeFile(xlsxPath);
}

// addCommand handles adding a spec, plan, or task row to overview.xlsx.
async function addCommand(options) {
  const { type, title, status, dependencies, skills, triggers, commit, id } = options;

  if (!type || !title) {
    console.error('Usage: project-context add --type <spec|plan|task> --title <title> [options]');
    process.exit(1);
  }

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

  const prefix = type.toUpperCase().startsWith('SPEC-') ? 'SPEC'
    : type.toUpperCase().startsWith('PLAN-') ? 'PLAN'
    : type.toUpperCase().startsWith('TASK-') ? 'TASK'
    : type.toUpperCase() === 'SPEC' ? 'SPEC'
    : type.toUpperCase() === 'PLAN' ? 'PLAN'
    : type.toUpperCase() === 'TASK' ? 'TASK'
    : null;

  if (!prefix) {
    console.error(`Invalid type: ${type}. Use spec, plan, or task.`);
    process.exit(1);
  }

  const sheetName = sheetForID(`${prefix}-001`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const rows = await readSheet(wb, sheetName);

  // Determine the ID
  let finalID = id;
  if (!finalID) {
    finalID = nextID(rows, prefix);
  }

  // Generate UUID deterministically
  const { execSync } = require('child_process');
  let uuid;
  try {
    const cliPath = path.join(__dirname, '..', '..', 'bin', 'cli.js');
    uuid = execSync(`node ${cliPath} uuid ${finalID}`, { encoding: 'utf8' }).trim();
  } catch (e) {
    uuid = '';
  }

  const data = {
    uuid,
    id: finalID,
    title,
    status: status || 'draft',
    parent: options.parent || '',
    dependencies: dependencies || '',
    skills: skills || '',
    triggers: triggers || '',
    commit: commit || '',
  };

  // Plans and Specs have a Progress column
  if (sheetName === 'Specs' || sheetName === 'Plans') {
    data.progress = options.progress || '0%';
  }

  await addRow(xlsxPath, sheetName, data);

  console.log(`Added ${finalID} to ${sheetName}: ${title}`);
  console.log(`  UUID: ${uuid}`);
  console.log(`  Status: ${data.status}`);
  if (data.dependencies) console.log(`  Dependencies: ${data.dependencies}`);
  if (data.skills) console.log(`  Skills: ${data.skills}`);
  if (data.triggers) console.log(`  Triggers: ${data.triggers}`);
  console.log(`  Workbook: ${xlsxPath}`);

  return { id: finalID, uuid };
}

module.exports = addCommand;
