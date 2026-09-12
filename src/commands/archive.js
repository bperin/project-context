const fs = require('fs');
const path = require('path');
const {
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
  parseMarkdownStatus,
  parseMarkdownField,
  appendTaskEvent,
  appendJSONL,
} = require('./shared');

// Terminal statuses that may be archived without --force.
const TERMINAL_STATUSES = new Set(['done', 'superseded']);

function isTerminal(status) {
  return TERMINAL_STATUSES.has(String(status || '').toLowerCase());
}

// resolveType maps an ID prefix to its type and directory name.
function resolveType(id) {
  const up = String(id).toUpperCase();
  if (up.startsWith('SPEC-')) return { type: 'spec', dir: 'specs' };
  if (up.startsWith('PLAN-')) return { type: 'plan', dir: 'plans' };
  if (up.startsWith('TASK-')) return { type: 'task', dir: 'tasks' };
  return null;
}

// moveToArchive moves a file into archive/<dir>/, preserving the filename.
// Returns the destination path, or null if the source did not exist.
function moveToArchive(aiDir, dir, fileName) {
  const src = path.join(aiDir, dir, fileName);
  if (!fs.existsSync(src)) return null;
  const dstDir = path.join(aiDir, 'archive', dir);
  fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, fileName);
  fs.renameSync(src, dst);
  return dst;
}

// collectActiveChildIds returns the set of active (non-archived) child IDs
// for a given parent ID, across plans and tasks.
function collectActiveChildIds(aiDir, parentId) {
  const parentUp = String(parentId).toUpperCase();
  const active = new Set();

  const plans = readPlans(aiDir);
  for (const p of plans) {
    const pParent = String(p.parent || p.dependencies || '').toUpperCase();
    if (pParent === parentUp) active.add(p.id);
  }

  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);
  for (const t of taskFiles) {
    const state = taskStates.get(t.id);
    const tParent = String(
      (state && state.plan) || t.parent || t.dependencies || ''
    ).toUpperCase();
    if (tParent === parentUp) active.add(t.id);
  }

  return active;
}

// archiveOne archives a single spec/plan/task by ID.
function archiveOne(aiDir, id, options) {
  const resolved = resolveType(id);
  if (!resolved) {
    throw new Error(`Could not determine type for ID: ${id}. Use SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
  }
  const idUp = id.toUpperCase();
  const fileName = `${idUp}.md`;
  const src = path.join(aiDir, resolved.dir, fileName);

  if (!fs.existsSync(src)) {
    // Maybe already archived?
    const archived = path.join(aiDir, 'archive', resolved.dir, fileName);
    if (fs.existsSync(archived)) {
      throw new Error(`${idUp} is already archived: ${archived}`);
    }
    throw new Error(`${idUp} not found: ${src}`);
  }

  // Determine current status.
  let status;
  if (resolved.type === 'task') {
    const state = getTaskStates(aiDir).get(idUp);
    status = state ? state.status : parseMarkdownStatus(src);
  } else {
    status = parseMarkdownStatus(src);
  }

  if (!isTerminal(status) && !options.force) {
    throw new Error(
      `${idUp} has status "${status}" — only terminal statuses (done, superseded) can be archived without --force.`
    );
  }

  // Refuse to archive a parent that still has active children, unless --force.
  if (resolved.type !== 'task' && !options.force) {
    const activeKids = collectActiveChildIds(aiDir, idUp);
    if (activeKids.size > 0) {
      throw new Error(
        `${idUp} still has active children: ${[...activeKids].join(', ')}. ` +
        `Archive the children first, or use --force.`
      );
    }
  }

  // Move the MD file.
  const dst = moveToArchive(aiDir, resolved.dir, fileName);
  if (!dst) throw new Error(`Failed to move ${src}`);

  // For plans: also move the plan timeline JSONL into archive/timelines/.
  if (resolved.type === 'plan') {
    const tlName = `${idUp}.timeline.jsonl`;
    const tlSrc = path.join(aiDir, 'plans', tlName);
    if (fs.existsSync(tlSrc)) {
      const tlDir = path.join(aiDir, 'archive', 'timelines');
      fs.mkdirSync(tlDir, { recursive: true });
      fs.renameSync(tlSrc, path.join(tlDir, tlName));
    }
  }

  // For tasks: append an `archived` event to the global tasks.jsonl.
  // The historical log is append-only and never rewritten.
  if (resolved.type === 'task') {
    appendTaskEvent(aiDir, { id: idUp, event: 'archived' });
  }

  // Record an archive event in archive/archive.jsonl for auditability.
  appendJSONL(path.join(aiDir, 'archive', 'archive.jsonl'), {
    id: idUp,
    type: resolved.type,
    event: 'archived',
    from: src,
    to: dst,
    ts: new Date().toISOString(),
  });

  return { id: idUp, type: resolved.type, dst };
}

// archiveByStatus archives every active record whose status is terminal.
function archiveByStatus(aiDir, options) {
  const results = [];
  const errors = [];

  const specs = readSpecs(aiDir);
  const plans = readPlans(aiDir);
  const taskFiles = readTaskFiles(aiDir);
  const taskStates = getTaskStates(aiDir);

  // Tasks first (children before parents).
  for (const t of taskFiles) {
    const state = taskStates.get(t.id);
    const status = state ? state.status : t.status;
    if (isTerminal(status)) {
      try {
        results.push(archiveOne(aiDir, t.id, options));
      } catch (e) { errors.push(e.message); }
    }
  }
  // Then plans.
  for (const p of plans) {
    if (isTerminal(p.status)) {
      try {
        results.push(archiveOne(aiDir, p.id, options));
      } catch (e) { errors.push(e.message); }
    }
  }
  // Then specs.
  for (const s of specs) {
    if (isTerminal(s.status)) {
      try {
        results.push(archiveOne(aiDir, s.id, options));
      } catch (e) { errors.push(e.message); }
    }
  }

  return { results, errors };
}

async function archiveCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  const opts = { force: !!options.force };

  if (options.status) {
    if (String(options.status).toLowerCase() !== 'done' &&
        String(options.status).toLowerCase() !== 'superseded') {
      console.error(`--status only accepts terminal statuses (done, superseded). Got: ${options.status}`);
      process.exit(1);
    }
    console.log(`Archiving all active records with terminal status...`);
    const { results, errors } = archiveByStatus(aiDir, opts);
    for (const r of results) console.log(`  archived ${r.id} -> ${path.relative(aiDir, r.dst)}`);
    if (errors.length) {
      console.log('--- Skipped ---');
      for (const e of errors) console.log(`  ! ${e}`);
    }
    console.log(`Archived ${results.length} record(s).`);
    return;
  }

  if (!options.id) {
    console.error('Usage: project-context archive <ID> [--force] | archive --status <done|superseded>');
    process.exit(1);
  }

  const r = archiveOne(aiDir, options.id, opts);
  console.log(`Archived ${r.id} -> ${path.relative(aiDir, r.dst)}`);
  if (r.type === 'task') {
    console.log(`  JSONL: appended "archived" event to data/tasks.jsonl`);
  }
}

module.exports = archiveCommand;
