const fs = require('fs');
const path = require('path');
const { getTaskStates, readTaskFiles, parseMarkdownField } = require('./shared');

const TASK_ID = /TASK-\d+/gi;

function parseTaskIds(value) {
  return [...new Set((String(value || '').match(TASK_ID) || []).map((id) => id.toUpperCase()))];
}

function extractWritePaths(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relevant = content.match(/## Relevant Files([\s\S]*?)(?=\n## Relevant Symbols|\n## |$)/i)?.[1] || '';
  const writeSections = [...relevant.matchAll(/### (?:To create|To modify)([\s\S]*?)(?=\n### |$)/gi)];
  const paths = new Set();

  for (const section of writeSections) {
    for (const line of section[1].split('\n')) {
      const match = line.match(/^\s*-\s+`([^`]+)`/);
      if (!match) continue;
      const candidate = match[1].trim();
      if (candidate && !candidate.includes('<') && !candidate.includes('*')) paths.add(candidate);
    }
  }
  return [...paths];
}

function pathsOverlap(left, right) {
  for (const a of left) {
    for (const b of right) {
      if (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true;
    }
  }
  return false;
}

function buildReadyWave(aiDir, limit = 3) {
  const boundedLimit = Math.max(1, Math.min(3, Number(limit) || 3));
  const states = getTaskStates(aiDir);
  const files = readTaskFiles(aiDir);
  const active = files.filter((task) => states.get(task.id)?.status === 'in_progress');
  const activeRecords = active.map((task) => ({
    id: task.id,
    writePaths: extractWritePaths(task.filePath),
  }));
  const slots = Math.max(0, boundedLimit - active.length);
  const done = new Set(
    [...states.values()].filter((task) => task.status === 'done').map((task) => task.id)
  );
  const candidates = [];
  const waiting = [];

  for (const task of files) {
    const status = states.get(task.id)?.status || task.status;
    if (status !== 'draft') continue;
    const dependencyText = parseMarkdownField(task.filePath, 'Task Dependencies') || task.dependencies;
    const dependencies = parseTaskIds(dependencyText).filter((id) => id !== task.id);
    const blockedBy = dependencies.filter((id) => !done.has(id));
    const writePaths = extractWritePaths(task.filePath);
    const record = { id: task.id, title: task.title, dependencies, blockedBy, writePaths };
    if (blockedBy.length > 0) waiting.push(record);
    else candidates.push(record);
  }

  const ready = [];
  for (const candidate of candidates) {
    if (ready.length >= slots) break;
    if (activeRecords.some((task) => task.writePaths.length === 0)) break;
    if (candidate.writePaths.length === 0 && ready.length > 0) continue;
    if ([...activeRecords, ...ready].some((selected) => pathsOverlap(candidate.writePaths, selected.writePaths))) continue;
    ready.push(candidate);
  }

  return {
    limit: boundedLimit,
    active: active.map((task) => task.id),
    slots,
    ready,
    waiting,
    action: ready.length > 0
      ? `Start ${ready.map((task) => task.id).join(', ')}.`
      : active.length > 0
        ? 'No task can start now. Wait for an active subagent completion notification; do not poll.'
        : 'No task is ready. Resolve the reported dependencies or task metadata.',
  };
}

function readyCommand(options) {
  const targetDir = path.resolve(options.target || '.');
  const aiDir = path.join(targetDir, options.workspace);
  if (!fs.existsSync(aiDir)) throw new Error(`Workspace directory ${aiDir} does not exist. Run init first.`);
  const result = buildReadyWave(aiDir, options.limit);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = readyCommand;
module.exports.buildReadyWave = buildReadyWave;
