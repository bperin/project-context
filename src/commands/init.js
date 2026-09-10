const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// Sheet definitions: name -> header columns.
const SHEET_DEFS = [
  { name: 'Identity', headers: ['Field', 'Value'] },
  { name: 'Specs', headers: ['UUID', 'ID', 'Title', 'Status', 'Progress', 'Dependencies', 'Skills', 'Triggers', 'Commit'] },
  { name: 'Plans', headers: ['UUID', 'ID', 'Title', 'Status', 'Progress', 'Dependencies', 'Skills', 'Triggers', 'Commit'] },
  { name: 'Tasks', headers: ['UUID', 'ID', 'Title', 'Status', 'Dependencies', 'Skills', 'Triggers', 'Commit'] },
  { name: 'Modules', headers: ['Module', 'Path', 'Import', 'Purpose'] },
  { name: 'Code Structure', headers: ['Domain', 'Path', 'Module', 'Responsibility'] },
  { name: 'Components', headers: ['Component', 'Module', 'Layer', 'Status'] },
  { name: 'Dependencies', headers: ['Dependency', 'Version', 'Module', 'Purpose'] },
  { name: 'Data Ownership', headers: ['Data', 'Owner', 'Store', 'Ephemeral?'] },
  { name: 'Realtime   Events   Channels', headers: ['Channel', 'Direction', 'Transport', 'Purpose'] },
  { name: 'Deployment', headers: ['Unit', 'Type', 'Deploys to', 'Notes'] },
  { name: 'Always-on (user-level)', headers: ['Skill', 'Path', 'Purpose'] },
  { name: 'On-demand (project-local)', headers: ['Skill', 'Path', 'Trigger'] },
  { name: 'On-demand (user-level)', headers: ['Skill', 'Path', 'Trigger'] },
  { name: 'Skill Matrix', headers: ['Trigger', 'Primary Skills', 'Secondary Skills', 'Notes'] },
  { name: 'Decisions', headers: ['ID', 'Title', 'Status', 'Date'] },
  { name: 'Workflows', headers: ['File', 'Title', 'Trigger', 'Link'] },
];

// Language skill presets. Each language maps to triggers, always-on,
// project-local, user-level, and skill matrix rows.
const LANGUAGE_PRESETS = {
  node: {
    stack: 'JavaScript/Node',
    alwaysOn: [['typescript-code-review', 'user-level', 'Code quality checks at session start']],
    projectLocal: [['typescript-unit-testing', 'user-level', 'Any task in this JS/TS project']],
    userLevel: [
      ['accelint-ts-performance', 'user-level', 'performance'],
      ['typescript-security-review', 'user-level', 'security'],
      ['js-ts-performance-readability', 'user-level', 'performance'],
    ],
    matrix: [
      ['api-validation', 'typescript-unit-testing', 'typescript-code-review', 'REST API input validation, error handling'],
      ['api-routing', 'typescript-code-review', 'js-ts-performance-readability', 'Express route wiring, controller patterns'],
      ['testing', 'typescript-unit-testing', 'accelint-ts-performance', 'Test suite design, mocking, coverage'],
      ['performance', 'accelint-ts-performance', 'js-ts-performance-readability', 'Hot path optimization, allocation reduction'],
      ['security', 'typescript-security-review', 'typescript-code-review', 'XSS, injection, JWT/OAuth flaws, dependency CVEs'],
    ],
  },
  go: {
    stack: 'Go',
    alwaysOn: [
      ['go-systems-programmer', 'user-level', 'Explicit wiring, stdlib-first, consumer-side interfaces'],
      ['go-security-expert', 'user-level', 'alg enforcement, claim validation, constant-time, crypto/rand'],
      ['go-memory-oom-guard', 'user-level', 'Key material lifetime, memory leaks in long-running processes'],
    ],
    projectLocal: [['golang-testing', 'user-level', 'Any task in this Go project']],
    userLevel: [
      ['golang-security', 'user-level', 'crypto/auth'],
      ['golang-code-style', 'user-level', 'code-review'],
      ['golang-error-handling', 'user-level', 'error-boundaries'],
      ['golang-concurrency', 'user-level', 'concurrency'],
      ['golang-performance', 'user-level', 'performance'],
      ['wycheproof', 'user-level', 'crypto-testing'],
      ['go-code-review', 'user-level', 'pr-review'],
    ],
    matrix: [
      ['crypto', 'golang-security', 'wycheproof', 'Cryptographic primitive implementation'],
      ['concurrency', 'golang-concurrency', 'golang-performance', 'Goroutines, channels, mutexes, worker pools'],
      ['error-boundaries', 'golang-error-handling', 'golang-code-style', 'Error wrapping, sentinels, slog logging'],
      ['crypto-testing', 'wycheproof', 'golang-testing', 'Known attack vectors, test vectors'],
      ['pr-review', 'go-code-review', 'golang-code-style', 'gofmt, go vet, golangci-lint, review checklist'],
      ['performance', 'golang-performance', 'golang-code-style', 'Allocation, pooling, hot-path optimization'],
    ],
  },
  rust: {
    stack: 'Rust',
    alwaysOn: [['rust-security', 'user-level', 'Supply chain safety, memory-safe FFI']],
    projectLocal: [['rust-testing', 'user-level', 'Any task in this Rust project']],
    userLevel: [
      ['rust-performance', 'user-level', 'performance'],
    ],
    matrix: [
      ['testing', 'rust-testing', 'rust-performance', 'Unit, integration, async, property-based, coverage'],
      ['performance', 'rust-performance', 'rust-security', 'Latency, throughput, allocations, binary size'],
      ['security', 'rust-security', 'rust-testing', 'cargo-audit, cargo-deny, RUSTSEC, safe FFI, fuzzing'],
    ],
  },
  python: {
    stack: 'Python',
    alwaysOn: [['python-code-style', 'user-level', 'Linting, formatting, naming, docstrings']],
    projectLocal: [['python-testing-patterns', 'user-level', 'Any task in this Python project']],
    userLevel: [
      ['python-performance-optimization', 'user-level', 'performance'],
      ['python-cybersecurity-tool-development', 'user-level', 'security'],
    ],
    matrix: [
      ['testing', 'python-testing-patterns', 'python-code-style', 'pytest, fixtures, mocking, TDD'],
      ['performance', 'python-performance-optimization', 'python-code-style', 'cProfile, memory profilers, bottlenecks'],
      ['security', 'python-cybersecurity-tool-development', 'python-code-style', 'Secure coding, async scanning, structured testing'],
    ],
  },
  unknown: {
    stack: 'Unknown',
    alwaysOn: [],
    projectLocal: [],
    userLevel: [],
    matrix: [['example-trigger', 'primary-skill', 'secondary-skill', 'Replace with your own triggers and skills']],
  },
};

