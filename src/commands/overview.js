const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

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

  // Read UUID from the file (written by init or backfill)
  let uuid = '';
  const uuidMatch = content.match(/\*\*UUID\*\*[:\s]+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) uuid = uuidMatch[1];

  // Extract description (Goal for tasks, What for specs, Objective for plans)
  let description = '';
  const descMatch = content.match(/##\s+(?:Goal|What|Objective)[\r\n]+([\s\S]*?)(?=##|$)/i);
  if (descMatch) {
    description = descMatch[1].trim().split('\n').map(l => l.trim()).filter(l => l).join(' ');
  }

  // Extract acceptance criteria (tasks) / success criteria (specs) / completion criteria (plans)
  let criteria = '';
  const critMatch = content.match(/##\s+(?:Acceptance Criteria|Success Criteria|Completion Criteria)[\r\n]+([\s\S]*?)(?=##|$)/i);
  if (critMatch) {
    criteria = critMatch[1].trim().split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(l => l)
      .join('; ');
  }

  // Extract files (tasks only)
  let files = '';
  const filesMatch = content.match(/##\s+Relevant Files[\r\n]+([\s\S]*?)(?=##|$)/i);
  if (filesMatch) {
    files = filesMatch[1].match(/[-*]\s+(`[^`]+`)/g) || [];
    files = files.map(f => f.replace(/[-*]\s+/, '').replace(/`/g, '')).join(', ');
  }

  // Extract scope (specs only)
  let scope = '';
  const scopeMatch = content.match(/##\s+Scope[\r\n]+([\s\S]*?)(?=##|$)/i);
  if (scopeMatch) {
    scope = scopeMatch[1].trim().split('\n').map(l => l.trim()).filter(l => l).join(' ');
  }

  return { id, uuid, title, status, progress, deps, commit, description, criteria, files, scope };
}

// parseIdentity reads the project identity markdown file.
function parseIdentity(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const fields = {};
  for (const line of content.split('\n')) {
    const m = line.match(/-\s+\*\*([^*]+)\*\*[:\s]+(.*)/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

// parseMarkdownTables reads all markdown tables from a file and returns
// them as { heading: { headers: [], rows: [[]] } }.
function parseMarkdownTables(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const tables = [];
  let currentHeading = '';
  let inTable = false;
  let headers = [];
  let rows = [];

  for (const line of content.split('\n')) {
    if (line.startsWith('#')) {
      if (inTable && rows.length > 0) {
        tables.push({ heading: currentHeading, headers, rows });
      }
      currentHeading = line.replace(/^#+\s*/, '').trim();
      inTable = false;
      headers = [];
      rows = [];
      continue;
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (!inTable) {
        headers = cells;
        inTable = true;
      } else if (cells.every(c => /^[-:]+$/.test(c))) {
        // separator row, skip
        continue;
      } else {
        rows.push(cells);
      }
    } else if (inTable) {
      if (rows.length > 0) {
        tables.push({ heading: currentHeading, headers, rows });
      }
      inTable = false;
      headers = [];
      rows = [];
    }
  }
  if (inTable && rows.length > 0) {
    tables.push({ heading: currentHeading, headers, rows });
  }
  return tables;
}

// parseDecisions reads the ADR index table from DECISIONS.md.
function parseDecisions(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  let inTable = false;
  for (const line of content.split('\n')) {
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (!inTable) {
        inTable = true;
        continue; // header row
      }
      if (cells.every(c => /^[-:]+$/.test(c))) continue; // separator
      rows.push(cells);
    } else if (inTable) {
      break;
    }
  }
  return rows;
}

// parseWorkflows reads all workflow .md files and extracts name, trigger, and path.
function parseWorkflows(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.includes('template'))
    .sort()
    .map(f => {
      const fp = path.join(dir, f);
      const content = fs.readFileSync(fp, 'utf8');
      const titleMatch = content.match(/^#\s+(.*)/m);
      let title = titleMatch ? titleMatch[1].replace(/^Workflow:\s*/, '') : f;
      title = title.replace(/[—–]/g, '-');

      let trigger = '';
      const whenMatch = content.match(/##\s+When[\r\n]+([\s\S]*?)(?=##|$)/i);
      if (whenMatch) {
        const lines = whenMatch[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('<!--'));
        trigger = lines.join(' ').slice(0, 200);
      }

      return { file: f, title, trigger };
    });
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
          cell.value = {
            text: hash,
            hyperlink: url,
          };
          cell.style.font = { color: { argb: 'FF0563C1' }, underline: true };
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

  console.log(`Updating overview spreadsheet at ${aiDir}...`);

  const stateDir = path.join(aiDir, 'context', 'state');
  fs.mkdirSync(stateDir, { recursive: true });

  // Get repo URL for commit hyperlinks
  let repoUrl = '';
  try {
    repoUrl = require('child_process')
      .execSync('git remote get-url origin', { cwd: targetDir, encoding: 'utf8' })
      .trim();
  } catch (e) {
    // No git remote — skip hyperlinks
  }

  const xlsxPath = path.join(stateDir, 'overview.xlsx');

  // If no existing xlsx, error — the xlsx is the source of truth now
  if (!fs.existsSync(xlsxPath)) {
    console.error('overview.xlsx not found. The xlsx is the source of truth — create it first or restore from git.');
    process.exit(1);
  }

  // Load existing workbook — preserve all sheets
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);
  workbook.creator = 'project-context';
  workbook.created = new Date();

  let workflowCount = 0;

  // Update Workflows sheet from workflow markdown files (these still exist as .md)
  const workflowsDir = path.join(aiDir, 'context', 'workflows');
  const workflows = parseWorkflows(workflowsDir);
  if (workflows.length > 0) {
    // Remove existing Workflows sheet if present
    const existingWs = workbook.getWorksheet('Workflows');
    if (existingWs) workbook.removeWorksheet(existingWs.id);

    const workflowRows = workflows.map(w => {
      let link = '';
      if (repoUrl) {
        const m = repoUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(\.git)?$/);
        if (m) link = `https://github.com/${m[1]}/blob/dev/${options.workspace}/context/workflows/${w.file}`;
      }
      return [w.file, w.title, w.trigger, link];
    });
    addSheet(workbook, 'Workflows', [
      { header: 'File', key: 'file', width: 28 },
      { header: 'Title', key: 'title', width: 35 },
      { header: 'Trigger', key: 'trigger', width: 60 },
      { header: 'Link', key: 'link', width: 50 },
    ], workflowRows, repoUrl);
    workflowCount = workflows.length;
  }

  await workbook.xlsx.writeFile(xlsxPath);

  const sheetNames = workbook.worksheets.map(ws => ws.name).join(', ');
  console.log(`  Sheets: ${sheetNames}`);
  console.log(`  Workflows refreshed: ${workflowCount}`);
  console.log(`  All other sheets preserved from existing xlsx (xlsx is source of truth)`);
  if (repoUrl) console.log(`  Commit links: ${commitUrl(repoUrl, 'HASH')}`);
}

module.exports = overviewCommand;
