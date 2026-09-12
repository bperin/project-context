const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  detectLanguage,
  copyWithHeader,
  createDataFiles,
  readIdentity,
  writeJSON,
  readSpecs,
  readPlans,
  readTaskFiles,
  appendJSONL,
} = require('./shared');

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function v5UUID(name, namespace = UUID_NAMESPACE) {
  return require('uuid').v5(name, namespace);
}

async function discoverProject(targetDir, wsDir) {
  console.log('Running project discovery...');

  let projectName = path.basename(path.resolve(targetDir));
  let repoUrl = '';
  let branch = '';
  let commitCount = 0;
  try {
    repoUrl = execSync('git remote get-url origin', { cwd: targetDir, encoding: 'utf8' }).trim();
  } catch (e) {}
  try {
    branch = execSync('git branch --show-current', { cwd: targetDir, encoding: 'utf8' }).trim();
  } catch (e) {}
  try {
    commitCount = parseInt(execSync('git rev-list --count HEAD', { cwd: targetDir, encoding: 'utf8' }).trim(), 10);
  } catch (e) {}

  // Write identity/project.md
  const identityDir = path.join(wsDir, 'identity');
  fs.mkdirSync(identityDir, { recursive: true });
  const projectMd = `# ${projectName}

Primary project identity and source-of-truth metadata.
`;
  fs.writeFileSync(path.join(identityDir, 'project.md'), projectMd);

  // Update data/identity.json with discovered info
  const identityPath = path.join(wsDir, 'data', 'identity.json');
  const identity = readIdentity(wsDir);
  identity.name = projectName;
  identity.repo = repoUrl;
  identity.gitBranch = branch;
  identity.gitCommits = commitCount;
  writeJSON(identityPath, identity);

  // Module discovery (Go)
  const modules = [];
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && fs.existsSync(path.join(targetDir, entry.name, 'go.mod'))) {
      const modPath = path.join(targetDir, entry.name);
      let modImport = '';
      try {
        modImport = execSync('go list -m', { cwd: modPath, encoding: 'utf8' }).trim();
      } catch (e) {}
      modules.push({ module: entry.name, import: modImport, path: modPath, purpose: '' });
    }
  }

  if (modules.length > 0) {
    writeJSON(path.join(wsDir, 'data', 'modules.json'), { modules });
  }
}

async function initCommand(options) {
  const targetDir = path.resolve(options.target);

  // Default workspace name is .{reponame}-manager
  let workspace = options.workspace;
  if (!workspace) {
    const repoName = path.basename(targetDir);
    workspace = `.${repoName}-manager`;
  }

  const wsDir = path.join(targetDir, workspace);

  console.log(`Initializing ${workspace} workspace at ${wsDir}...`);

  if (fs.existsSync(wsDir)) {
    console.error(`Workspace already exists: ${wsDir}`);
    console.error('Use the upgrade command to refresh it in place.');
    process.exit(1);
  }

  // Flat directory structure — no nesting
  const dirs = [
    wsDir,
    path.join(wsDir, '.agents', 'skills'),
    path.join(wsDir, 'workflows'),
    path.join(wsDir, 'specs'),
    path.join(wsDir, 'plans'),
    path.join(wsDir, 'tasks'),
    path.join(wsDir, 'decisions'),
    path.join(wsDir, 'architecture'),
    path.join(wsDir, 'identity'),
    path.join(wsDir, 'graph'),
    path.join(wsDir, 'data'),
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

  // Copy document templates (SPEC/PLAN/TASK/ADR/etc.)
  const srcTemplates = path.join(__dirname, '..', 'templates');
  if (fs.existsSync(srcTemplates)) {
    const dstTemplates = path.join(wsDir, 'templates');
    fs.mkdirSync(dstTemplates, { recursive: true });
    for (const f of fs.readdirSync(srcTemplates)) {
      if (!f.endsWith('.md')) continue;
      copyWithHeader(path.join(srcTemplates, f), path.join(dstTemplates, f));
    }
  }

  // Copy .agents/ skills + shared instructions
  const srcSkills = path.join(__dirname, '..', 'skills');
  const bundledSkills = path.join(__dirname, '..', '..', 'skills');
  const agentsDir = path.join(wsDir, '.agents');
  const skillsDir = path.join(agentsDir, 'skills');

  // Copy shared AGENTS.md from src/skills/
  if (fs.existsSync(srcSkills)) {
    const agentsInstructions = path.join(srcSkills, 'AGENTS.md');
    if (fs.existsSync(agentsInstructions)) {
      copyWithHeader(agentsInstructions, path.join(agentsDir, 'AGENTS.md'));
    }
  }

  // Copy workflow skills from src/skills/
  if (fs.existsSync(srcSkills)) {
    for (const skillName of fs.readdirSync(srcSkills)) {
      if (skillName === 'AGENTS.md') continue;
      const srcSkillDir = path.join(srcSkills, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;
      const dstSkillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(dstSkillDir, { recursive: true });
      for (const f of fs.readdirSync(srcSkillDir)) {
        copyWithHeader(path.join(srcSkillDir, f), path.join(dstSkillDir, f));
      }
    }
  }

  // Copy bundled language skills from skills/ (at package root)
  // Skip if --no-bundled-skills is set. Language skills belong at the
  // user level (~/.agents/skills/) or repo root, not in every workspace.
  if (options.bundledSkills !== false && fs.existsSync(bundledSkills)) {
    for (const skillName of fs.readdirSync(bundledSkills)) {
      const srcSkillDir = path.join(bundledSkills, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;
      const dstSkillDir = path.join(skillsDir, skillName);
      fs.cpSync(srcSkillDir, dstSkillDir, { recursive: true });
    }
  }

  // Copy custom subagent profiles (.agents/agents/)
  const srcAgents = path.join(__dirname, '..', 'agents');
  if (fs.existsSync(srcAgents)) {
    const agentsDst = path.join(agentsDir, 'agents');
    fs.mkdirSync(agentsDst, { recursive: true });
    for (const f of fs.readdirSync(srcAgents)) {
      if (f.endsWith('.md')) {
        copyWithHeader(path.join(srcAgents, f), path.join(agentsDst, f));
      }
    }
  }

  // Create the data files (identity.json, skills.json, tasks.jsonl, etc.)
  const language = detectLanguage(targetDir);
  const repoName = path.basename(targetDir);
  createDataFiles(wsDir, language, repoName, repoName);

  if (options.discover) {
    await discoverProject(targetDir, wsDir);
  }

  // Symlink .agents → workspace/.agents at project root (Devin discovers skills here)
  const agentsLink = path.join(targetDir, '.agents');
  if (!fs.existsSync(agentsLink)) {
    fs.symlinkSync(path.join(workspace, '.agents'), agentsLink);
    console.log(`Symlinked .agents → ${workspace}/.agents`);
  }

  // Generate .devin/hooks.v1.json for the task-done hook.
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

  console.log(`Successfully initialized ${workspace} workspace at ${wsDir}`);
}

module.exports = initCommand;