// detectLanguage looks at the target directory's manifests to determine
// the primary language. Returns one of: 'node', 'go', 'rust', 'python', 'unknown'.
function detectLanguage(targetDir) {
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) return 'node';
  if (fs.existsSync(path.join(targetDir, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(targetDir, 'pyproject.toml')) || fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'setup.py'))) return 'python';
  return 'unknown';
}

async function createOverviewXlsx(xlsxPath, targetDir) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'project-context';
  wb.created = new Date();

  for (const def of SHEET_DEFS) {
    const ws = wb.addWorksheet(def.name);
    ws.columns = def.headers.map(h => ({ header: h, key: h.toLowerCase(), width: 20 }));
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: def.headers.length },
    };
  }

  // Detect language and get skill preset
  const lang = detectLanguage(targetDir);
  const preset = LANGUAGE_PRESETS[lang] || LANGUAGE_PRESETS.unknown;
  const repoName = path.basename(targetDir);

  // Identity sheet
  const identity = wb.getWorksheet('Identity');
  identity.addRow(['Project', repoName]);
  identity.addRow(['Stack', preset.stack]);
  identity.addRow(['Repo', targetDir]);

  // Sample spec/plan/task rows (kept as structural examples)
  const specs = wb.getWorksheet('Specs');
  specs.addRow(['uuid-spec-001', 'SPEC-001', 'Example feature', 'committed', '0%', 'none', 'adhd', 'example-trigger', '']);

  const plans = wb.getWorksheet('Plans');
  plans.addRow(['uuid-plan-001', 'PLAN-001', 'Example plan', 'committed', '0%', 'SPEC-001', 'planning', 'example-trigger', '']);

  const tasks = wb.getWorksheet('Tasks');
  tasks.addRow(['uuid-task-001', 'TASK-001', 'Example task', 'committed', 'PLAN-001', 'implementation', 'example-trigger', '']);

  // Skill Matrix — populated from language preset
  const matrix = wb.getWorksheet('Skill Matrix');
  for (const row of preset.matrix) {
    matrix.addRow(row);
  }

  // Always-on skills — populated from language preset
  const alwaysOn = wb.getWorksheet('Always-on (user-level)');
  for (const row of preset.alwaysOn) {
    alwaysOn.addRow(row);
  }

  // On-demand (project-local) — populated from language preset
  const onDemandProject = wb.getWorksheet('On-demand (project-local)');
  for (const row of preset.projectLocal) {
    onDemandProject.addRow(row);
  }

  // On-demand (user-level) — populated from language preset
  const onDemandUser = wb.getWorksheet('On-demand (user-level)');
  for (const row of preset.userLevel) {
    onDemandUser.addRow(row);
  }

  await wb.xlsx.writeFile(xlsxPath);
}

