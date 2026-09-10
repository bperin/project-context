const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// readSheet reads a worksheet into row objects keyed by lowercased headers,
// keeping a reference to the sheet row index for writing back.
async function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return { ws: null, headers: [], rows: [] };

  const headers = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = String(cell.value || '').trim();
  });

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = { _row: r };
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
  return { ws, headers, rows };
}

// colIndex finds the 1-based column index for a header name.
function colIndex(headers, name) {
  return headers.findIndex(h => h.toLowerCase() === name) + 1;
}

// setCell writes a value into a worksheet row by header name.
function setCell(ws, headers, rowNum, header, value) {
  const col = colIndex(headers, header);
  if (col < 1) {
    console.log(`  setCell miss: ${header} not found in headers`);
    return false;
  }
  const row = ws.getRow(rowNum);
  const cell = row.getCell(col);
  cell.value = value;
  return true;
}

function isDone(status) {
  const s = String(status || '').toLowerCase();
  return s === 'done' || s === 'complete';
}

function pct(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// syncCommand recomputes Progress and Status bottom-up:
//   tasks -> plans (Parent column) -> specs (Parent column)
// It does not touch tasks themselves. Specs with zero plans and plans with
// zero tasks are left as stubs/drafts.
async function syncCommand(options) {
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

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);

  const specs = await readSheet(wb, 'Specs');
  const plans = await readSheet(wb, 'Plans');
  const tasks = await readSheet(wb, 'Tasks');

  if (!tasks.ws || !plans.ws || !specs.ws) {
    console.error('overview.xlsx is missing one of the Specs/Plans/Tasks sheets.');
    process.exit(1);
  }

  const warnings = [];
  const changes = [];

  // Orphaned rows: tasks/plans with no Parent set.
  for (const t of tasks.rows) {
    if (!t.parent) warnings.push(`${t.id} has no Parent — not counted toward any plan`);
  }
  for (const p of plans.rows) {
    if (!p.parent) warnings.push(`${p.id} has no Parent — not counted toward any spec`);
  }
  // done tasks missing a commit reference
  for (const t of tasks.rows) {
    if (isDone(t.status) && !t.commit) {
      warnings.push(`${t.id} is done but has no Commit`);
    }
  }

  // --- Tasks -> Plans ---
  const tasksByPlan = {};
  for (const t of tasks.rows) {
    if (!t.parent) continue;
    (tasksByPlan[String(t.parent).trim().toUpperCase()] ||= []).push(t);
  }

  for (const p of plans.rows) {
    const kids = tasksByPlan[String(p.id).toUpperCase()] || [];
    const done = kids.filter(k => isDone(k.status)).length;
    const total = kids.length;

    const newProgress = total === 0
      ? '0% (0 tasks — stub)'
      : `${pct(done, total)}% (${done} of ${total} tasks done)`;

    let newStatus = String(p.status || 'draft');
    if (total === 0) {
      newStatus = 'draft';
    } else if (done === total) {
      newStatus = 'complete';
    } else if (done > 0) {
      newStatus = 'in_progress';
    } else {
      newStatus = 'committed';
    }

    if (String(p.progress) !== newProgress || String(p.status) !== newStatus) {
      changes.push(`${p.id}: ${p.status || '—'} / ${p.progress || '—'} -> ${newStatus} / ${newProgress}`);
      setCell(plans.ws, plans.headers, p._row, 'Status', newStatus);
      setCell(plans.ws, plans.headers, p._row, 'Progress', newProgress);
    }
  }

  // --- Plans -> Specs ---
  const plansBySpec = {};
  for (const p of plans.rows) {
    if (!p.parent) continue;
    (plansBySpec[String(p.parent).trim().toUpperCase()] ||= []).push(p);
  }

  for (const s of specs.rows) {
    const kids = plansBySpec[String(s.id).toUpperCase()] || [];
    const done = kids.filter(k => isDone(k.status)).length;
    const total = kids.length;

    const newProgress = total === 0
      ? '0% (0 plans — stub)'
      : `${pct(done, total)}% (${done} of ${total} plans done)`;

    let newStatus = String(s.status || 'draft');
    if (total > 0 && done === total) {
      newStatus = 'done';
    } else if (done > 0) {
      newStatus = 'in_progress';
    }
    // committed/draft/spec with no completed plans keeps its status.

    if (String(s.progress) !== newProgress || String(s.status) !== newStatus) {
      changes.push(`${s.id}: ${s.status || '—'} / ${s.progress || '—'} -> ${newStatus} / ${newProgress}`);
      setCell(specs.ws, specs.headers, s._row, 'Status', newStatus);
      setCell(specs.ws, specs.headers, s._row, 'Progress', newProgress);
    }
  }

  await wb.xlsx.writeFile(xlsxPath);

  if (warnings.length) {
    console.log('--- Warnings ---');
    for (const w of warnings) console.log(`  ! ${w}`);
    console.log('');
  }
  if (changes.length) {
    console.log('--- Updated ---');
    for (const c of changes) console.log(`  ${c}`);
    console.log('');
  } else {
    console.log('All statuses and progress are already in sync.');
  }
  console.log(`Synced ${xlsxPath}`);
}

module.exports = syncCommand;
