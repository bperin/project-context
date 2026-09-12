const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildReadyWave } = require('../src/commands/ready');

function taskMarkdown(id, dependency, writePath) {
  return `# ${id}: task\n\n**Status**: draft\n**Parent**: PLAN-001\n**Dependencies**: ${dependency}\n\n## Status\n\n- **Task Dependencies**: ${dependency}\n\n## Relevant Files\n\n### To create\n\n- \`${writePath}\` — output\n\n### To modify\n\nNone.\n\n## Relevant Symbols\n`;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-ready-'));
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  const events = [
    { id: 'TASK-001', event: 'created', title: 'foundation', plan: 'PLAN-001' },
    { id: 'TASK-001', event: 'done' },
    { id: 'TASK-002', event: 'created', title: 'active', plan: 'PLAN-001' },
    { id: 'TASK-002', event: 'started' },
    { id: 'TASK-003', event: 'created', title: 'ready a', plan: 'PLAN-001' },
    { id: 'TASK-004', event: 'created', title: 'ready b', plan: 'PLAN-001' },
    { id: 'TASK-005', event: 'created', title: 'blocked', plan: 'PLAN-001' },
    { id: 'TASK-006', event: 'created', title: 'overlap', plan: 'PLAN-001' },
  ];
  fs.writeFileSync(path.join(root, 'data', 'tasks.jsonl'), events.map(JSON.stringify).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'tasks', 'TASK-002.md'), taskMarkdown('TASK-002', 'TASK-001', 'pkg/active.go'));
  fs.writeFileSync(path.join(root, 'tasks', 'TASK-003.md'), taskMarkdown('TASK-003', 'TASK-001', 'pkg/a.go'));
  fs.writeFileSync(path.join(root, 'tasks', 'TASK-004.md'), taskMarkdown('TASK-004', 'TASK-001', 'pkg/b.go'));
  fs.writeFileSync(path.join(root, 'tasks', 'TASK-005.md'), taskMarkdown('TASK-005', 'TASK-009', 'pkg/c.go'));
  fs.writeFileSync(path.join(root, 'tasks', 'TASK-006.md'), taskMarkdown('TASK-006', 'TASK-001', 'pkg/a.go'));
  return root;
}

test('ready wave respects total cap, dependencies, and write ownership', () => {
  const root = fixture();
  try {
    const result = buildReadyWave(root, 99);
    assert.strictEqual(result.limit, 3);
    assert.deepStrictEqual(result.active, ['TASK-002']);
    assert.deepStrictEqual(result.ready.map((task) => task.id), ['TASK-003', 'TASK-004']);
    assert.deepStrictEqual(result.waiting[0].blockedBy, ['TASK-009']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
