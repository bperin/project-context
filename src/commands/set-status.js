const fs = require('fs');
const path = require('path');
const {
  parseMarkdownStatus,
  updateMarkdownStatus,
  appendTaskEvent,
  appendTimelineEvent,
  getTaskState,
  parseMarkdownField,
} = require('./shared');

async function setStatusCommand(options) {
  const { id, status } = options;
  if (!id || !status) {
    console.error('Usage: project-context status <ID> <status>');
    process.exit(1);
  }

  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  const prefix = id.toUpperCase().startsWith('SPEC-') ? 'SPEC'
    : id.toUpperCase().startsWith('PLAN-') ? 'PLAN'
    : id.toUpperCase().startsWith('TASK-') ? 'TASK'
    : null;

  if (!prefix) {
    console.error(`Could not determine type for ID: ${id}. Use SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
    process.exit(1);
  }

  const dirName = prefix === 'SPEC' ? 'specs' : prefix === 'PLAN' ? 'plans' : 'tasks';
  const filePath = path.join(aiDir, dirName, `${id.toUpperCase()}.md`);

  if (!fs.existsSync(filePath)) {
    console.error(`${id} not found: ${filePath}`);
    process.exit(1);
  }

  // Update the MD file's status line
  const updated = updateMarkdownStatus(filePath, status);
  if (!updated) {
    // If the file has no **Status** line, add one after the title
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const insertIdx = lines.findIndex(l => l.startsWith('# ')) + 1;
    lines.splice(insertIdx, 0, `**Status**: ${status}`);
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  // For tasks: also append events to tasks.jsonl and plan timeline
  if (prefix === 'TASK') {
    const taskState = getTaskState(aiDir, id.toUpperCase());
    const planId = taskState ? taskState.plan : parseMarkdownField(filePath, 'Parent');

    // Map status to event type
    let eventType = null;
    if (status === 'in_progress' || status === 'implementing') eventType = 'started';
    else if (status === 'done' || status === 'complete') eventType = 'done';

    if (eventType) {
      appendTaskEvent(aiDir, {
        id: id.toUpperCase(),
        event: eventType,
      });
      if (planId) {
        appendTimelineEvent(aiDir, planId, {
          task: id.toUpperCase(),
          event: eventType,
        });
      }
    }
  }

  console.log(`Updated ${id} status to "${status}" in ${filePath}`);
  if (prefix === 'TASK') {
    console.log(`  JSONL: ${path.join(aiDir, 'data', 'tasks.jsonl')}`);
  }
}

module.exports = setStatusCommand;
