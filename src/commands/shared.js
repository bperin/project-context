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
  { name: 'Skills', headers: ['Skill', 'Path', 'Layer', 'Workflow/Trigger', 'Purpose'] },
  { name: 'Skill Matrix', headers: ['Trigger', 'Language', 'Primary Skills', 'Secondary Skills', 'Notes'] },
  { name: 'Decisions', headers: ['ID', 'Title', 'Status', 'Date'] },
  { name: 'Workflows', headers: ['File', 'Title', 'Trigger', 'Link'] },
];

// Language skill presets. Each language maps to triggers, always-on,
// project-local, user-level, and skill matrix rows.
const LANGUAGE_PRESETS = {
  node: {
    stack: 'JavaScript/Node',
    skills: [
      ['typescript-code-review', 'user-level', 'always-on', 'all', 'Code quality checks at session start'],
      ['typescript-unit-testing', 'user-level', 'project-local', 'all', 'Any task in this JS/TS project'],
      ['typescript-security-review', 'user-level', 'user-local', 'security', 'Security review for JS/TS code'],
      ['accelint-ts-performance', 'user-level', 'user-local', 'performance', 'JS/TS performance audit and optimization'],
      ['js-ts-performance-readability', 'user-level', 'user-local', 'api-routing', 'Readable, performant JS/TS'],
    ],
    matrix: [
      ['api-validation', 'JavaScript/Node', 'typescript-unit-testing', 'typescript-code-review', 'REST API input validation, error handling'],
      ['api-routing', 'JavaScript/Node', 'typescript-code-review', 'js-ts-performance-readability', 'Express route wiring, controller patterns'],
      ['testing', 'JavaScript/Node', 'typescript-unit-testing', 'accelint-ts-performance', 'Test suite design, mocking, coverage'],
      ['performance', 'JavaScript/Node', 'accelint-ts-performance', 'js-ts-performance-readability', 'Hot path optimization, allocation reduction'],
      ['security', 'JavaScript/Node', 'typescript-security-review', 'typescript-code-review', 'XSS, injection, JWT/OAuth flaws, dependency CVEs'],
    ],
  },
  go: {
    stack: 'Go',
    skills: [
      ['go-systems-programmer', 'user-level', 'always-on', 'all', 'Explicit wiring, stdlib-first, consumer-side interfaces'],
      ['go-security-expert', 'user-level', 'always-on', 'task-implementation', 'alg enforcement, claim validation, constant-time, crypto/rand'],
      ['go-memory-oom-guard', 'user-level', 'always-on', 'task-implementation', 'Key material lifetime, memory leaks'],
      ['golang-testing', 'user-level', 'project-local', 'all', 'Any task in this Go project'],
      ['golang-security', 'user-level', 'user-local', 'crypto', 'When writing crypto/auth code'],
      ['golang-code-style', 'user-level', 'user-local', 'code-review', 'When writing or reviewing Go code for style'],
      ['golang-error-handling', 'user-level', 'user-local', 'error-boundaries', 'When designing error boundaries'],
      ['golang-concurrency', 'user-level', 'user-local', 'concurrency', 'When writing concurrent code'],
      ['golang-performance', 'user-level', 'user-local', 'performance', 'When profiling shows a bottleneck'],
      ['wycheproof', 'user-level', 'user-local', 'crypto-testing', 'When testing crypto — known attack vectors'],
      ['go-code-review', 'user-level', 'user-local', 'pr-review', 'Before any PR'],
      ['implementing-digital-signatures-with-ed25519', 'user-level', 'user-local', 'ed25519', 'When implementing Ed25519 — key generation, signing, verification'],
      ['ethereum', 'user-level', 'user-local', 'evm', 'When implementing Keccak-256, secp256k1, EIP-712 — EVM context, EIPs'],
    ],
    matrix: [
      ['crypto', 'Go', 'golang-security', 'wycheproof', 'Cryptographic primitive implementation'],
      ['concurrency', 'Go', 'golang-concurrency', 'golang-performance', 'Goroutines, channels, mutexes, worker pools'],
      ['error-boundaries', 'Go', 'golang-error-handling', 'golang-code-style', 'Error wrapping, sentinels, slog logging'],
      ['crypto-testing', 'Go', 'wycheproof', 'golang-testing', 'Known attack vectors, test vectors'],
      ['pr-review', 'Go', 'go-code-review', 'golang-code-style', 'gofmt, go vet, golangci-lint, review checklist'],
      ['performance', 'Go', 'golang-performance', 'golang-code-style', 'Allocation, pooling, hot-path optimization'],
      ['ed25519', 'Go', 'implementing-digital-signatures-with-ed25519', 'wycheproof', 'Ed25519 signing and verification'],
      ['evm', 'Go', 'ethereum', 'golang-security', 'Keccak-256, secp256k1, EIP-712, EVM chains'],
    ],
  },
  rust: {
    stack: 'Rust',
    skills: [
      ['rust-security', 'user-level', 'always-on', 'all', 'Supply chain safety, memory-safe FFI'],
      ['rust-testing', 'user-level', 'project-local', 'all', 'Any task in this Rust project'],
      ['rust-performance', 'user-level', 'user-local', 'performance', 'Performance optimization for Rust'],
    ],
    matrix: [
      ['testing', 'Rust', 'rust-testing', 'rust-performance', 'Unit, integration, async, property-based, coverage'],
      ['performance', 'Rust', 'rust-performance', 'rust-security', 'Latency, throughput, allocations, binary size'],
      ['security', 'Rust', 'rust-security', 'rust-testing', 'cargo-audit, cargo-deny, RUSTSEC, safe FFI, fuzzing'],
    ],
  },
  python: {
    stack: 'Python',
    skills: [
      ['python-code-style', 'user-level', 'always-on', 'all', 'Linting, formatting, naming, docstrings'],
      ['python-testing-patterns', 'user-level', 'project-local', 'all', 'Any task in this Python project'],
      ['python-performance-optimization', 'user-level', 'user-local', 'performance', 'Performance optimization for Python'],
      ['python-cybersecurity-tool-development', 'user-level', 'user-local', 'security', 'Python cybersecurity tool development'],
    ],
    matrix: [
      ['testing', 'Python', 'python-testing-patterns', 'python-code-style', 'pytest, fixtures, mocking, TDD'],
      ['performance', 'Python', 'python-performance-optimization', 'python-code-style', 'cProfile, memory profilers, bottlenecks'],
      ['security', 'Python', 'python-cybersecurity-tool-development', 'python-code-style', 'Secure coding, async scanning, structured testing'],
    ],
  },
  unknown: {
    stack: 'Unknown',
    skills: [],
    matrix: [['example-trigger', 'any', 'primary-skill', 'secondary-skill', 'Replace with your own triggers and skills']],
  },
};

