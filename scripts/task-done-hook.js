#!/usr/bin/env node
// PostToolUse hook: when a task is marked "done" in tasks.jsonl, inject
// context into the current session telling it what to do next — the next
// unblocked task in the current plan, the next plan, or that all plans and
// tasks are complete.
//
// Usage (wired from .devin/hooks.v1.json):
//   node task-done-hook.js -t <target> -w <workspace> [--tool ...] [--output-file ...]
//
// stdin : Devin PostToolUse event payload (JSON)
// stdout: hook output JSON (only when a task newly becomes "done")
//
// The script is a no-op (exit 0, no output) unless the tool call touched
// the tasks.jsonl or a task MD file AND a task transitioned into "done"
// since the last snapshot. A snapshot of done task IDs is kept next to the
// data dir so the first run after install does not fire for already-done
// tasks.

'use strict';

const fs = require('fs');
const path = require('path');

// shared.js lives in the package's src/commands/ — resolve relative to this file
const {
  getTaskStates,
  readPlans,
} = require(path.join(__dirname, '..', 'src', 'commands', 'shared'));

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
    const timer = setTimeout(() => resolve(data), 2000);
    if (timer.unref) timer.unref();
  });
}

// toolTouchedTaskData returns true if the PostToolUse event plausibly modified
// task state — either tasks.jsonl, a task MD file, or the data directory.
function toolTouchedTaskData(event, aiDir) {
  const tool = event.tool_name || '';
  const input = event.tool_input || {};
  const dataDir = path.join(aiDir, 'data');
  const tasksJsonl = path.join(dataDir, 'tasks.jsonl');
  const tasksDir = path.join(aiDir, 'tasks');

  if (tool === 'write' || tool === 'edit' || tool === 'apply_patch') {
    const fp = input.file_path || input.path || '';
    if (!fp) return false;
    try {
      const resolved = path.resolve(fp);
      return resolved === tasksJsonl ||
        resolved.startsWith(tasksDir + path.sep) ||
        resolved.startsWith(dataDir + path.sep);
    } catch {
      return false;
    }
  }

  if (tool === 'exec') {
    const cmd = input.command || '';
    if (!cmd) return false;
    return cmd.includes('tasks.jsonl') ||
      cmd.includes('status') ||
      cmd.includes(dataDir) ||
      cmd.includes(path.basename(tasksJsonl));
  }

  return false;
}

function loadSnapshot(snapshotPath) {
  try {
    return new Set(JSON.parse(fs.readFileSync(snapshotPath, 'utf8')));
  } catch {
    return null;
  }
}

function saveSnapshot(snapshotPath, ids) {
  try {
    fs.writeFileSync(snapshotPath, JSON.stringify([...ids].sort(), null, 2));
  } catch {}
}

function isDone(status) {
  return DONE_STATUSES.has(String(status || '').trim().toLowerCase());
}

// computeNextAction determines what the agent should do after a task is
// marked done.
function computeNextAction(newlyDone, tasks, plans) {
  const lines = newlyDone.map((t) => `  - ${t.id} - ${t.title}`);
  const primaryTitle = newlyDone[0].title;

  const planId = String(newlyDone[0].plan || '').trim();

  const planTasks = tasks.filter(
    (t) => String(t.plan || t.parent || t.dependencies || '').trim() === planId
  );
  const incompleteTasks = planTasks.filter((t) => !isDone(t.status));

  if (incompleteTasks.length > 0) {
    const next = incompleteTasks[0];
    return {
      title: primaryTitle,
      summary: lines.join('\n'),
      action: `Next task in ${planId}: ${next.id} - ${next.title}. Start fresh, read AGENTS.md and inspect the project state, then implement ${next.id}.`,
    };
  }

  // All tasks in the plan are done → advance to the next plan in order.
  // Only inspect later plans so stale plan status cannot send the workflow
  // backward to work whose tasks are already complete.
  const planIndex = plans.findIndex(
    (candidate) => String(candidate.id || '').trim() === planId
  );
  const remainingPlans = planIndex >= 0 ? plans.slice(planIndex + 1) : plans;
  const nextPlan = remainingPlans.find((candidate) => !isDone(candidate.status));

  if (nextPlan) {
    return {
      title: primaryTitle,
      summary: lines.join('\n'),
      action: `Plan ${planId} is complete (all tasks done). Next plan: ${nextPlan.id} - ${nextPlan.title}. Start fresh, read AGENTS.md and inspect the project state, then create tasks for ${nextPlan.id} (if none exist) or implement its first task.`,
    };
  }

  return {
    title: primaryTitle,
    summary: lines.join('\n'),
    action: `All plans and tasks are complete. The project is done. Commit any remaining work and open a PR if applicable.`,
  };
}

function buildContext(newlyDone, tasks, plans) {
  const result = computeNextAction(newlyDone, tasks, plans);
  return [
    '[task-done-hook] A task was just marked done:',
    '',
    result.summary,
    '',
    'Session-spawning protocol (AGENTS.md): when a task is marked done, start',
    'fresh. Re-read AGENTS.md and inspect the project state now to load',
    'current context without relying on conversation history. The task(s)',
    'above are complete — do not revisit them.',
    '',
    `Next action: ${result.action}`,
    '',
    `Rename this session to the completed task title for tracking`,
    `(e.g. /title ${result.title}).`,
  ].join('\n');
}

async function main() {
  // Parse args: -t <target> -w <workspace> [--tool ...] [--output-file ...]
  const args = process.argv.slice(2);
  let targetDir = '.';
  let workspace = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' && args[i + 1]) { targetDir = args[i + 1]; i++; }
    else if (args[i] === '-w' && args[i + 1]) { workspace = args[i + 1]; i++; }
    else if (args[i] === '--tool' && args[i + 1]) { i++; }
    else if (args[i] === '--output-file' && args[i + 1]) { i++; }
  }

  targetDir = path.resolve(targetDir);
  if (!workspace) {
    const repoName = path.basename(targetDir);
    workspace = `.${repoName}-manager`;
  }
  const aiDir = path.join(targetDir, workspace);

  if (!fs.existsSync(aiDir)) {
    process.exit(0);
  }

  const raw = await readStdin();
  let event = {};
  try {
    event = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0);
  }

  if (event.hook_event_name && event.hook_event_name !== 'PostToolUse') {
    process.exit(0);
  }
  if (event.tool_response && event.tool_response.success === false) {
    process.exit(0);
  }
  if (!toolTouchedTaskData(event, aiDir)) {
    process.exit(0);
  }

  const snapshotPath = path.join(aiDir, 'data', '.task-done-snapshot.json');

  // Read current task states from JSONL
  const taskStates = getTaskStates(aiDir);
  const tasks = [...taskStates.values()];

  const done = tasks.filter((t) => isDone(t.status));
  const currentIds = new Set(done.map((t) => String(t.id)));
  const prev = loadSnapshot(snapshotPath);

  if (prev === null) {
    saveSnapshot(snapshotPath, currentIds);
    process.exit(0);
  }

  const newlyDone = done.filter((t) => !prev.has(String(t.id)));
  saveSnapshot(snapshotPath, currentIds);

  if (newlyDone.length === 0) {
    process.exit(0);
  }

  const plans = readPlans(aiDir);

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: buildContext(newlyDone, tasks, plans),
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

// Export internals for testing.
module.exports = {
  toolTouchedTaskData,
  isDone,
  computeNextAction,
  buildContext,
  DONE_STATUSES,
};

// Only run main when invoked directly, not when required for testing.
if (require.main === module) {
  main().catch(() => process.exit(0));
}
