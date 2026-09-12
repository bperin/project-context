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
  assert(agentsMd.includes('pc-plan'), 'AGENTS.md missing pc-plan reference');
  assert(agentsMd.includes('pc-create-tasks'), 'AGENTS.md missing pc-create-tasks reference');
  assert(!agentsMd.includes('/Users/brian/'), 'Generated AGENTS.md contains a machine-specific path');

  // 3. Verify workflow files are present and match expectations
  const workflowsDir = path.join(aiDir, 'workflows');
  assert(fs.existsSync(path.join(workflowsDir, 'pc-plan.md')), 'pc-plan.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'pc-create-tasks.md')), 'pc-create-tasks.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'pc-implement.md')), 'pc-implement.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'pc-review.md')), 'pc-review.md workflow missing');
  assert(fs.existsSync(path.join(workflowsDir, 'overview.md')), 'overview.md workflow missing');
  for (const workflow of fs.readdirSync(workflowsDir).filter((name) => name.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(workflowsDir, workflow), 'utf8');
    assert(!content.includes('/Users/brian/'), `${workflow} contains a machine-specific path`);
  }

  // Expensive or disruptive orchestration must use explicit pinned profiles.
  const profileDir = path.join(aiDir, '.agents', 'agents');
  const expectedPins = {
    'planning-brain.md': 'gpt-5.6-sol-medium',
    'spec-writer.md': 'glm-5.2-high',
    'plan-writer.md': 'glm-5.2-high',
    'task-writer.md': 'glm-5.2-high',
    'workstream-analyst.md': 'glm-5.2-high',
    'implementer.md': 'swe-2-high',
    'reviewer.md': 'swe-1.7-medium',
  };
  for (const [file, model] of Object.entries(expectedPins)) {
    const content = fs.readFileSync(path.join(profileDir, file), 'utf8');
    assert(content.includes(`model: ${model}`), `${file} is not pinned to ${model}`);
  }

  const finalReviewSkill = fs.readFileSync(
    path.join(aiDir, '.agents', 'skills', 'pc-review', 'SKILL.md'),
    'utf8'
  );
  assert(!/triggers:\s*[\s\S]*?- model/.test(finalReviewSkill), 'pc-review should not auto-trigger from the model');

  const implementWorkflow = fs.readFileSync(path.join(workflowsDir, 'pc-implement.md'), 'utf8');
  assert(implementWorkflow.includes('Maximum three simultaneous implementation agents'), 'implementation wave is not capped at three');
  assert(implementWorkflow.includes('do not overlap another task'), 'parallel implementation lacks an ownership gate');
  assert(implementWorkflow.includes('do not commit'), 'background implementers may commit independently');
  assert(implementWorkflow.includes('project-context ready --limit 3'), 'implementation workflow does not use the ready-wave scheduler');

  // 4. Verify old workflows are NOT present
  assert(!fs.existsSync(path.join(workflowsDir, 'spec-creation.md')), 'spec-creation.md should be deleted');
  assert(!fs.existsSync(path.join(workflowsDir, 'plan-creation.md')), 'plan-creation.md should be deleted');
  assert(!fs.existsSync(path.join(workflowsDir, 'task-creation.md')), 'task-creation.md should be deleted');

  // 5. Verify JSONL data files exist
  assert(fs.existsSync(path.join(aiDir, 'data', 'tasks.jsonl')), 'tasks.jsonl missing');
  assert(fs.existsSync(path.join(aiDir, 'data', 'identity.json')), 'identity.json missing');
  assert(fs.existsSync(path.join(aiDir, 'data', 'skills.json')), 'skills.json missing');

  // 6. Test Graph analysis on fixture
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
