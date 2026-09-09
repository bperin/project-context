const fs = require('fs');
const path = require('path');

async function inspectCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Inspecting workspace at ${aiDir}...\n`);

  const subdirs = [
    { type: 'SPEC', dir: path.join(aiDir, 'context', 'specs') },
    { type: 'PLAN', dir: path.join(aiDir, 'context', 'plans') },
    { type: 'TASK', dir: path.join(aiDir, 'context', 'tasks') }
  ];

  for (const { type, dir } of subdirs) {
    console.log(`=== ${type}s ===`);
    if (!fs.existsSync(dir)) {
      console.log(`  (directory not found)\n`);
      continue;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.includes('template'));
    if (files.length === 0) {
      console.log(`  No ${type.toLowerCase()} files found.`);
    }

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const titleMatch = content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1] : file;
      
      const statusMatch = content.match(/status[:\s]+([a-z_]+)/i) || content.match(/Status\n-+\n([a-z_]+)/i) || content.match(/Status:\s*`?([a-z_]+)`?/i);
      // Let's parse status from ## Status section more reliably
      let status = 'unknown';
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

      console.log(`  - [${file}] ${title}`);
      console.log(`    Status: ${status} | Progress: ${progress}`);
    }
    console.log('');
  }
}

module.exports = inspectCommand;
