const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  updateMarkdownStatus,
  parseMarkdownField,
} = require('./shared');

function isDone(status) {
  const s = String(status || '').toLowerCase();
  return s === 'done' || s === 'complete' || s === 'completed';
}

function pct(done, total) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// syncCommand recomputes Status bottom-up:
//   tasks -> plans -> specs
// It updates the **Status** line in the MD files.
async function syncCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  const specs = readSpecs(aiDir);
  const plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);
  const tasks = taskFiles.map(tf => {
    const state = taskStates.get(tf.id);
    return state ? { ...tf, status: state.status, plan: state.plan } : tf;
  });

  const warnings = [];
  const changes = [];

  // Orphaned rows
  for (const t of tasks) {
    if (!t.parent && !t.dependencies) warnings.push(`${t.id} has no Parent — not counted toward any plan`);
  }
  for (const p of plans) {
    if (!p.parent && !p.dependencies) warnings.push(`${p.id} has no Parent — not counted toward any spec`);
  }
  for (const t of tasks) {
    if (isDone(t.status) && !t.commit) {
      warnings.push(`${t.id} is done but has no Commit`);
    }
  }

  // --- Tasks -> Plans ---
  const tasksByPlan = {};
  for (const t of tasks) {
    const plan = t.parent || t.plan || t.dependencies || '';
    if (!plan) continue;
    (tasksByPlan[String(plan).trim().toUpperCase()] ||= []).push(t);
  }

  for (const p of plans) {
    const kids = tasksByPlan[String(p.id).toUpperCase()] || [];
    const done = kids.filter(k => isDone(k.status)).length;
    const total = kids.length;

    let newStatus = String(p.status || 'draft');
    if (total === 0) {
      newStatus = 'draft';
    } else if (done === total) {
      newStatus = 'done';
    } else if (done > 0) {
      newStatus = 'in_progress';
    } else {
      newStatus = 'committed';
    }

    if (String(p.status) !== newStatus) {
      changes.push(`${p.id}: ${p.status || '—'} -> ${newStatus} (${done}/${total} tasks done)`);
      updateMarkdownStatus(p.filePath, newStatus);
    }
  }

  // --- Plans -> Specs ---
  const plansBySpec = {};
  for (const p of plans) {
    const spec = p.parent || p.dependencies || '';
    if (!spec) continue;
    (plansBySpec[String(spec).trim().toUpperCase()] ||= []).push(p);
  }

  for (const s of specs) {
    const kids = plansBySpec[String(s.id).toUpperCase()] || [];
    const done = kids.filter(k => isDone(k.status)).length;
    const total = kids.length;

    let newStatus = String(s.status || 'draft');
    if (total > 0 && done === total) {
      newStatus = 'done';
    } else if (done > 0) {
      newStatus = 'in_progress';
    }

    if (String(s.status) !== newStatus) {
      changes.push(`${s.id}: ${s.status || '—'} -> ${newStatus} (${done}/${total} plans done)`);
      updateMarkdownStatus(s.filePath, newStatus);
    }
  }

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
    console.log('All statuses are already in sync.');
  }
  console.log(`Synced ${aiDir}`);
}

module.exports = syncCommand;
