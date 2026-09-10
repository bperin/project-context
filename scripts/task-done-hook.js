#!/usr/bin/env node
// PostToolUse hook: when a task is marked "done" in overview.xlsx, inject
// context into the current session telling it to start fresh on the next
// task (per the session-spawning protocol in AGENTS.md) and rename the
// session to the completed task's title.
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

// readDoneTasks parses the Tasks sheet and returns an array of
// { id, title, status } for every row whose Status is a done variant.
async function readDoneTasks(xlsxPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet('Tasks');
  if (!ws) return [];

  // Map header names to column indices (1-based in exceljs).
  const headerMap = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const name = String(cell.value || '').trim().toLowerCase();
    headerMap[name] = col;
  });
  const idCol = headerMap['id'];
  const titleCol = headerMap['title'];
  const statusCol = headerMap['status'];
  if (!idCol || !titleCol || !statusCol) return [];

  const done = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = row.getCell(idCol).value;
    const title = row.getCell(titleCol).value;
    const status = row.getCell(statusCol).value;
    if (!id) continue;
    const statusStr = String(status || '').trim().toLowerCase();
    if (DONE_STATUSES.has(statusStr)) {
      done.push({ id: String(id), title: String(title || id) });
    }
  }
  return done;
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

function buildContext(newlyDone) {
  const lines = newlyDone.map((t) => `  - ${t.id} - ${t.title}`);
  const titles = newlyDone.map((t) => t.title);
  const primaryTitle = titles[0];
  return [
    '[task-done-hook] A task was just marked done in overview.xlsx:',
    '',
    lines.join('\n'),
    '',
    'Session-spawning protocol (AGENTS.md): when a task is marked done, start',
    'fresh. Re-read AGENTS.md and overview.xlsx now to load current context',
    'without relying on conversation history. The task(s) above are complete',
    '- do not revisit them. Identify the next unblocked task and begin.',
    '',
    `Rename this session to the completed task title for tracking`,
    `(e.g. /title ${primaryTitle}).`,
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

  let done;
  try {
    done = await readDoneTasks(xlsxPath);
  } catch {
    // Parse failure — never block the agent.
    process.exit(0);
  }

  const currentIds = new Set(done.map((t) => t.id));
  const prev = loadSnapshot(snapshotPath);

  if (prev === null) {
    // First run after install: seed the snapshot without firing, so already
    // done tasks don't trigger a session spawn.
    saveSnapshot(snapshotPath, currentIds);
    process.exit(0);
  }

  const newlyDone = done.filter((t) => !prev.has(t.id));
  // Update the snapshot to the current done set regardless.
  saveSnapshot(snapshotPath, currentIds);

  if (newlyDone.length === 0) {
    process.exit(0);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: buildContext(newlyDone),
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => process.exit(0));
