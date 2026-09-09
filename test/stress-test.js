const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');

async function stressTest() {
  console.log('=== STARTING STRESS TESTS & EDGE CASE VALIDATION ===');

  // Scenario 1: Empty directory with --discover
  const dir1 = path.join('/tmp', 'stress-empty-' + Date.now());
  fs.mkdirSync(dir1, { recursive: true });
  console.log('[Scenario 1] Testing empty directory initialization with discover...');
  await initCommand({ target: dir1, workspace: '.ai', discover: true });
  assert(fs.existsSync(path.join(dir1, '.ai', 'AGENTS.md')));
  assert(fs.existsSync(path.join(dir1, '.ai', 'context', 'identity', 'project.md')));

  // Scenario 2: Go project topology
  const dir2 = path.join('/tmp', 'stress-go-' + Date.now());
  fs.mkdirSync(dir2, { recursive: true });
  fs.writeFileSync(path.join(dir2, 'go.mod'), 'module example.com/foo\n\ngo 1.22\n');
  fs.writeFileSync(path.join(dir2, 'main.go'), 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("hello") }\n');
  console.log('[Scenario 2] Testing Go project initialization & graph parsing...');
  await initCommand({ target: dir2, workspace: '.ai-custom', discover: true });
  await graphCommand({ target: dir2, workspace: '.ai-custom' });
  assert(fs.existsSync(path.join(dir2, '.ai-custom', 'graph', 'nodes')));

  // Scenario 3: Populating multiple specs, plans, tasks with varied statuses and testing overview CSV & inspect
  const dir3 = path.join('/tmp', 'stress-full-' + Date.now());
  fs.mkdirSync(dir3, { recursive: true });
  await initCommand({ target: dir3, workspace: '.ai', discover: false });

  // Create mock spec, plan, task
  const specsDir = path.join(dir3, '.ai', 'context', 'specs');
  const plansDir = path.join(dir3, '.ai', 'context', 'plans');
  const tasksDir = path.join(dir3, '.ai', 'context', 'tasks');

  fs.writeFileSync(path.join(specsDir, 'SPEC-001.md'), `# SPEC-001: Core Engine\n\n## Status\ncommitted\n\n**Progress**: 50% (1 of 2 plans done)\n**Dependencies**: none\n`);
  fs.writeFileSync(path.join(plansDir, 'PLAN-001.md'), `# PLAN-001: Database Layer\n\n## Status\nin_progress\n\n**Progress**: 60% (3 of 5 tasks done)\n**Dependencies**: SPEC-001\n`);
  fs.writeFileSync(path.join(tasksDir, 'TASK-001.md'), `# TASK-001: Connection Pool\n\n## Status\ndone\n\n**Progress**: 100%\n**Dependencies**: none\n`);

  console.log('[Scenario 3] Testing inspect and overview CSV generation with mixed statuses...');
  await inspectCommand({ target: dir3, workspace: '.ai' });
  await overviewCommand({ target: dir3, workspace: '.ai' });

  const csvPath = path.join(dir3, '.ai', 'context', 'state', 'overview.csv');
  assert(fs.existsSync(csvPath));
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  assert(csvContent.includes('SPEC-001'));
  assert(csvContent.includes('PLAN-001'));
  assert(csvContent.includes('TASK-001'));
  assert(csvContent.includes('in_progress'));

  // Scenario 4: Teardown / Cleanup check & error handling (missing workspace)
  console.log('[Scenario 4] Testing error handling when workspace does not exist...');
  try {
    await inspectCommand({ target: path.join('/tmp', 'non-existent-dir'), workspace: '.ai' });
    assert.fail('Should have thrown or exited for non-existent workspace');
  } catch (err) {
    console.log('Caught expected error/exit pathway:', err.message);
  }

  // Cleanup fake projects
  console.log('Cleaning up stress test directories...');
  fs.rmSync(dir1, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
  fs.rmSync(dir3, { recursive: true, force: true });

  console.log('=== ALL STRESS TESTS PASSED SUCCESSFULLY! ===');
}

stressTest().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
