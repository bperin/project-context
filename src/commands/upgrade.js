const fs = require('fs');
const path = require('path');
const { copyWithHeader, detectLanguage, createDataFiles, readIdentity, writeJSON } = require('./shared');

async function upgradeCommand(options) {
  const targetDir = path.resolve(options.target || '.');
  const repoName = path.basename(targetDir);

  // Find existing workspace, or default to .{reponame}-manager
  let workspace = options.workspace;
  if (!workspace) {
    const expected = `.${repoName}-manager`;
    const entries = fs.readdirSync(targetDir);
    const candidates = entries.filter(e => e.startsWith('.') && fs.statSync(path.join(targetDir, e)).isDirectory());
    const known = candidates.find(e => e === expected || e.endsWith('-manager'));
    workspace = known || expected;
  }

  const wsDir = path.join(targetDir, workspace);
  if (!fs.existsSync(wsDir)) {
    console.error(`Workspace not found: ${wsDir}`);
    console.error('Run init first.');
    process.exit(1);
  }

  console.log(`Upgrading ${workspace} workspace at ${wsDir}...`);

  // Source root for assets. Defaults to this package's src/ directory.
  // Pass --source <dir> to sync assets from another checkout (e.g. when
  // running a vendored binary that does not bundle the markdown assets).
  const srcRoot = options.source ? path.resolve(options.source) : path.join(__dirname, '..');
  const srcWorkflows = path.join(srcRoot, 'workflows');
  const srcSkills = path.join(srcRoot, 'skills');
  const srcAgents = path.join(srcRoot, 'agents');
  const srcTemplates = path.join(srcRoot, 'templates');

  // Clean up obsolete files from older versions. We don't migrate data
  // from these — we just remove them. Existing specs/plans/tasks MD
  // files are left alone.
  const obsoleteFiles = [
    path.join(wsDir, 'overview.xlsx'),
    path.join(wsDir, 'overview.csv'),
    path.join(wsDir, 'workflows', 'spec-creation.md'),
    path.join(wsDir, 'workflows', 'plan-creation.md'),
    path.join(wsDir, 'workflows', 'task-creation.md'),
    // Old workflow names (pre-skill-name alignment)
    path.join(wsDir, 'workflows', 'plan-workflow.md'),
    path.join(wsDir, 'workflows', 'task-workflow.md'),
    path.join(wsDir, 'workflows', 'task-implementation.md'),
    path.join(wsDir, 'workflows', 'code-review.md'),
    // Old templates no longer generated
    path.join(wsDir, 'templates', 'STATE.md'),
    path.join(wsDir, 'templates', 'current.md'),
    path.join(wsDir, 'templates', 'DECISIONS.md'),
    path.join(wsDir, 'templates', 'skill.md'),
    path.join(wsDir, 'templates', 'skill.template.md'),
    path.join(wsDir, 'templates', 'state.template.md'),
    path.join(wsDir, 'templates', 'workflow.template.md'),
    path.join(wsDir, 'templates', 'architecture.template.md'),
    path.join(wsDir, 'templates', 'identity.template.md'),
    path.join(wsDir, 'templates', 'ADR-NNN.template.md'),
  ];
  const obsoleteSkillDirs = [
    // Old workflow names (pre-pc- prefix)
    'create-spec', 'create-plan', 'create-task',
    'approve-spec', 'approve-plan',
    'spec-optimizer', 'plan-optimizer', 'task-optimizer',
    // Old non-prefixed skill names (renamed to pc-*)
    'code-optimizer', 'context', 'implement', 'implementer',
    'inspect-project', 'plan', 'review', 'reviewer', 'test', 'uuid',
  ];
  const obsoleteAgentProfiles = [
    'spec-optimizer.md', 'plan-optimizer.md', 'task-optimizer.md',
  ];

  for (const f of obsoleteFiles) {
    if (fs.existsSync(f)) {
      fs.rmSync(f, { force: true });
      console.log(`Removed obsolete file: ${path.relative(wsDir, f)}`);
    }
  }
  for (const skillName of obsoleteSkillDirs) {
    const d = path.join(wsDir, '.agents', 'skills', skillName);
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
      console.log(`Removed obsolete skill: ${skillName}`);
    }
  }
  for (const agentFile of obsoleteAgentProfiles) {
    for (const agentsBase of [path.join(wsDir, '.agents', 'agents'), path.join(targetDir, '.devin', 'agents')]) {
      const f = path.join(agentsBase, agentFile);
      if (fs.existsSync(f)) {
        fs.rmSync(f, { force: true });
        console.log(`Removed obsolete agent profile: ${path.relative(targetDir, f)}`);
      }
    }
  }

  // Ensure directories exist
  const dirs = [
    path.join(wsDir, '.agents', 'skills'),
    path.join(wsDir, 'workflows'),
    path.join(wsDir, 'specs'),
    path.join(wsDir, 'plans'),
    path.join(wsDir, 'tasks'),
    path.join(wsDir, 'decisions'),
    path.join(wsDir, 'architecture'),
    path.join(wsDir, 'identity'),
    path.join(wsDir, 'graph'),
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });

  // Copy AGENTS.md (workflow protocol)
  const agentsTemplate = path.join(srcTemplates, 'AGENTS.md');
  if (fs.existsSync(agentsTemplate)) {
    copyWithHeader(agentsTemplate, path.join(wsDir, 'AGENTS.md'));
  } else {
    fs.writeFileSync(path.join(wsDir, 'AGENTS.md'), '# Agent Protocol\n');
  }

  // Copy workflow .md files
  if (fs.existsSync(srcWorkflows)) {
    for (const f of fs.readdirSync(srcWorkflows)) {
      if (f.endsWith('.md') && !f.includes('template')) {
        copyWithHeader(path.join(srcWorkflows, f), path.join(wsDir, 'workflows', f));
      }
    }
  }

  // Copy document templates (SPEC/PLAN/TASK/ADR/etc.) so the workspace
  // has the current templates without re-running init.
  if (fs.existsSync(srcTemplates)) {
    const dstTemplates = path.join(wsDir, 'templates');
    fs.mkdirSync(dstTemplates, { recursive: true });
    for (const f of fs.readdirSync(srcTemplates)) {
      if (!f.endsWith('.md')) continue;
      copyWithHeader(path.join(srcTemplates, f), path.join(dstTemplates, f));
    }
  }

  // Copy workflow skills from src/skills/
  const agentsDir = path.join(wsDir, '.agents');
  const skillsDir = path.join(agentsDir, 'skills');

  if (fs.existsSync(srcSkills)) {
    const agentsInstructions = path.join(srcSkills, 'AGENTS.md');
    if (fs.existsSync(agentsInstructions)) {
      copyWithHeader(agentsInstructions, path.join(agentsDir, 'AGENTS.md'));
    }
    for (const skillName of fs.readdirSync(srcSkills)) {
      if (skillName === 'AGENTS.md') continue;
      const srcSkillDir = path.join(srcSkills, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;
      const dstSkillDir = path.join(skillsDir, skillName);
      fs.rmSync(dstSkillDir, { recursive: true, force: true });
      fs.cpSync(srcSkillDir, dstSkillDir, { recursive: true });
    }
  }

  // Keep one canonical discovery path for generated subagent profiles. The root
  // .agents symlink exposes workspace/.agents/agents to Devin, so duplicating the
  // same names under .devin/agents causes ambiguous profile discovery.
  if (fs.existsSync(srcAgents)) {
    const profileFiles = fs.readdirSync(srcAgents).filter((f) => f.endsWith('.md'));
    const dstAgentsDir = path.join(agentsDir, 'agents');
    fs.mkdirSync(dstAgentsDir, { recursive: true });
    for (const f of profileFiles) {
      copyWithHeader(path.join(srcAgents, f), path.join(dstAgentsDir, f));
    }

    // Older upgrades copied project-context profiles here too. Remove only the
    // managed filenames; preserve unrelated user-owned Devin profiles.
    const devinAgentsDir = path.join(targetDir, '.devin', 'agents');
    if (fs.existsSync(devinAgentsDir)) {
      for (const f of profileFiles) {
        const duplicatePath = path.join(devinAgentsDir, f);
        if (fs.existsSync(duplicatePath)) fs.rmSync(duplicatePath, { force: true });
      }
    }
  }

  // Language skills are NOT copied by upgrade. The target repo's
  // Makefile (or equivalent) vendors language-specific skills from
  // ~/.agents/skills/ via `make skills`. Upgrade only manages workflow
  // skills (src/skills/) and subagent profiles (src/agents/). Copying
  // all bundled language skills here pollutes the target workspace
  // with irrelevant skills (e.g. Rust skills in a Go repo).

  // Ensure data files exist (create if missing, preserve if existing)
  const language = detectLanguage(targetDir);
  const dataDir = path.join(wsDir, 'data');
  if (!fs.existsSync(path.join(dataDir, 'identity.json'))) {
    createDataFiles(wsDir, language, repoName, repoName);
  }

  // Ensure .agents symlink exists (unless --no-symlink)
  if (options.symlink !== false) {
    const agentsLink = path.join(targetDir, '.agents');
    try { fs.rmSync(agentsLink, { recursive: true, force: true }); } catch (e) {}
    fs.symlinkSync(path.join(workspace, '.agents'), agentsLink);
    console.log(`Symlinked .agents → ${workspace}/.agents`);
  }

  // Regenerate hooks (unless --no-hooks)
  if (options.hooks !== false) {
    const devinDir = path.join(targetDir, '.devin');
    fs.mkdirSync(devinDir, { recursive: true });
    const hooksPath = path.join(devinDir, 'hooks.v1.json');
    const hookPath = path.join(__dirname, '..', '..', 'scripts', 'task-done-hook.js');
    const hooks = {
      PostToolUse: [
        {
          command: 'node',
          args: [hookPath, '-t', targetDir, '-w', workspace, '--tool', '{{tool}}', '--output-file', '{{output_file}}'],
          match: 'setStatus|edit|write|notebook_edit',
        },
      ],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');
    console.log(`Generated ${hooksPath}`);
  }

  console.log(`Successfully upgraded ${workspace} workspace at ${wsDir}`);
}

module.exports = upgradeCommand;
