const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const graphCommand = require('../src/commands/graph');

async function testAgentProtocolsAndFixtures() {
  console.log('=== RUNNING AGENT PROTOCOL & FIXTURE INTEGRATION TESTS ===');

  const fixtureDir = path.join(__dirname, 'fixtures', 'sample-node-project');
  const aiDir = path.join(fixtureDir, '.ai');

  // Clean prior runs if any
  if (fs.existsSync(aiDir)) {
    fs.rmSync(aiDir, { recursive: true, force: true });
  }

  // 1. Initialize workspace on persistent fixture
  console.log('Initializing .ai workspace on sample-node-project fixture...');
  await initCommand({ target: fixtureDir, workspace: '.ai', discover: true });

  // 2. Verify AGENTS.md protocol contains required sections
  const agentsMd = fs.readFileSync(path.join(aiDir, 'AGENTS.md'), 'utf8');
  assert(agentsMd.includes('Session start'), 'AGENTS.md missing Session start checklist');
  assert(agentsMd.includes('Workflows'), 'AGENTS.md missing Workflows table');
  assert(agentsMd.includes('spec-creation'), 'AGENTS.md missing spec-creation workflow reference');

  // 3. Verify workflow files are present and match expectations
  const workflowsDir = path.join(aiDir, 'context', 'workflows');
  assert(fs.existsSync(path.join(workflowsDir, 'spec-creation.md')), 'spec-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'plan-creation.md')), 'plan-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'task-creation.md')), 'task-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'task-implementation.md')), 'task-implementation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'code-review.md')), 'code-review.md workflow missing');

  // 4. Test Graph analysis on fixture
  console.log('Running graph analysis on sample-node-project fixture...');
  await graphCommand({ target: fixtureDir, workspace: '.ai' });
  const nodesDir = path.join(aiDir, 'graph', 'nodes');
  const nodes = fs.readdirSync(nodesDir);
  assert(nodes.length > 0, 'Graph nodes should not be empty');

  // Clean up fixture .ai directory so repository remains clean
  fs.rmSync(aiDir, { recursive: true, force: true });

  console.log('=== AGENT PROTOCOL & FIXTURE INTEGRATION TESTS PASSED ===');
}

testAgentProtocolsAndFixtures().catch(err => {
  console.error('Fixture test failed:', err);
  process.exit(1);
});
