const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');

async function runTests() {
  console.log('Running project-context test suite...');
  const targetDir = path.join('/tmp', 'pc-test-' + Date.now());
  fs.mkdirSync(targetDir, { recursive: true });

  // Test init
  console.log('Testing init...');
  await initCommand({ target: targetDir, workspace: '.ai', discover: true });
  assert(fs.existsSync(path.join(targetDir, '.ai', 'AGENTS.md')), 'AGENTS.md missing');
  assert(fs.existsSync(path.join(targetDir, '.ai', 'context', 'specs')), 'specs dir missing');

  // Test graph
  console.log('Testing graph...');
  await graphCommand({ target: targetDir, workspace: '.ai' });
  assert(fs.existsSync(path.join(targetDir, '.ai', 'graph', 'nodes')), 'graph nodes missing');

  // Create a mock spec
  const specPath = path.join(targetDir, '.ai', 'context', 'specs', 'SPEC-001.md');
  fs.writeFileSync(specPath, `# SPEC-001: Test Spec\n\n## Status\ncommitted\n\n**Progress**: 100% (1 of 1 plans done)\n**Dependencies**: none\n`);

  // Test overview
  console.log('Testing overview...');
  await overviewCommand({ target: targetDir, workspace: '.ai' });
  const csvPath = path.join(targetDir, '.ai', 'context', 'state', 'overview.csv');
  assert(fs.existsSync(csvPath), 'overview.csv missing');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  assert(csvContent.includes('SPEC-001'), 'overview.csv missing SPEC-001');

  // Test inspect
  console.log('Testing inspect...');
  await inspectCommand({ target: targetDir, workspace: '.ai' });

  console.log('All tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
