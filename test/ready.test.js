const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildReadyWave } = require('../src/commands/ready');

function planMarkdown(id, gate) {
  return `# ${id}: plan

**Status**: committed

## Goal

Bounded work.

${gate === null ? '' : `## Planning Gate

- **Self-challenge complete**: ${gate.selfChallenge}
- **Blocking questions resolved**: ${gate.questions}
- **User accepted**: ${gate.accepted}
`}
`;
}

function taskMarkdown(id, plan, dependency, writePath) {
  return `# ${id}: task

**Status**: draft
**Parent**: ${plan}
**Dependencies**: ${dependency}

## Status

- **Task Dependencies**: ${dependency}

## Relevant Files

### To create

- \`${writePath}\` — output

### To modify

None.

## Relevant Symbols
`;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-ready-'));
  fs.mkdirSync(path.join(root, 'plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'plans', 'PLAN-001.md'), planMarkdown('PLAN-001', {
    selfChallenge: 'yes', questions: 'yes', accepted: 'yes',
  }));
  fs.writeFileSync(path.join(root, 'plans', 'PLAN-002.md'), planMarkdown('PLAN-002', {
    selfChallenge: 'yes', questions: 'no', accepted: 'no',
  }));
  fs.writeFileSync(path.join(root, 'plans', 'PLAN-003.md'), planMarkdown('PLAN-003', null));

  const records = [
    ['TASK-001', 'PLAN-001', 'none', 'pkg/a.js', 'draft'],
    ['TASK-002', 'PLAN-001', 'none', 'pkg/b.js', 'draft'],
    ['TASK-003', 'PLAN-001', 'none', 'pkg/c.js', 'draft'],
    ['TASK-004', 'PLAN-001', 'none', 'pkg/d.js', 'draft'],
    ['TASK-005', 'PLAN-002', 'none', 'pkg/e.js', 'draft'],
    ['TASK-006', 'PLAN-003', 'none', 'pkg/f.js', 'draft'],
    ['TASK-007', 'PLAN-001', 'none', 'pkg/g.js', 'needs_planning'],
  ];
  const events = [];
  for (const [id, plan, dependency, writePath, status] of records) {
    fs.writeFileSync(path.join(root, 'tasks', `${id}.md`), taskMarkdown(id, plan, dependency, writePath));
    events.push({ id, event: 'created', title: id, plan, status: 'draft' });
    if (status === 'needs_planning') events.push({ id, event: 'status_changed', status });
  }
  fs.writeFileSync(path.join(root, 'data', 'tasks.jsonl'), events.map(JSON.stringify).join('\n') + '\n');
  return root;
}

test('ready hard-caps at three and reports planning gates and gaps', () => {
  const root = fixture();
  try {
    const result = buildReadyWave(root, 99);
    assert.strictEqual(result.limit, 3);
    assert.deepStrictEqual(result.ready.map((task) => task.id), ['TASK-001', 'TASK-002', 'TASK-003']);
    const blocked = result.waiting.find((task) => task.id === 'TASK-005');
    assert(blocked, 'new-template task with incomplete planning gate was dispatched');
    assert.match(blocked.planningBlocked, /Blocking questions resolved|User accepted/);
    assert(result.planningGaps.some((task) => task.id === 'TASK-007'), 'needs_planning task not surfaced');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ready preserves legacy plans without a planning gate', () => {
  const root = fixture();
  try {
    for (const id of ['TASK-001', 'TASK-002', 'TASK-003', 'TASK-004']) {
      fs.appendFileSync(path.join(root, 'data', 'tasks.jsonl'), JSON.stringify({ id, event: 'done', status: 'done' }) + '\n');
    }
    const result = buildReadyWave(root, 3);
    assert(result.ready.some((task) => task.id === 'TASK-006'), 'legacy plan task should remain ready without a gate');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
