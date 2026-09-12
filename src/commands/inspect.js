const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  parseMarkdownStatus,
  parseMarkdownField,
} = require('./shared');

// readArchived reads archived MD files from archive/<dir>/ with the same shape
// as readSpecs/readPlans/readTaskFiles. Used only when --include-archived is set.
function readArchived(aiDir, dirName, prefix) {
  const arcDir = path.join(aiDir, 'archive', dirName);
  if (!fs.existsSync(arcDir)) return [];
  return fs.readdirSync(arcDir)
    .filter(f => f.endsWith('.md') && f.startsWith(prefix))
    .sort()
    .map(f => {
      const fp = path.join(arcDir, f);
      const id = f.replace('.md', '');
      const titleMatch = fs.readFileSync(fp, 'utf8').match(/^#\s+(.*)/m);
      const base = {
        id,
        title: titleMatch ? titleMatch[1] : id,
        status: 'archived',
        filePath: fp,
      };
      if (prefix === 'SPEC-') {
        return { ...base, dependencies: parseMarkdownField(fp, 'Dependencies'), skills: parseMarkdownField(fp, 'Skills'), triggers: parseMarkdownField(fp, 'Triggers') };
      }
      return {
        ...base,
        parent: parseMarkdownField(fp, 'Parent'),
        dependencies: parseMarkdownField(fp, 'Dependencies'),
        skills: parseMarkdownField(fp, 'Skills'),
        triggers: parseMarkdownField(fp, 'Triggers'),
      };
    });
}

async function inspectCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  console.log(`Inspecting workspace at ${aiDir}...\n`);

  let specs = readSpecs(aiDir);
  let plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);

  // Merge task MD metadata with JSONL state
  let tasks = taskFiles.map(tf => {
    const state = taskStates.get(tf.id);
    return state ? { ...tf, status: state.status } : tf;
  });

  // Hide archived tasks by default; --include-archived surfaces archived records
  // from the archive/ tree (their MD files were moved out of the active dirs).
  if (!options.includeArchived) {
    tasks = tasks.filter(t => String(t.status || '').toLowerCase() !== 'archived');
  } else {
    specs = specs.concat(readArchived(aiDir, 'specs', 'SPEC-'));
    plans = plans.concat(readArchived(aiDir, 'plans', 'PLAN-'));
    tasks = tasks.concat(readArchived(aiDir, 'tasks', 'TASK-'));
  }

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
