#!/usr/bin/env node
// PostToolUse hook: when a task is marked "done" in overview.xlsx, inject
// context into the current session telling it what to do next — the next
// unblocked task in the current plan, the next plan in the spec, or that
// the spec is complete and to check for another spec.
//
// Usage (wired from .devin/hooks.v1.json):
//   node task-done-hook.js <path-to-overview.xlsx>
//
// stdin : Devin PostToolUse event payload (JSON)
// stdout: hook output JSON (only when a task newly becomes "done")
//
// The script is a no-op (exit 0, no output) unless the tool call touched
// the overview.xlsx file AND a task transitioned into "done" since the
// last snapshot. A snapshot of done task IDs is kept next to the xlsx so
// the first run after install does not fire for already-done tasks.

'use strict';

const fs = require('fs');
const path = require('path');

// exceljs lives in project-context's node_modules; resolve relative to this
// file so the script works regardless of the hook's cwd.
const ExcelJS = require(path.join(
  __dirname,
  '..',
  'node_modules',
  'exceljs'
));

const DONE_STATUSES = new Set(['done', 'complete', 'completed']);

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    // Safety timeout — never block the agent on a hung stdin.
    const timer = setTimeout(() => resolve(data), 2000);
    // Keep the timer from keeping the event loop alive past exit.
    if (timer.unref) timer.unref();
  });
}

// toolTouchedXlsx returns true if the PostToolUse event plausibly modified
// the overview workbook. We check conservatively: for `write` we compare the
// edited file path; for `exec` we look for the xlsx path or its basename in
// the command string.
function toolTouchedXlsx(event, xlsxPath) {
  const tool = event.tool_name || '';
  const input = event.tool_input || {};
  const absXlsx = path.resolve(xlsxPath);
  const basename = path.basename(absXlsx);

  if (tool === 'write' || tool === 'edit' || tool === 'apply_patch') {
    const fp = input.file_path || input.path || '';
    if (!fp) return false;
    try {
      return path.resolve(fp) === absXlsx;
    } catch {
      return false;
    }
  }

  if (tool === 'exec') {
    const cmd = input.command || '';
    if (!cmd) return false;
    // Match either the full path or the bare filename, or the state dir.
    const stateDir = path.dirname(absXlsx);
    return (
      cmd.includes(absXlsx) ||
      cmd.includes(basename) ||
      cmd.includes(stateDir)
    );
  }

  return false;
}

// parseHeaderMap reads row 1 and returns { lowercased-header-name: col-index }
function parseHeaderMap(ws) {
  const headerMap = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const name = String(cell.value || '').trim().toLowerCase();
    headerMap[name] = col;
  });
  return headerMap;
}

// readSheetRows reads all data rows from a worksheet, returning an array of
// objects keyed by lowercased header names.
function readSheetRows(ws) {
  if (!ws) return [];
  const headerMap = parseHeaderMap(ws);
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    for (const [name, col] of Object.entries(headerMap)) {
      obj[name] = row.getCell(col).value;
    }
    // Skip fully empty rows.
    if (Object.values(obj).every((v) => v === null || v === undefined || v === '')) {
      continue;
    }
    rows.push(obj);
  }
  return rows;
}

// readWorkbook reads the xlsx and returns { tasks, plans, specs } arrays.
async function readWorkbook(xlsxPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  return {
    tasks: readSheetRows(wb.getWorksheet('Tasks')),
    plans: readSheetRows(wb.getWorksheet('Plans')),
    specs: readSheetRows(wb.getWorksheet('Specs')),
  };
}

function loadSnapshot(snapshotPath) {
  try {
    return new Set(JSON.parse(fs.readFileSync(snapshotPath, 'utf8')));
  } catch {
    return null; // absent or corrupt -> first run
  }
}

function saveSnapshot(snapshotPath, ids) {
  try {
    fs.writeFileSync(snapshotPath, JSON.stringify([...ids].sort(), null, 2));
  } catch {
    // best-effort; never block the agent
  }
}

// isDone returns true if a status string is a done variant.
function isDone(status) {
  return DONE_STATUSES.has(String(status || '').trim().toLowerCase());
}

