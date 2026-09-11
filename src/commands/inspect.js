const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
} = require('./shared');

async function inspectCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Inspecting workspace at ${aiDir}...\n`);

  const specs = readSpecs(aiDir);
  const plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);

  // Merge task MD metadata with JSONL state
  const tasks = taskFiles.map(tf => {
    const state = taskStates.get(tf.id);
    return state ? { ...tf, status: state.status } : tf;
  });

  const allRows = [
    ...specs.map(s => ({ ...s, _type: 'SPEC' })),
    ...plans.map(p => ({ ...p, _type: 'PLAN' })),
    ...tasks.map(t => ({ ...t, _type: 'TASK' })),
  ];

  if (allRows.length === 0) {
    console.log('  (no specs, plans, or tasks)\n');
  } else {
    const cols = ['Type', 'ID', 'Title', 'Status', 'Dependencies', 'Skills', 'Triggers'];
    const keys = ['_type', 'id', 'title', 'status', 'dependencies', 'skills', 'triggers'];
    const widths = cols.map(c => c.length);
    for (const row of allRows) {
      for (let i = 0; i < keys.length; i++) {
        const val = String(row[keys[i]] || '—');
        widths[i] = Math.max(widths[i], val.length);
      }
    }

    console.log('  ' + cols.map((c, i) => c.padEnd(widths[i])).join('  '));
    console.log('  ' + cols.map((_, i) => '─'.repeat(widths[i])).join('  '));

    for (const row of allRows) {
      const line = cols.map((_, i) => {
        const val = String(row[keys[i]] || '—');
        return val.padEnd(widths[i]);
      }).join('  ');
      console.log('  ' + line);
    }
    console.log('');
  }

  const doneTasks = tasks.filter(t => String(t.status || '').toLowerCase() === 'done').length;
  console.log('--- Summary ---');
  console.log(`  Specs: ${specs.length}  |  Plans: ${plans.length}  |  Tasks: ${tasks.length} (${doneTasks} done)`);
}

module.exports = inspectCommand;
