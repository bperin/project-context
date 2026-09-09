const fs = require('fs');
const path = require('path');

// parseFile reads a markdown context file and extracts its metadata.
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const id = path.basename(filePath, '.md');

  const titleMatch = content.match(/^#\s+(.*)/m);
  const title = titleMatch ? titleMatch[1].replace(/"/g, '""') : id;

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
  const progress = progressMatch ? progressMatch[1].trim().replace(/"/g, '""') : '—';

  const depsMatch = content.match(/\*\*Dependencies\*\*[:\s]+(.*)/i);
  const deps = depsMatch ? depsMatch[1].trim().replace(/"/g, '""') : 'none';

  let commit = '—';
  const commitMatch = content.match(/\*\*Commit\*\*[:\s]+([0-9a-f]{7,40})/i);
  if (commitMatch) commit = commitMatch[1];

  return { id, title, status, progress, deps, commit };
}

// collectFiles reads all non-template .md files from a directory.
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.includes('template'))
    .sort()
    .map(f => parseFile(path.join(dir, f)));
}

// writeCSV writes rows to a CSV file with a header row.
function writeCSV(filePath, header, rows) {
  const content = [header, ...rows].join('\n') + '\n';
  fs.writeFileSync(filePath, content);
  return rows.length;
}

async function overviewCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Generating overview CSVs from workspace at ${aiDir}...`);

  const stateDir = path.join(aiDir, 'context', 'state');
  fs.mkdirSync(stateDir, { recursive: true });

  const specs = collectFiles(path.join(aiDir, 'context', 'specs'));
  const plans = collectFiles(path.join(aiDir, 'context', 'plans'));
  const tasks = collectFiles(path.join(aiDir, 'context', 'tasks'));

  // specs.csv — ID,Title,Status,Progress,Dependencies,Commit
  const specsRows = specs.map(r =>
    `${r.id},"${r.title}",${r.status},"${r.progress}","${r.deps}",${r.commit}`);
  writeCSV(
    path.join(stateDir, 'specs.csv'),
    'ID,Title,Status,Progress,Dependencies,Commit',
    specsRows
  );

  // plans.csv — ID,Title,Status,Progress,Dependencies,Commit
  const plansRows = plans.map(r =>
    `${r.id},"${r.title}",${r.status},"${r.progress}","${r.deps}",${r.commit}`);
  writeCSV(
    path.join(stateDir, 'plans.csv'),
    'ID,Title,Status,Progress,Dependencies,Commit',
    plansRows
  );

  // tasks.csv — ID,Title,Status,Dependencies,Commit
  const tasksRows = tasks.map(r =>
    `${r.id},"${r.title}",${r.status},"${r.deps}",${r.commit}`);
  writeCSV(
    path.join(stateDir, 'tasks.csv'),
    'ID,Title,Status,Dependencies,Commit',
    tasksRows
  );

  console.log(`  specs.csv: ${specs.length} rows`);
  console.log(`  plans.csv: ${plans.length} rows`);
  console.log(`  tasks.csv: ${tasks.length} rows`);
}

module.exports = overviewCommand;
