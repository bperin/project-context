const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ExcelJS = require('exceljs');
const {
  detectLanguage,
  copyWithHeader,
  createWorkbook,
  upgradeWorkbook,
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

  // Populate the Identity sheet
  const xlsxPath = path.join(wsDir, 'overview.xlsx');
  if (fs.existsSync(xlsxPath)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const identity = wb.getWorksheet('Identity');
    if (identity) {
      const fieldMap = { Field: 1, Value: 2 };
      const set = (field, value) => {
        for (let r = 2; r <= identity.rowCount; r++) {
          const row = identity.getRow(r);
          if (row.getCell(fieldMap.Field).value === field) {
            row.getCell(fieldMap.Value).value = value;
            return;
          }
        }
        identity.addRow([field, value]);
      };
      set('Name', projectName);
      set('Repo', repoUrl);
      set('Git Branch', branch);
      set('Git Commits', commitCount);
      await wb.xlsx.writeFile(xlsxPath);
    }
  }

  // Module discovery
  const modules = [];
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && fs.existsSync(path.join(targetDir, entry.name, 'go.mod'))) {
      const modPath = path.join(targetDir, entry.name);
      let modImport = '';
      try {
        modImport = execSync('go list -m', { cwd: modPath, encoding: 'utf8' }).trim();
      } catch (e) {}
      modules.push([entry.name, modImport, modPath, '']);
    }
  }

  if (modules.length > 0 && fs.existsSync(path.join(wsDir, 'overview.xlsx'))) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(wsDir, 'overview.xlsx'));
    const ws = wb.getWorksheet('Modules');
    if (ws) {
      for (const row of modules) ws.addRow(row);
      await wb.xlsx.writeFile(path.join(wsDir, 'overview.xlsx'));
    }
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

  // Copy .agents/ skills + shared instructions
  // Workflow skills come from src/skills/ (implement, review, create-spec, etc.)
  // Language skills come from skills/ at the package root (golang-testing,
  // typescript-unit-testing, wycheproof, etc.) — bundled so project-context
  // works without ~/.agents/skills/ on the target machine.
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
  // These have subdirectories (references/, evals/, etc.) so use recursive copy.
  if (fs.existsSync(bundledSkills)) {
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

  // Create the starter overview.xlsx (source of truth)
  const language = detectLanguage(targetDir);
  const xlsxPath = path.join(wsDir, 'overview.xlsx');
  const repoName = path.basename(targetDir);
  await createWorkbook(xlsxPath, language, repoName, repoName);

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
