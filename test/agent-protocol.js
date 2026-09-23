const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');

async function testAgentProtocol() {
  console.log('=== RUNNING PLAN+TASK PROTOCOL TESTS ===');
  const fixtureDir = path.join(__dirname, 'fixtures', 'sample-node-project');
  const ws = '.sample-node-project-manager';
  const aiDir = path.join(fixtureDir, ws);
  const agentsLink = path.join(fixtureDir, '.agents');
  const codexDir = path.join(fixtureDir, '.codex');
  fs.rmSync(aiDir, { recursive: true, force: true });
  try { fs.unlinkSync(agentsLink); } catch (_) {}

  await initCommand({ target: fixtureDir, workspace: ws, discover: true });

  const agentsMd = fs.readFileSync(path.join(aiDir, 'AGENTS.md'), 'utf8');
  const planWorkflow = fs.readFileSync(path.join(aiDir, 'workflows', 'pc-plan.md'), 'utf8');
  const planSkill = fs.readFileSync(path.join(aiDir, '.agents', 'skills', 'pc-plan', 'SKILL.md'), 'utf8');
  const combined = `${agentsMd}\n${planWorkflow}\n${planSkill}`;

  for (const action of ['start', 'continue', 'status', 'run']) {
    assert(
      new RegExp(`(?:/pc-plan|pc-plan).*\\b${action}\\b`, 'i').test(combined),
      `protocol does not expose /pc-plan ${action}`,
    );
  }
  assert.match(combined, /one plan|single-active-plan|Only one plan may be active/i, 'protocol does not enforce one active plan');
  assert.match(combined, /narrow task packet|Narrow task packet contract/i, 'protocol does not require narrow packets');
  assert.match(combined, /At most three|Maximum three|hard-capped at 3/i, 'protocol does not cap concurrent implementation at three');
  assert.match(combined, /Human Summary|human-readable|Plain language/i, 'protocol omits human-readable planning output');
  assert.match(combined, /Resume Checkpoint|resume|reconstruct state/i, 'protocol omits resumable planning state');
  assert.match(combined, /needs_planning/i, 'protocol omits planning-gap return');
  assert.match(combined, /advisory/i, 'protocol omits advisory questions');
  assert.match(combined, /memoryLake\.projectId/i, 'protocol omits project-scoped MemoryLake identity');
  assert.match(combined, /never (?:perform|run|search).*unfiltered workspace|never search across the workspace/i, 'protocol allows cross-project memory search');
  assert.match(combined, /root agent.*(?:owns|writes).*memory|only the root agent writes durable memory/i, 'protocol does not reserve memory writes for the root agent');
  assert(!combined.includes('/Users/brian/'), 'generated protocol contains a machine-specific path');

  const publicSkills = fs.readdirSync(path.join(aiDir, '.agents', 'skills'))
    .filter((name) => name.startsWith('pc-')).sort();
  assert.deepStrictEqual(publicSkills, ['pc-plan'], 'legacy public project-context skills were generated');
  for (const legacy of ['pc-epic', 'pc-spec', 'pc-create-tasks', 'pc-implement']) {
    assert(!fs.existsSync(path.join(aiDir, '.agents', 'skills', legacy)), `${legacy} should not be public`);
  }

  const profilesDir = path.join(aiDir, '.agents', 'agents');
  assert.deepStrictEqual(
    fs.readdirSync(profilesDir).filter((name) => name.endsWith('.md')).sort(),
    ['challenger.md', 'writer.md'],
  );
  for (const profile of ['writer.md', 'challenger.md']) {
    const content = fs.readFileSync(path.join(profilesDir, profile), 'utf8');
    assert(content.includes('model: gpt-5.6-luna'), `${profile} is not pinned to Luna`);
    assert(content.includes('reasoning_effort: high'), `${profile} is not high reasoning`);
  }

  const workflowNames = fs.readdirSync(path.join(aiDir, 'workflows')).filter((name) => name.endsWith('.md'));
  assert(workflowNames.includes('pc-plan.md'), 'pc-plan workflow missing');
  for (const legacy of ['pc-epic.md', 'pc-spec.md', 'pc-create-tasks.md', 'pc-implement.md']) {
    assert(!workflowNames.includes(legacy), `legacy workflow ${legacy} was generated`);
  }

  fs.rmSync(aiDir, { recursive: true, force: true });
  try { fs.unlinkSync(agentsLink); } catch (_) {}
  fs.rmSync(codexDir, { recursive: true, force: true });
  console.log('=== PLAN+TASK PROTOCOL TESTS PASSED ===');
}

testAgentProtocol().catch((error) => {
  console.error('Protocol test failed:', error);
  process.exit(1);
});