function detectLanguage(targetDir) {
  if (fs.existsSync(path.join(targetDir, 'package.json'))) return 'node';
  if (fs.existsSync(path.join(targetDir, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(targetDir, 'pyproject.toml')) || fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'setup.py'))) return 'python';
  try {
    for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (fs.existsSync(path.join(targetDir, entry.name, 'go.mod'))) return 'go';
      if (fs.existsSync(path.join(targetDir, entry.name, 'package.json'))) return 'node';
      if (fs.existsSync(path.join(targetDir, entry.name, 'Cargo.toml'))) return 'rust';
      if (fs.existsSync(path.join(targetDir, entry.name, 'pyproject.toml')) || fs.existsSync(path.join(targetDir, entry.name, 'requirements.txt'))) return 'python';
    }
  } catch (e) {}
  return 'unknown';
}

function copyWithHeader(src, dst) {
  let content = '';
  if (fs.statSync(src).isDirectory()) {
    return;
  }
  try {
    content = fs.readFileSync(src, 'utf-8');
  } catch (e) {
    return;
  }
  content = content.replace(/^<!-- GENERATED BY project-context init — DO NOT EDIT\. -->\n?/m, '');
  const header = `<!-- GENERATED BY project-context init — DO NOT EDIT. -->\n`;
  fs.writeFileSync(dst, header + content);
}

