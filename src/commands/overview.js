const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { v5: uuidv5 } = require('uuid');

// Namespace for deterministic UUIDs (v5). Generated once, fixed forever.
// This is the UUID for the string "project-context" in the nil namespace.
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace

// parseFile reads a markdown context file and extracts its metadata.
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const id = path.basename(filePath, '.md');

  const titleMatch = content.match(/^#\s+(.*)/m);
  let title = titleMatch ? titleMatch[1] : id;
  // Replace em-dash and en-dash with regular hyphen for clean display
  title = title.replace(/[—–]/g, '-');

  let status = 'draft';
  const statusSectionMatch = content.match(/##\s+Status[\r\n]+([\s\S]*?)(?=##|$)/i);
  if (statusSectionMatch) {
    const lines = statusSectionMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('<!--')) continue;
      const m = trimmed.match(/\*\*Status\*\*[:\s]+`?([a-z_]+)`?/i);
      if (m) { status = m[1]; break; }
      const cleaned = trimmed.replace(/^[-*]\s*/, '').replace(/`/g, '');
      if (cleaned) { status = cleaned.split(/\s+/)[0]; break; }
    }
  }

  const progressMatch = content.match(/\*\*Progress\*\*[:\s]+(.*)/i);
  const progress = progressMatch ? progressMatch[1].trim() : '—';

  const depsMatch = content.match(/\*\*Dependencies\*\*[:\s]+(.*)/i);
  const deps = depsMatch ? depsMatch[1].trim() : 'none';

  let commit = '';
  const commitMatch = content.match(/\*\*Commit\*\*[:\s]+([0-9a-f]{7,40})/i);
  if (commitMatch) commit = commitMatch[1];

  // Deterministic UUID from the ID — same ID always produces same UUID
  const uuid = uuidv5(id, NAMESPACE);

  return { id, uuid, title, status, progress, deps, commit };
}

// collectFiles reads all non-template .md files from a directory, sorted.
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.includes('template'))
    .sort()
    .map(f => parseFile(path.join(dir, f)));
}

// statusColor returns the fill color for a status value.
function statusColor(status) {
  switch (status) {
    case 'done':
    case 'complete':
      return { fg: 'C6EFCE', font: '006100' }; // green
    case 'in_progress':
      return { fg: 'FFEB9C', font: '9C5700' }; // yellow
    case 'committed':
      return { fg: 'BDD7EE', font: '1F4E79' }; // blue
    case 'draft':
      return { fg: 'D9D9D9', font: '595959' }; // gray
    case 'blocked':
      return { fg: 'FFC7CE', font: '9C0006' }; // red
    default:
      return { fg: 'D9D9D9', font: '595959' };
  }
}

// commitUrl builds a GitHub commit URL from a short hash.
function commitUrl(repoUrl, hash) {
  if (!hash) return '';
  // Convert git@github.com:owner/repo.git to https://github.com/owner/repo
  const m = repoUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
  if (!m) return '';
  return `https://github.com/${m[1]}/commit/${hash}`;
}

// addSheet creates a styled worksheet in the workbook.
function addSheet(workbook, name, columns, rows, repoUrl) {
  const ws = workbook.addWorksheet(name);

  // Define columns
  ws.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || 20,
  }));

  // Style header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  rows.forEach((row, idx) => {
    const excelRow = ws.addRow(row);
    excelRow.height = 18;

    // Color the Status column
    const statusCol = columns.findIndex(c => c.key === 'status');
    if (statusCol >= 0) {
      const statusVal = row[statusCol];
      const color = statusColor(statusVal);
      const cell = excelRow.getCell(statusCol + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color.fg } };
      cell.font = { color: { argb: 'FF' + color.font } };
    }

    // Hyperlink the Commit column
    const commitCol = columns.findIndex(c => c.key === 'commit');
    if (commitCol >= 0 && repoUrl) {
      const hash = row[commitCol];
      if (hash) {
        const url = commitUrl(repoUrl, hash);
        if (url) {
          const cell = excelRow.getCell(commitCol + 1);
          cell.value = { text: hash, hyperlink: url };
          cell.font = { color: { argb: 'FF0563C1' }, underline: true };
        }
      }
    }
  });

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

async function overviewCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Generating overview spreadsheet from workspace at ${aiDir}...`);

  const stateDir = path.join(aiDir, 'context', 'state');
  fs.mkdirSync(stateDir, { recursive: true });

  const specs = collectFiles(path.join(aiDir, 'context', 'specs'));
  const plans = collectFiles(path.join(aiDir, 'context', 'plans'));
  const tasks = collectFiles(path.join(aiDir, 'context', 'tasks'));

  // Get repo URL for commit hyperlinks
  let repoUrl = '';
  try {
    repoUrl = require('child_process')
      .execSync('git remote get-url origin', { cwd: targetDir, encoding: 'utf8' })
      .trim();
  } catch (e) {
    // No git remote — skip hyperlinks
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'project-context';
  workbook.created = new Date();

  // Specs sheet
  addSheet(workbook, 'Specs', [
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Progress', key: 'progress', width: 28 },
    { header: 'Dependencies', key: 'deps', width: 30 },
    { header: 'Commit', key: 'commit', width: 12 },
  ], specs.map(r => [r.uuid, r.id, r.title, r.status, r.progress, r.deps, r.commit]), repoUrl);

  // Plans sheet
  addSheet(workbook, 'Plans', [
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Progress', key: 'progress', width: 28 },
    { header: 'Dependencies', key: 'deps', width: 30 },
    { header: 'Commit', key: 'commit', width: 12 },
  ], plans.map(r => [r.uuid, r.id, r.title, r.status, r.progress, r.deps, r.commit]), repoUrl);

  // Tasks sheet
  addSheet(workbook, 'Tasks', [
    { header: 'UUID', key: 'uuid', width: 38 },
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Dependencies', key: 'deps', width: 40 },
    { header: 'Commit', key: 'commit', width: 12 },
  ], tasks.map(r => [r.uuid, r.id, r.title, r.status, r.deps, r.commit]), repoUrl);

  const xlsxPath = path.join(stateDir, 'overview.xlsx');
  await workbook.xlsx.writeFile(xlsxPath);

  console.log(`  overview.xlsx: ${specs.length} specs, ${plans.length} plans, ${tasks.length} tasks`);
  console.log(`  Sheets: Specs, Plans, Tasks`);
  console.log(`  Status colors: green=done, yellow=in_progress, gray=draft, blue=committed`);
  if (repoUrl) console.log(`  Commit links: ${commitUrl(repoUrl, 'HASH')}`);
}

module.exports = overviewCommand;
