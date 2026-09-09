const fs = require('fs');
const path = require('path');
const graphCommand = require('./graph');

async function discoverProject(targetDir, aiDir) {
  console.log('Running project discovery...');
  
  // 1. Detect project name and details from package.json, go.mod, etc., or git remote
  let projectName = path.basename(path.resolve(targetDir));
  let language = 'unknown';
  let description = 'Project initialized with project-context';
  let dependencies = [];

  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.name) projectName = pkg.name;
      if (pkg.description) description = pkg.description;
      language = 'node';
      dependencies = Object.keys(pkg.dependencies || {});
    } catch (e) {}
  } else if (fs.existsSync(path.join(targetDir, 'go.mod'))) {
    language = 'go';
  } else if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) {
    language = 'rust';
  } else if (fs.existsSync(path.join(targetDir, 'pyproject.toml')) || fs.existsSync(path.join(targetDir, 'requirements.txt'))) {
    language = 'python';
  }

  // Write identity/project.md
  const identityDir = path.join(aiDir, 'context', 'identity');
  fs.mkdirSync(identityDir, { recursive: true });
  
  const projectMd = `# Project Identity: ${projectName}

## Overview
- **Name**: ${projectName}
- **Description**: ${description}
- **Primary Language**: ${language}
- **Discovered At**: ${new Date().toISOString()}

## Key Directories
- Top-level directories inspected and mapped into graph nodes.
`;
  fs.writeFileSync(path.join(identityDir, 'project.md'), projectMd);

  // Run graph generation as part of discovery
  await graphCommand({ target: targetDir, workspace: path.basename(aiDir) });
}

async function initCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  console.log(`Initializing .ai workspace at ${aiDir}...`);

  // Create full directory structure
  const dirs = [
    aiDir,
    path.join(aiDir, 'context', 'architecture'),
    path.join(aiDir, 'context', 'decisions'),
    path.join(aiDir, 'context', 'identity'),
    path.join(aiDir, 'context', 'plans'),
    path.join(aiDir, 'context', 'skills'),
    path.join(aiDir, 'context', 'specs'),
    path.join(aiDir, 'context', 'state'),
    path.join(aiDir, 'context', 'tasks'),
    path.join(aiDir, 'context', 'workflows'),
    path.join(aiDir, 'graph', 'edges'),
    path.join(aiDir, 'graph', 'nodes'),
    path.join(aiDir, 'templates')
  ];

  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }

  const srcTemplates = path.join(__dirname, '..', 'templates');
  const srcWorkflows = path.join(__dirname, '..', 'workflows');

  // Copy templates into .ai/templates/
  if (fs.existsSync(srcTemplates)) {
    const templateFiles = fs.readdirSync(srcTemplates);
    for (const f of templateFiles) {
      const srcPath = path.join(srcTemplates, f);
      if (fs.statSync(srcPath).isFile()) {
        if (f === 'AGENTS.md') {
          fs.copyFileSync(srcPath, path.join(aiDir, 'AGENTS.md'));
        } else if (f === 'STATE.md') {
          fs.copyFileSync(srcPath, path.join(aiDir, 'STATE.md'));
        } else if (f === 'DECISIONS.md') {
          fs.copyFileSync(srcPath, path.join(aiDir, 'DECISIONS.md'));
        } else if (f === 'current.md') {
          fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'state', 'current.md'));
        } else if (f === 'overview.csv') {
          fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'state', 'overview.csv'));
        } else {
          fs.copyFileSync(srcPath, path.join(aiDir, 'templates', f));
          
          // Also place templates in appropriate context subdirs as specified by architecture
          if (f.includes('SPEC-')) {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'specs', f));
          } else if (f.includes('PLAN-')) {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'plans', f));
          } else if (f.includes('TASK-')) {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'tasks', f));
          } else if (f.includes('ADR-')) {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'decisions', f));
          } else if (f === 'architecture.template.md') {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'architecture', f));
          } else if (f === 'identity.template.md') {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'identity', f));
          } else if (f === 'state.template.md') {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'state', f));
          } else if (f === 'skill.template.md' || f === 'skill.md') {
            fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'skills', f));
          }
        }
      }
    }
  }

  // Copy workflows into .ai/context/workflows/
  if (fs.existsSync(srcWorkflows)) {
    const wfFiles = fs.readdirSync(srcWorkflows);
    for (const f of wfFiles) {
      const srcPath = path.join(srcWorkflows, f);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, path.join(aiDir, 'context', 'workflows', f));
      }
    }
  }

  // Ensure core root files exist if not copied via templates
  if (!fs.existsSync(path.join(aiDir, 'AGENTS.md'))) {
    fs.writeFileSync(path.join(aiDir, 'AGENTS.md'), '# AGENTS Protocol\n');
  }
  if (!fs.existsSync(path.join(aiDir, 'STATE.md'))) {
    fs.writeFileSync(path.join(aiDir, 'STATE.md'), '# State\n');
  }
  if (!fs.existsSync(path.join(aiDir, 'DECISIONS.md'))) {
    fs.writeFileSync(path.join(aiDir, 'DECISIONS.md'), '# Decisions\n');
  }

  if (options.discover) {
    await discoverProject(targetDir, aiDir);
  }

  console.log(`Successfully initialized .ai workspace at ${aiDir}`);
}

module.exports = initCommand;
