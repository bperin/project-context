const fs = require('fs');
const path = require('path');
const { copyWithHeader, detectLanguage, upgradeWorkbook } = require('./shared');

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
  const agentsTemplate = path.join(__dirname, '..', 'templates', 'AGENTS.md');
  if (fs.existsSync(agentsTemplate)) {
    copyWithHeader(agentsTemplate, path.join(wsDir, 'AGENTS.md'));
  } else {
    fs.writeFileSync(path.join(wsDir, 'AGENTS.md'), '# Agent Protocol\n');
  }

  // Copy workflow .md files
  const srcWorkflows = path.join(__dirname, '..', 'workflows');
  if (fs.existsSync(srcWorkflows)) {
    for (const f of fs.readdirSync(srcWorkflows)) {
      if (f.endsWith('.md') && !f.includes('template')) {
        copyWithHeader(path.join(srcWorkflows, f), path.join(wsDir, 'workflows', f));
      }
    }
  }

  // Copy workflow skills from src/skills/
  const srcSkills = path.join(__dirname, '..', 'skills');
  const bundledSkills = path.join(__dirname, '..', '..', 'skills');
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

  // Copy bundled language skills from skills/ (at package root)
  if (fs.existsSync(bundledSkills)) {
    for (const skillName of fs.readdirSync(bundledSkills)) {
      const srcSkillDir = path.join(bundledSkills, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;
      const dstSkillDir = path.join(skillsDir, skillName);
      fs.rmSync(dstSkillDir, { recursive: true, force: true });
      fs.cpSync(srcSkillDir, dstSkillDir, { recursive: true });
    }
  }

  // Upgrade xlsx: add missing sheets/headers, seed empty Skills/Matrix/Workflows
  const language = detectLanguage(targetDir);
  const xlsxPath = path.join(wsDir, 'overview.xlsx');
  await upgradeWorkbook(xlsxPath, language);

  // Ensure .agents symlink exists
  const agentsLink = path.join(targetDir, '.agents');
  try { fs.rmSync(agentsLink, { recursive: true, force: true }); } catch (e) {}
  fs.symlinkSync(path.join(workspace, '.agents'), agentsLink);
  console.log(`Symlinked .agents → ${workspace}/.agents`);

  // Regenerate hooks
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

  console.log(`Successfully upgraded ${workspace} workspace at ${wsDir}`);
}

module.exports = upgradeCommand;
