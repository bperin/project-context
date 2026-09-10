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

async function setStatusCommand(options) {
  const { id, status } = options;
  if (!id || !status) {
    console.error('Usage: project-context status <ID> <status>');
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

  const sheetName = sheetForID(id);
  if (!sheetName) {
    console.error(`Could not determine sheet for ID: ${id}. Use SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    console.error(`Sheet "${sheetName}" not found in overview.xlsx.`);
    process.exit(1);
  }

  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  let found = false;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let rowId = '';
    let statusCol = -1;
    let idCol = -1;
    row.eachCell((cell, col) => {
      const header = headers[col - 1];
      if (header && header.toLowerCase() === 'id') {
        idCol = col;
        rowId = cell.value ? String(cell.value).toUpperCase() : '';
      }
      if (header && header.toLowerCase() === 'status') {
        statusCol = col;
      }
    });
    if (idCol !== -1 && statusCol !== -1 && rowId === id.toUpperCase()) {
      row.getCell(statusCol).value = status;
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`ID "${id}" not found in sheet "${sheetName}".`);
    process.exit(1);
  }

  await wb.xlsx.writeFile(xlsxPath);
  console.log(`Updated ${id} status to "${status}" in ${xlsxPath}`);
}

module.exports = setStatusCommand;