// createWorkbook builds a fresh overview.xlsx with the canonical sheets.
async function createWorkbook(xlsxPath, language, projectName, repoName) {
  const preset = LANGUAGE_PRESETS[language] || LANGUAGE_PRESETS.unknown;
  const wb = new ExcelJS.Workbook();

  for (const def of SHEET_DEFS) {
    const ws = wb.addWorksheet(def.name);
    ws.addRow(def.headers);
  }

  const identity = wb.getWorksheet('Identity');
  const identityRows = [
    ['Name', projectName],
    ['Description', 'Project initialized with project-context'],
    ['Stack', preset.stack],
    ['Repository', `git@github.com:bperin/${repoName}.git`],
    ['Manifests', ''],
    ['Primary Language', language],
    ['Discovered At', new Date().toISOString()],
  ];
  for (const row of identityRows) identity.addRow(row);

  const skills = wb.getWorksheet('Skills');
  for (const row of preset.skills) skills.addRow(row);

  const matrix = wb.getWorksheet('Skill Matrix');
  for (const row of preset.matrix) matrix.addRow(row);

  const workflows = wb.getWorksheet('Workflows');
  const workflowRows = [
    ['spec-creation.md', 'Spec creation', 'After a spec is written or revised, before commit', ''],
    ['plan-creation.md', 'Plan creation', 'After a plan is written, before implementation starts', ''],
    ['task-creation.md', 'Task creation', 'After a task file is written, before implementation starts', ''],
    ['task-implementation.md', 'Task implementation', 'When a task moves from todo to in_progress', ''],
    ['code-review.md', 'Code review', 'Before any PR', ''],
    ['test-failure.md', 'Test failure', 'When tests fail and need triage', ''],
    ['skills-io-discovery.md', 'Skills IO discovery', 'When mapping agent skills to project triggers', ''],
    ['overview.md', 'Overview', 'When refreshing project state', ''],
  ];
  for (const row of workflowRows) workflows.addRow(row);

  await wb.xlsx.writeFile(xlsxPath);
}

// upgradeWorkbook reads an existing xlsx and adds any missing canonical
// sheets/headers while preserving existing data. It also seeds language
// presets into Skills and Skill Matrix if those sheets are empty.
async function upgradeWorkbook(xlsxPath, language) {
  const preset = LANGUAGE_PRESETS[language] || LANGUAGE_PRESETS.unknown;

  let wb;
  if (fs.existsSync(xlsxPath)) {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
  } else {
    wb = new ExcelJS.Workbook();
  }

  for (const def of SHEET_DEFS) {
    let ws = wb.getWorksheet(def.name);
    if (!ws) {
      ws = wb.addWorksheet(def.name);
      ws.addRow(def.headers);
    } else if (ws.rowCount === 0) {
      ws.addRow(def.headers);
    }
  }

  // Seed Skills and Skill Matrix if they only have the header row
  const skills = wb.getWorksheet('Skills');
  if (skills.rowCount <= 1) {
    for (const row of preset.skills) skills.addRow(row);
  }

  const matrix = wb.getWorksheet('Skill Matrix');
  if (matrix.rowCount <= 1) {
    for (const row of preset.matrix) matrix.addRow(row);
  }

  // Seed Workflows if empty
  const workflows = wb.getWorksheet('Workflows');
  if (workflows.rowCount <= 1) {
    const workflowRows = [
      ['spec-creation.md', 'Spec creation', 'After a spec is written or revised, before commit', ''],
      ['plan-creation.md', 'Plan creation', 'After a plan is written, before implementation starts', ''],
      ['task-creation.md', 'Task creation', 'After a task file is written, before implementation starts', ''],
      ['task-implementation.md', 'Task implementation', 'When a task moves from todo to in_progress', ''],
      ['code-review.md', 'Code review', 'Before any PR', ''],
      ['test-failure.md', 'Test failure', 'When tests fail and need triage', ''],
      ['skills-io-discovery.md', 'Skills IO discovery', 'When mapping agent skills to project triggers', ''],
      ['overview.md', 'Overview', 'When refreshing project state', ''],
    ];
    for (const row of workflowRows) workflows.addRow(row);
  }

  await wb.xlsx.writeFile(xlsxPath);
}

module.exports = {
  SHEET_DEFS,
  LANGUAGE_PRESETS,
  detectLanguage,
  copyWithHeader,
  createWorkbook,
  upgradeWorkbook,
};
