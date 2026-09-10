const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const graphCommand = require('../src/commands/graph');

async function testAgentProtocolsAndFixtures() {
  console.log('=== RUNNING AGENT PROTOCOL & FIXTURE INTEGRATION TESTS ===');

  const fixtureDir = path.join(__dirname, 'fixtures', 'sample-node-project');
  const ws = '.sample-node-project-manager';
  const aiDir = path.join(fixtureDir, ws);

  // Clean prior runs if any
  if (fs.existsSync(aiDir)) {
    fs.rmSync(aiDir, { recursive: true, force: true });
  }
  // Clean symlink
  const agentsLink = path.join(fixtureDir, '.agents');
  try { fs.unlinkSync(agentsLink); } catch (e) {}

  // 1. Initialize workspace on persistent fixture
  console.log(`Initializing ${ws} workspace on sample-node-project fixture...`);
  await initCommand({ target: fixtureDir, workspace: ws, discover: true });

  // 2. Verify AGENTS.md protocol contains required sections
  const agentsMd = fs.readFileSync(path.join(aiDir, 'AGENTS.md'), 'utf8');
  assert(agentsMd.includes('Session start'), 'AGENTS.md missing Session start checklist');
  assert(agentsMd.includes('Workflows'), 'AGENTS.md missing Workflows table');
  assert(agentsMd.includes('spec-creation'), 'AGENTS.md missing spec-creation workflow reference');

  // 3. Verify workflow files are present and match expectations
  const workflowsDir = path.join(aiDir, 'workflows');
  assert(fs.existsSync(path.join(workflowsDir, 'spec-creation.md')), 'spec-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'plan-creation.md')), 'plan-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'task-creation.md')), 'task-creation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'task-implementation.md')), 'task-implementation.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'code-review.md')), 'code-review.md workflow missing');

  // 4. Test Graph analysis on fixture
  console.log('Running graph analysis on sample-node-project fixture...');
  await graphCommand({ target: fixtureDir, workspace: ws });
  const nodesDir = path.join(aiDir, 'graph', 'nodes');
  const nodes = fs.readdirSync(nodesDir);
  assert(nodes.length > 0, 'Graph nodes should not be empty');

  // Clean up fixture workspace so repository remains clean
  fs.rmSync(aiDir, { recursive: true, force: true });
  try { fs.unlinkSync(agentsLink); } catch (e) {}

  console.log('=== AGENT PROTOCOL & FIXTURE INTEGRATION TESTS PASSED ===');
}

testAgentProtocolsAndFixtures().catch(err => {
  console.error('Fixture test failed:', err);
  process.exit(1);
});
