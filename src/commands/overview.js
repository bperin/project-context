const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  readIdentity,
  readSkills,
  writeJSON,
  readJSON,
} = require('./shared');

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

async function overviewCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Updating project overview at ${aiDir}...`);

  // Read current state from JSONL and MD files
  const specs = readSpecs(aiDir);
  const plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);
  const tasks = taskFiles.map(tf => {
    const state = taskStates.get(tf.id);
    return state ? { ...tf, status: state.status } : tf;
  });

  // Update workflows.json from workflow markdown files
  const workflowsDir = path.join(aiDir, 'workflows');
  const workflows = parseWorkflows(workflowsDir);
  if (workflows.length > 0) {
    writeJSON(path.join(aiDir, 'data', 'workflows.json'), { workflows });
  }

  // Print summary
  const doneTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  const inProgressTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'in_progress').length;

  console.log(`\n--- Project Overview ---`);
  console.log(`  Specs: ${specs.length}`);
  for (const s of specs) {
    console.log(`    ${s.id} [${s.status}] ${s.title}`);
  }
  console.log(`  Plans: ${plans.length}`);
  for (const p of plans) {
    console.log(`    ${p.id} [${p.status}] ${p.title}`);
  }
  console.log(`  Tasks: ${tasks.length} (${doneTasks} done, ${inProgressTasks} in progress)`);
  for (const t of tasks) {
    console.log(`    ${t.id} [${t.status}] ${t.title}`);
  }
  console.log(`\n  Workflows refreshed: ${workflows.length}`);
  console.log(`  Data files: ${path.join(aiDir, 'data')}/`);
}

module.exports = overviewCommand;
