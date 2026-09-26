const fs = require('fs');
const path = require('path');
const assert = require('assert');
const initCommand = require('../src/commands/init');
const graphCommand = require('../src/commands/graph');
const addCommand = require('../src/commands/add');
const setStatusCommand = require('../src/commands/set-status');
const syncCommand = require('../src/commands/sync');
const updateCommand = require('../src/commands/update');
const upgradeCommand = require('../src/commands/upgrade');
const { readPlans, getTaskStates, readJSONL, readJSON } = require('../src/commands/shared');

async function stressTest() {
  console.log('=== STARTING PLAN+TASK STRESS TESTS ===');
  const emptyDir = path.join('/tmp', `stress-empty-${Date.now()}`);
  fs.mkdirSync(emptyDir, { recursive: true });
  await initCommand({ target: emptyDir, workspace: '.test-manager', discover: true });
  assert(fs.existsSync(path.join(emptyDir, '.test-manager', 'plans')));
  assert(fs.existsSync(path.join(emptyDir, '.test-manager', 'tasks')));
  assert(!fs.existsSync(path.join(emptyDir, '.test-manager', 'specs')));
  assert(!fs.existsSync(path.join(emptyDir, '.test-manager', 'epics')));
  assert(!fs.existsSync(path.join(emptyDir, '.test-manager', '.agents', 'AGENTS.md')));
  assert.deepStrictEqual(
    readJSON(path.join(emptyDir, '.test-manager', 'data', 'skills.json')).skills
      .filter((skill) => skill.skill !== 'grilling' && skill.skill !== 'adhd'),
    [],
    'plain Node managers must not receive a framework baseline',
  );

  const nextDir = path.join('/tmp', `stress-next-${Date.now()}`);
  fs.mkdirSync(nextDir, { recursive: true });
  fs.writeFileSync(path.join(nextDir, 'package.json'), JSON.stringify({
    name: 'next-fixture',
    devDependencies: { next: '^15.0.0' },
  }));
  await initCommand({ target: nextDir, workspace: '.next-manager', discover: false });
  const nextSkills = readJSON(path.join(nextDir, '.next-manager', 'data', 'skills.json'));
  assert.deepStrictEqual(
    nextSkills.skills.filter((skill) => skill.layer !== 'user-local').map((skill) => skill.skill).sort(),
    ['vercel-react-best-practices'],
    'Next managers must receive only the Vercel automatic framework baseline',
  );
  assert(nextSkills.skills.some((skill) => skill.skill === 'typescript-magician' && skill.workflowTrigger === 'type-system'));
  assert(nextSkills.skills.some((skill) => skill.skill === 'code-review-excellence' && skill.workflowTrigger === 'pr-review'));
  assert.strictEqual(nextSkills.sharedSkillsRoot, '/Users/brian/.agents/skills');
  nextSkills.matrix.push({
    trigger: 'performance', language: 'JavaScript/Node', primarySkills: 'accelint-ts-performance',
    secondarySkills: 'js-ts-performance-readability', notes: 'Hot path optimization, allocation reduction',
  });
  nextSkills.skills.push({
    skill: 'typescript-code-review', path: 'user-level', layer: 'always-on', workflowTrigger: 'all',
    purpose: 'Code quality checks at session start',
  });
  fs.writeFileSync(path.join(nextDir, '.next-manager', 'data', 'skills.json'), JSON.stringify(nextSkills, null, 2));
  await upgradeCommand({ target: nextDir, workspace: '.next-manager' });
  const migratedNextSkills = readJSON(path.join(nextDir, '.next-manager', 'data', 'skills.json'));
  assert(!migratedNextSkills.skills.some((skill) => skill.skill === 'typescript-code-review'));
  assert(migratedNextSkills.skills.some((skill) => skill.skill === 'vercel-react-best-practices'));
  assert(!migratedNextSkills.matrix.some((row) => row.trigger === 'performance' && row.primarySkills === 'accelint-ts-performance'));

  const goDir = path.join('/tmp', `stress-go-${Date.now()}`);
  fs.mkdirSync(goDir, { recursive: true });
  fs.writeFileSync(path.join(goDir, 'go.mod'), 'module example.com/foo\n\ngo 1.22\n');
  fs.writeFileSync(path.join(goDir, 'main.go'), 'package main\n');
  await initCommand({ target: goDir, workspace: '.go-manager', discover: true });
  await graphCommand({ target: goDir, workspace: '.go-manager' });
  assert(fs.readdirSync(path.join(goDir, '.go-manager', 'graph', 'nodes')).length > 0);

  const fullDir = path.join('/tmp', `stress-full-${Date.now()}`);
  const ws = '.full-manager';
  const aiDir = path.join(fullDir, ws);
  fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(path.join(fullDir, 'package.json'), '{"name":"stress"}\n');
  await initCommand({ target: fullDir, workspace: ws, discover: false });

  const legacyAgents = path.join(fullDir, '.devin', 'agents');
  fs.mkdirSync(legacyAgents, { recursive: true });
  fs.writeFileSync(path.join(legacyAgents, 'implementer.md'), 'obsolete generated profile\n');
  fs.writeFileSync(path.join(legacyAgents, 'personal.md'), 'user profile\n');
  await upgradeCommand({ target: fullDir, workspace: ws });
  assert(!fs.existsSync(path.join(legacyAgents, 'implementer.md')), 'upgrade kept obsolete managed profile');
  assert(fs.existsSync(path.join(legacyAgents, 'personal.md')), 'upgrade removed unrelated user profile');
  assert.deepStrictEqual(
    fs.readdirSync(path.join(aiDir, '.agents', 'skills')).filter((name) => name.startsWith('pc-')).sort(),
    ['pc-plan'],
  );

  const legacySkillDir = path.join(aiDir, '.agents', 'skills');
  fs.mkdirSync(path.join(legacySkillDir, 'typescript-code-review'), { recursive: true });
  fs.mkdirSync(path.join(legacySkillDir, 'project-added-skill'), { recursive: true });
  fs.writeFileSync(path.join(aiDir, '.agents', 'AGENTS.md'), 'legacy generated instructions\n');
  fs.writeFileSync(path.join(aiDir, 'workflows', 'overview.md'), 'legacy overview\n');
  const legacySkillsPath = path.join(aiDir, 'data', 'skills.json');
  const legacySkills = readJSON(legacySkillsPath);
  legacySkills.skills.push(
    { skill: 'typescript-code-review', path: 'user-level', layer: 'always-on', workflowTrigger: 'all', purpose: 'Code quality checks at session start' },
    { skill: 'project-added-skill', path: 'project-local', layer: 'always-on', workflowTrigger: 'all', purpose: 'preserve me' },
  );
  legacySkills.matrix.push({
    trigger: 'testing', language: 'JavaScript/Node', primarySkills: 'typescript-unit-testing',
    secondarySkills: 'accelint-ts-performance', notes: 'Test suite design, mocking, coverage',
  });
  fs.writeFileSync(legacySkillsPath, JSON.stringify(legacySkills, null, 2));
  await upgradeCommand({ target: fullDir, workspace: ws });
  assert(!fs.existsSync(path.join(legacySkillDir, 'typescript-code-review')), 'upgrade kept a known bundled shared skill');
  assert(fs.existsSync(path.join(legacySkillDir, 'project-added-skill')), 'upgrade removed an unknown local skill');
  assert(!fs.existsSync(path.join(aiDir, '.agents', 'AGENTS.md')), 'upgrade kept generated shared agent instructions');
  assert(!fs.existsSync(path.join(aiDir, 'workflows', 'overview.md')), 'upgrade kept generated overview guidance');
  assert(!readJSON(legacySkillsPath).skills.some((skill) => skill.skill === 'typescript-code-review'), 'upgrade kept a legacy Node default');
  assert(!readJSON(legacySkillsPath).matrix.some((row) => row.trigger === 'testing' && row.primarySkills === 'typescript-unit-testing'), 'upgrade kept a legacy Node matrix route');
  assert(readJSON(legacySkillsPath).skills.some((skill) => skill.skill === 'project-added-skill'), 'upgrade removed an explicit project skill');

  await addCommand({ type: 'plan', title: 'First Plan', status: 'committed', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir)[0].status, 'committed', 'sync changed a childless plan');

  await addCommand({ type: 'task', title: 'First Task', parent: 'PLAN-001', target: fullDir, workspace: ws });
  await updateCommand({
    id: 'TASK-001', title: 'Bounded First Task', skills: 'node-testing',
    target: fullDir, workspace: ws,
  });
  await setStatusCommand({ id: 'TASK-001', status: 'done', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir).find((plan) => plan.id === 'PLAN-001').status, 'done', 'tasks did not roll up to plan');

  await addCommand({ type: 'plan', title: 'Second Plan', status: 'committed', target: fullDir, workspace: ws });
  await addCommand({ type: 'task', title: 'Planning Gap', parent: 'PLAN-002', target: fullDir, workspace: ws });
  await setStatusCommand({ id: 'TASK-002', status: 'needs_planning', target: fullDir, workspace: ws });
  await syncCommand({ target: fullDir, workspace: ws });
  assert.strictEqual(readPlans(aiDir).find((plan) => plan.id === 'PLAN-002').status, 'needs_planning', 'needs_planning did not propagate to plan');

  const states = getTaskStates(aiDir);
  assert.strictEqual(states.get('TASK-001').title, 'Bounded First Task');
  assert.strictEqual(states.get('TASK-001').skills, 'node-testing');
  assert.strictEqual(states.get('TASK-002').status, 'needs_planning');
  const timeline = readJSONL(path.join(aiDir, 'plans', 'PLAN-002.timeline.jsonl'));
  assert(timeline.some((event) => event.task === 'TASK-002' && event.status === 'needs_planning'));

  fs.rmSync(emptyDir, { recursive: true, force: true });
  fs.rmSync(nextDir, { recursive: true, force: true });
  fs.rmSync(goDir, { recursive: true, force: true });
  fs.rmSync(fullDir, { recursive: true, force: true });
  console.log('=== PLAN+TASK STRESS TESTS PASSED ===');
}

stressTest().catch((error) => {
  console.error('Stress test failed:', error);
  process.exit(1);
});