// computeNextAction determines what the agent should do after a task is
// marked done. Returns a string instruction injected into the session.
//
// Logic:
//   1. Find the plan the completed task belongs to.
//   2. Check if all tasks in that plan are done.
//      - If not → next action is the next non-done task in the same plan.
//      - If yes → the plan is complete. Find the spec the plan belongs to.
//   3. Check if there's another non-done plan in the same spec.
//      - If yes → next action is to start the next plan (create tasks if
//        none exist, or implement the first task).
//      - If no → the spec is complete. Check for another non-done spec.
//   4. If there's another non-done spec → next action is to plan it.
//   5. If all specs are done → project is complete.
function computeNextAction(newlyDone, tasks, plans, specs) {
  const lines = newlyDone.map((t) => `  - ${t.id} - ${t.title}`);
  const primaryTitle = newlyDone[0].title;

  // Find the plan the first newly-done task belongs to.
  const planId = String(newlyDone[0].dependencies || '').trim();
  const plan = plans.find((p) => String(p.id || '').trim() === planId);

  // Tasks in the same plan.
  const planTasks = tasks.filter(
    (t) => String(t.dependencies || '').trim() === planId
  );
  const incompleteTasks = planTasks.filter((t) => !isDone(t.status));

  if (incompleteTasks.length > 0) {
    const next = incompleteTasks[0];
    return {
      title: primaryTitle,
      summary: lines.join('\n'),
      action: `Next task in ${planId}: ${next.id} - ${next.title}. Start fresh, read AGENTS.md and overview.xlsx, then implement ${next.id}.`,
    };
  }

  // All tasks in the plan are done → plan is complete.
  // Find the spec the plan belongs to.
  const specId = plan ? String(plan.dependencies || '').trim() : '';
  const specPlans = plans.filter(
    (p) => String(p.dependencies || '').trim() === specId
  );
  // A plan is "incomplete" if its status is not done AND it's not the plan
  // that just completed (all its tasks are done even though its status field
  // may still say "committed").
  const incompletePlans = specPlans.filter((p) => {
    if (String(p.id || '').trim() === planId) return false; // skip the just-completed plan
    if (isDone(p.status)) return false;
    return true;
  });

  if (incompletePlans.length > 0) {
    const nextPlan = incompletePlans[0];
    return {
      title: primaryTitle,
      summary: lines.join('\n'),
      action: `Plan ${planId} is complete (all tasks done). Next plan in ${specId}: ${nextPlan.id} - ${nextPlan.title}. Start fresh, read AGENTS.md and overview.xlsx, then create tasks for ${nextPlan.id} (if none exist) or implement its first task.`,
    };
  }

  // All plans in the spec are done → spec is complete.
  // Check for another non-done spec.
  // A spec is "incomplete" if its status is not done AND it's not the spec
  // that just completed (all its plans are done even though its status field
  // may still say "committed").
  const incompleteSpecs = specs.filter((s) => {
    if (String(s.id || '').trim() === specId) return false; // skip the just-completed spec
    if (isDone(s.status)) return false;
    return true;
  });

  if (incompleteSpecs.length > 0) {
    const nextSpec = incompleteSpecs[0];
    return {
      title: primaryTitle,
      summary: lines.join('\n'),
      action: `Spec ${specId} is complete (all plans done). Next spec: ${nextSpec.id} - ${nextSpec.title}. Start fresh, read AGENTS.md and overview.xlsx, then create a plan for ${nextSpec.id}.`,
    };
  }

  // Everything is done.
  return {
    title: primaryTitle,
    summary: lines.join('\n'),
    action: `All specs, plans, and tasks are complete. The project is done. Commit any remaining work and open a PR if applicable.`,
  };
}

function buildContext(newlyDone, tasks, plans, specs) {
  const result = computeNextAction(newlyDone, tasks, plans, specs);
  return [
    '[task-done-hook] A task was just marked done in overview.xlsx:',
    '',
    result.summary,
    '',
    'Session-spawning protocol (AGENTS.md): when a task is marked done, start',
    'fresh. Re-read AGENTS.md and overview.xlsx now to load current context',
    'without relying on conversation history. The task(s) above are complete',
    '- do not revisit them.',
    '',
    `Next action: ${result.action}`,
    '',
    `Rename this session to the completed task title for tracking`,
    `(e.g. /title ${result.title}).`,
  ].join('\n');
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    process.exit(0);
  }

  const raw = await readStdin();
  let event = {};
  try {
    event = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }

  // Only act on PostToolUse events that plausibly touched the workbook.
  if (event.hook_event_name && event.hook_event_name !== 'PostToolUse') {
    process.exit(0);
  }
  // Bail if the tool call itself failed — the xlsx wasn't actually modified.
  // PostToolUse stdin carries tool_response.success (boolean) per the docs.
  if (event.tool_response && event.tool_response.success === false) {
    process.exit(0);
  }
  if (!toolTouchedXlsx(event, xlsxPath)) {
    process.exit(0);
  }
  if (!fs.existsSync(xlsxPath)) {
    process.exit(0);
  }

  const snapshotPath = path.join(
    path.dirname(xlsxPath),
    '.task-done-snapshot.json'
  );

  let workbook;
  try {
    workbook = await readWorkbook(xlsxPath);
  } catch {
    // Parse failure — never block the agent.
    process.exit(0);
  }

  const done = workbook.tasks.filter((t) => isDone(t.status));
  const currentIds = new Set(done.map((t) => String(t.id)));
  const prev = loadSnapshot(snapshotPath);

  if (prev === null) {
    // First run after install: seed the snapshot without firing, so already
    // done tasks don't trigger a session spawn.
    saveSnapshot(snapshotPath, currentIds);
    process.exit(0);
  }

  const newlyDone = done.filter((t) => !prev.has(String(t.id)));
  // Update the snapshot to the current done set regardless.
  saveSnapshot(snapshotPath, currentIds);

  if (newlyDone.length === 0) {
    process.exit(0);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: buildContext(newlyDone, workbook.tasks, workbook.plans, workbook.specs),
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// Export internals for testing.
module.exports = {
  toolTouchedXlsx,
  readSheetRows,
  readWorkbook,
  isDone,
  computeNextAction,
  buildContext,
  DONE_STATUSES,
};

// Only run main when invoked directly, not when required for testing.
if (require.main === module) {
  main().catch(() => process.exit(0));
}