async function discoverProject(targetDir, wsDir) {
  console.log('Running project discovery...');

  let projectName = path.basename(path.resolve(targetDir));
  let language = detectLanguage(targetDir);
  let description = 'Project initialized with project-context';

  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.name) projectName = pkg.name;
      if (pkg.description) description = pkg.description;
    } catch (e) {}
  }

  // Write identity/project.md
  const identityDir = path.join(wsDir, 'identity');
  fs.mkdirSync(identityDir, { recursive: true });
  const projectMd = `# ${projectName}

- **Description**: ${description}
- **Primary Language**: ${language}
- **Discovered At**: ${new Date().toISOString()}
`;
  fs.writeFileSync(path.join(identityDir, 'project.md'), projectMd);

  // Populate the Identity sheet
  const xlsxPath = path.join(wsDir, 'overview.xlsx');
  if (fs.existsSync(xlsxPath)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const ws = wb.getWorksheet('Identity');
    if (ws) {
      ws.addRow(['Name', projectName]);
      ws.addRow(['Description', description]);
      ws.addRow(['Primary Language', language]);
      ws.addRow(['Discovered At', new Date().toISOString()]);
      await wb.xlsx.writeFile(xlsxPath);
    }
  }
}

// Marker prepended to generated markdown files so they are not edited by hand.
const GENERATED_MD_HEADER = '<!-- GENERATED BY project-context init — DO NOT EDIT. Edit the source in project-context/src/ instead. -->\n\n';

// copyWithHeader copies a file, prepending a generated-by marker for .md files.
function copyWithHeader(srcPath, dstPath) {
  const content = fs.readFileSync(srcPath, 'utf8');
  const ext = path.extname(dstPath);
  if (ext === '.md') {
    fs.writeFileSync(dstPath, GENERATED_MD_HEADER + content);
  } else {
    fs.copyFileSync(srcPath, dstPath);
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

  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }

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
  const srcSkills = path.join(__dirname, '..', 'skills');
  const agentsDir = path.join(wsDir, '.agents');
  if (fs.existsSync(srcSkills)) {
    const agentsInstructions = path.join(srcSkills, 'AGENTS.md');
    if (fs.existsSync(agentsInstructions)) {
      copyWithHeader(agentsInstructions, path.join(agentsDir, 'AGENTS.md'));
    }
    const skillsDir = path.join(agentsDir, 'skills');
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

  // Copy custom subagent profiles (.agents/agents/)
  const srcAgents = path.join(__dirname, '..', 'agents');
  if (fs.existsSync(srcAgents)) {
    const agentsProfilesDir = path.join(agentsDir, 'agents');
    fs.mkdirSync(agentsProfilesDir, { recursive: true });
    for (const f of fs.readdirSync(srcAgents)) {
      if (f.endsWith('.md')) {
        copyWithHeader(path.join(srcAgents, f), path.join(agentsProfilesDir, f));
      }
    }
  }

  // Create the starter overview.xlsx (source of truth)
  const xlsxPath = path.join(wsDir, 'overview.xlsx');
  if (!fs.existsSync(xlsxPath)) {
    console.log('Creating starter overview.xlsx...');
    await createOverviewXlsx(xlsxPath, targetDir);
  }

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
  // The hook is xlsx-triggered and injects fresh-session instructions when a
  // task transitions to done.
  const devinDir = path.join(targetDir, '.devin');
  fs.mkdirSync(devinDir, { recursive: true });
  const hooksPath = path.join(devinDir, 'hooks.v1.json');
  const hookScriptPath = path.join(__dirname, '..', '..', 'scripts', 'task-done-hook.js');
  const hooks = {
    PostToolUse: [
      {
        matcher: '^(write|edit|apply_patch)$',
        hooks: [
          {
            type: 'command',
            command: `node ${hookScriptPath} ${xlsxPath}`,
            timeout: 15,
          },
        ],
      },
      {
        matcher: '^exec$',
        hooks: [
          {
            type: 'command',
            command: `node ${hookScriptPath} ${xlsxPath}`,
            timeout: 15,
          },
        ],
      },
    ],
  };
  fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n');
  console.log(`Generated ${hooksPath}`);

  console.log(`Successfully initialized ${workspace} workspace at ${wsDir}`);
}

module.exports = initCommand;
