const fs = require('fs');
const path = require('path');

async function overviewCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Generating overview CSV from workspace at ${aiDir}...`);

  const sections = [
    { type: 'SPEC', dir: path.join(aiDir, 'context', 'specs') },
    { type: 'PLAN', dir: path.join(aiDir, 'context', 'plans') },
    { type: 'TASK', dir: path.join(aiDir, 'context', 'tasks') }
  ];

  const csvRows = ['Type,ID,Title,Status,Progress,Dependencies,Notes'];

  for (const { type, dir } of sections) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.includes('template'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      
      // Extract ID from filename (e.g. SPEC-001.md -> SPEC-001)
      const id = path.basename(file, '.md');

      // Extract Title
      const titleMatch = content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1].replace(/"/g, '""') : id;

      // Extract Status
      let status = 'draft';
      const statusSectionMatch = content.match(/##\s+Status[\r\n]+([\s\S]*?)(?=##|$)/i);
      if (statusSectionMatch) {
        const lines = statusSectionMatch[1].split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('<!--')) continue;
          // Match "- **Status**: value" or "Status: value"
          const m = trimmed.match(/\*\*Status\*\*[:\s]+`?([a-z_]+)`?/i);
          if (m) { status = m[1]; break; }
          // Fallback: first word after stripping bullets
          const cleaned = trimmed.replace(/^[-*]\s*/, '').replace(/`/g, '');
          if (cleaned) { status = cleaned.split(/\s+/)[0]; break; }
        }
      }

      // Extract Progress
      const progressMatch = content.match(/\*\*Progress\*\*[:\s]+(.*)/i);
      const progress = progressMatch ? progressMatch[1].trim().replace(/"/g, '""') : '—';

      // Extract Dependencies
      const depsMatch = content.match(/\*\*Dependencies\*\*[:\s]+(.*)/i);
      const deps = depsMatch ? depsMatch[1].trim().replace(/"/g, '""') : 'none';

      // Extract Commit (for done tasks)
      let commit = '—';
      const commitMatch = content.match(/\*\*Commit\*\*[:\s]+([0-9a-f]{7,40})/i);
      if (commitMatch) commit = commitMatch[1];

      const notes = commit;

      csvRows.push(`${type},${id},"${title}",${status},"${progress}","${deps}","${notes}"`);
    }
  }

  const csvContent = csvRows.join('\n') + '\n';
  const stateDir = path.join(aiDir, 'context', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  
  const csvPath = path.join(stateDir, 'overview.csv');
  fs.writeFileSync(csvPath, csvContent);

  console.log(`Overview CSV generated at ${csvPath}`);
}

module.exports = overviewCommand;
