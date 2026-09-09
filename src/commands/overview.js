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

async function overviewCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Generating overview CSV from workspace at ${aiDir}...`);

  const specs  = collectFiles(path.join(aiDir, 'context', 'specs'));
  const plans  = collectFiles(path.join(aiDir, 'context', 'plans'));
  const tasks  = collectFiles(path.join(aiDir, 'context', 'tasks'));

  const lines = [];

  // --- SPECS sheet ---
  lines.push('# SPECS');
  lines.push('ID,Title,Status,Progress,Dependencies,Commit');
  for (const r of specs) {
    lines.push(`${r.id},"${r.title}",${r.status},"${r.progress}","${r.deps}",${r.commit}`);
  }

  // --- PLANS sheet ---
  lines.push('');
  lines.push('# PLANS');
  lines.push('ID,Title,Status,Progress,Dependencies,Commit');
  for (const r of plans) {
    lines.push(`${r.id},"${r.title}",${r.status},"${r.progress}","${r.deps}",${r.commit}`);
  }

  // --- TASKS sheet ---
  lines.push('');
  lines.push('# TASKS');
  lines.push('ID,Title,Status,Dependencies,Commit');
  for (const r of tasks) {
    lines.push(`${r.id},"${r.title}",${r.status},"${r.deps}",${r.commit}`);
  }

  const csvContent = lines.join('\n') + '\n';
  const stateDir = path.join(aiDir, 'context', 'state');
  fs.mkdirSync(stateDir, { recursive: true });

  const csvPath = path.join(stateDir, 'overview.csv');
  fs.writeFileSync(csvPath, csvContent);

  console.log(`Overview CSV generated at ${csvPath}`);
  console.log(`  ${specs.length} specs, ${plans.length} plans, ${tasks.length} tasks`);
}

module.exports = overviewCommand;
