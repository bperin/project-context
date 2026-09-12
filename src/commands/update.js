const fs = require('fs');
const path = require('path');
const {
  appendTaskEvent,
  getTaskState,
  parseMarkdownField,
} = require('./shared');

const FIELD_OPTIONS = {
  title: null,
  parent: 'Parent',
  dependencies: 'Dependencies',
  skills: 'Skills',
  triggers: 'Triggers',
  commit: 'Commit',
};

function replaceTitle(content, id, title) {
  const lines = content.split('\n');
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  if (titleIndex === -1) return content;
  lines[titleIndex] = `# ${id}: ${title}`;
  return lines.join('\n');
}

function replaceField(content, field, value) {
  const pattern = new RegExp(`^\\*\\*${field}\\*\\*:\\s*.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, `**${field}**: ${value}`);

  const lines = content.split('\n');
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  lines.splice(titleIndex >= 0 ? titleIndex + 1 : 0, 0, `**${field}**: ${value}`);
  return lines.join('\n');
}

async function updateCommand(options) {
  const id = String(options.id || '').toUpperCase();
  const prefix = id.startsWith('SPEC-') ? 'SPEC'
    : id.startsWith('PLAN-') ? 'PLAN'
    : id.startsWith('TASK-') ? 'TASK'
    : null;

  if (!prefix) {
    throw new Error(`Could not determine type for ID: ${options.id}. Use SPEC-NNN, PLAN-NNN, or TASK-NNN.`);
  }

  const changes = Object.entries(FIELD_OPTIONS)
    .filter(([option]) => options[option] !== undefined);
  if (changes.length === 0) {
    throw new Error('Provide at least one field to update: --title, --parent, --dependencies, --skills, --triggers, or --commit.');
  }

  const targetDir = path.resolve(options.target || '.');
  const aiDir = path.join(targetDir, options.workspace);
  const dirName = prefix === 'SPEC' ? 'specs' : prefix === 'PLAN' ? 'plans' : 'tasks';
  const filePath = path.join(aiDir, dirName, `${id}.md`);
  if (!fs.existsSync(filePath)) throw new Error(`${id} not found: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  for (const [option, field] of changes) {
    const value = String(options[option]);
    content = field === null ? replaceTitle(content, id, value) : replaceField(content, field, value);
  }
  fs.writeFileSync(filePath, content);

  if (prefix === 'TASK') {
    const current = getTaskState(aiDir, id);
    const event = { id, event: 'updated' };
    for (const [option] of changes) event[option === 'parent' ? 'plan' : option] = String(options[option]);
    if (!Object.hasOwn(event, 'plan')) {
      event.plan = current?.plan || parseMarkdownField(filePath, 'Parent') || '';
    }
    appendTaskEvent(aiDir, event);
  }

  console.log(`Updated ${id}: ${changes.map(([option]) => option).join(', ')}`);
}

module.exports = updateCommand;
