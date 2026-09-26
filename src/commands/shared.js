const fs = require('fs');
const path = require('path');

// Language skill presets. Each language maps to triggers, always-on,
// project-local, user-level, and skill matrix rows.
const LANGUAGE_PRESETS = {
  node: {
    stack: 'JavaScript/Node',
    skills: [],
    matrix: [],
  },
  nextjs: {
    stack: 'Next.js',
    skills: [
      ['vercel-react-best-practices', 'user-level', 'always-on', 'all', 'Vercel React and Next.js performance and data-fetching baseline'],
      ['typescript-magician', 'user-level', 'user-local', 'type-system', 'Explicit type-system design and complex TypeScript work'],
      ['code-review-excellence', 'user-level', 'user-local', 'pr-review', 'Explicit pull-request review guidance'],
    ],
    matrix: [
      ['type-system', 'Next.js', 'typescript-magician', '', 'Complex TypeScript types, guards, and utilities'],
      ['pr-review', 'Next.js', 'code-review-excellence', '', 'Explicit pull-request review'],
    ],
  },
  go: {
    stack: 'Go',
    skills: [
      ['go-systems-programmer', 'user-level', 'always-on', 'all', 'Explicit wiring, stdlib-first, consumer-side interfaces'],
      ['go-security-expert', 'user-level', 'always-on', 'pc-implement', 'alg enforcement, claim validation, constant-time, crypto/rand'],
      ['go-memory-oom-guard', 'user-level', 'always-on', 'pc-implement', 'Key material lifetime, memory leaks'],
      ['golang-testing', 'user-level', 'project-local', 'all', 'Any task in this Go project'],
      ['golang-security', 'user-level', 'user-local', 'crypto', 'When writing crypto/auth code'],
      ['golang-code-style', 'user-level', 'user-local', 'pc-review', 'When writing or reviewing Go code for style'],
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
    skills: [],
    matrix: [],
  },
  python: {
    stack: 'Python',
    skills: [],
    matrix: [],
  },
  unknown: {
    stack: 'Unknown',
    skills: [],
    matrix: [['example-trigger', 'any', 'primary-skill', 'secondary-skill', 'Replace with your own triggers and skills']],
  },
};

// Planning methods are shared user-level skills. They are registered in every
// generated manager so IDEs can discover the names and the workflow that may
// load them, but they are deliberately excluded from implementation packets.
const PLANNING_SKILLS = [
  ['grilling', 'user-level', 'user-local', 'planning', 'Executable planning interrogation; the grill-me package is only a wrapper'],
  ['adhd', 'user-level', 'user-local', 'planning', 'Open-ended divergent exploration for planning only'],
];

function packageLanguage(packagePath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    return Object.hasOwn(dependencies, 'next') ? 'nextjs' : 'node';
  } catch (e) {
    return 'node';
  }
}

function detectLanguage(targetDir) {
  const packagePath = path.join(targetDir, 'package.json');
  if (fs.existsSync(packagePath)) return packageLanguage(packagePath);
  if (fs.existsSync(path.join(targetDir, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(targetDir, 'Cargo.toml'))) return 'rust';
  if (fs.existsSync(path.join(targetDir, 'pyproject.toml')) || fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'setup.py'))) return 'python';
  try {
    for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (fs.existsSync(path.join(targetDir, entry.name, 'go.mod'))) return 'go';
      const nestedPackage = path.join(targetDir, entry.name, 'package.json');
      if (fs.existsSync(nestedPackage)) return packageLanguage(nestedPackage);
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

function ensureContextPacketsIgnored(dir) {
  const gitignorePath = path.join(dir, '.gitignore');
  const rule = '/.context-*.json';
  let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(rule)) return;

  if (content && !content.endsWith('\n')) content += '\n';
  if (content && !content.endsWith('\n\n')) content += '\n';
  content += `# project-context transient context packets\n${rule}\n`;
  fs.writeFileSync(gitignorePath, content);
}

const MEMORY_LAKE_MCP_URL = 'https://app.memorylake.ai/memorylake/mcp/v2';

// ensureProjectMcpServer adds or updates one project-local MCP server without
// replacing unrelated Codex settings. Project config is loaded only when the
// repository is trusted by Codex.
function ensureProjectMcpServer(targetDir, name, url) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`Invalid MCP server name: ${name}`);
  const codexDir = path.join(targetDir, '.codex');
  const configPath = path.join(codexDir, 'config.toml');
  fs.mkdirSync(codexDir, { recursive: true });

  let content = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const sectionHeader = `[mcp_servers.${name}]`;
  const headerPattern = new RegExp(`^\\[mcp_servers\\.${name}\\]\\s*$`, 'm');
  const header = headerPattern.exec(content);
  const urlLine = `url = ${JSON.stringify(url)}`;

  if (header) {
    const sectionStart = header.index + header[0].length;
    const nextHeader = /^\s*\[[^\]]+\]\s*$/gm;
    nextHeader.lastIndex = sectionStart;
    const next = nextHeader.exec(content);
    const sectionEnd = next ? next.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);
    const updatedSection = /^\s*url\s*=.*$/m.test(section)
      ? section.replace(/^\s*url\s*=.*$/m, (line) => {
        const leadingNewline = line.startsWith('\n') ? '\n' : '';
        return `${leadingNewline}${urlLine}`;
      })
      : `${section.replace(/\s*$/, '')}\n${urlLine}\n`;
    content = content.slice(0, sectionStart) + updatedSection + content.slice(sectionEnd);
  } else {
    if (content && !content.endsWith('\n')) content += '\n';
    if (content && !content.endsWith('\n\n')) content += '\n';
    content += `${sectionHeader}\n${urlLine}\n`;
  }

  const previous = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  if (previous !== content) fs.writeFileSync(configPath, content);
  return { path: configPath, changed: previous !== content };
}

function ensureMemoryLakeMcp(targetDir) {
  return ensureProjectMcpServer(targetDir, 'memorylake', MEMORY_LAKE_MCP_URL);
}

function ensureMemoryLakeIdentity(aiDir, projectName, values = {}) {
  const identityPath = path.join(aiDir, 'data', 'identity.json');
  const identity = readJSON(identityPath) || {};
  const current = identity.memoryLake && typeof identity.memoryLake === 'object'
    ? identity.memoryLake
    : {};
  identity.memoryLake = {
    workspace: values.workspace || current.workspace || 'default',
    project: values.project || current.project || projectName,
  };
  const workspaceId = values.workspaceId || current.workspaceId;
  const projectId = values.projectId || current.projectId;
  if (workspaceId) identity.memoryLake.workspaceId = workspaceId;
  if (projectId) identity.memoryLake.projectId = projectId;
  writeJSON(identityPath, identity);
  return identity.memoryLake;
}

// ---------------------------------------------------------------------------
// JSONL utilities
// ---------------------------------------------------------------------------

// readJSONL reads a .jsonl file and returns an array of parsed objects.
// Returns [] if the file does not exist.
function readJSONL(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const results = [];
  for (const line of lines) {
    try {
      results.push(JSON.parse(line));
    } catch (e) {
      // skip malformed lines
    }
  }
  return results;
}

// appendJSONL appends a JSON object as a single line to a .jsonl file.
// Creates the file (and parent dirs) if it does not exist.
function appendJSONL(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(obj) + '\n';
  fs.appendFileSync(filePath, line);
}

// readJSON reads a .json file and returns the parsed object.
// Returns null if the file does not exist or is invalid.
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// writeJSON writes an object as pretty-printed JSON to a file.
// Creates parent dirs if needed.
function writeJSON(filePath, obj) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Task state (from tasks.jsonl)
// ---------------------------------------------------------------------------

// readTasks reads data/tasks.jsonl and returns the raw event array.
function readTasks(aiDir) {
  return readJSONL(path.join(aiDir, 'data', 'tasks.jsonl'));
}

// getTaskStates reduces the event log to the current state of each task.
// Returns a Map of id -> { id, title, plan, status, ts }.
function getTaskStates(aiDir) {
  const events = readTasks(aiDir);
  const states = new Map();
  for (const ev of events) {
    if (!ev.id) continue;
    const existing = states.get(ev.id) || { id: ev.id, title: '', plan: '', status: 'draft' };
    if (ev.event === 'created' || ev.event === 'updated') {
      if (Object.hasOwn(ev, 'title')) existing.title = ev.title;
      if (Object.hasOwn(ev, 'plan')) existing.plan = ev.plan;
      if (Object.hasOwn(ev, 'skills')) existing.skills = ev.skills;
      if (Object.hasOwn(ev, 'triggers')) existing.triggers = ev.triggers;
      if (Object.hasOwn(ev, 'dependencies')) existing.dependencies = ev.dependencies;
      if (Object.hasOwn(ev, 'commit')) existing.commit = ev.commit;
    }
    if (ev.event === 'created') existing.status = 'draft';
    else if (ev.event === 'started') existing.status = 'in_progress';
    else if (ev.event === 'done') existing.status = 'done';
    else if (ev.event === 'archived') existing.status = 'archived';
    else if (ev.status) existing.status = ev.status;
    existing.ts = ev.ts || existing.ts;
    states.set(ev.id, existing);
  }
  return states;
}

// getTaskState returns the current state of a single task, or null.
function getTaskState(aiDir, taskId) {
  const states = getTaskStates(aiDir);
  return states.get(taskId) || null;
}

// appendTaskEvent appends an event to data/tasks.jsonl.
function appendTaskEvent(aiDir, event) {
  if (!event.ts) event.ts = new Date().toISOString();
  appendJSONL(path.join(aiDir, 'data', 'tasks.jsonl'), event);
}

// appendTimelineEvent appends an event to a plan's timeline JSONL.
function appendTimelineEvent(aiDir, planId, event) {
  if (!event.ts) event.ts = new Date().toISOString();
  event.plan = planId;
  appendJSONL(path.join(aiDir, 'plans', `${planId}.timeline.jsonl`), event);
}

// readTimeline reads a plan's timeline JSONL.
// Falls back to archive/timelines/ if the plan has been archived.
function readTimeline(aiDir, planId) {
  const active = path.join(aiDir, 'plans', `${planId}.timeline.jsonl`);
  if (fs.existsSync(active)) return readJSONL(active);
  const archived = path.join(aiDir, 'archive', 'timelines', `${planId}.timeline.jsonl`);
  return readJSONL(archived);
}

// ---------------------------------------------------------------------------
// Spec/Plan state (from MD files)
// ---------------------------------------------------------------------------

// parseMarkdownStatus extracts the status from a spec/plan/task MD file.
function parseMarkdownStatus(filePath) {
  if (!fs.existsSync(filePath)) return 'draft';
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/\*\*Status\*\*:[ \t]*`?([a-z_]+)`?/i);
  return m ? m[1] : 'draft';
}

// updateMarkdownStatus updates the **Status** line in a spec/plan/task MD file.
function updateMarkdownStatus(filePath, newStatus) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /(\*\*Status\*\*:[ \t]*`?)([a-z_]+)(`?)/i,
    `$1${newStatus}$3`
  );
  if (updated === content) return false;
  fs.writeFileSync(filePath, updated);
  return true;
}

// parseMarkdownField extracts a **Field**: value line from a MD file.
function parseMarkdownField(filePath, field) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`\\*\\*${field}\\*\\*:[ \\t]*(.*)`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

// readSpecs reads all spec MD files and returns an array of metadata.
function readSpecs(aiDir) {
  const specsDir = path.join(aiDir, 'specs');
  if (!fs.existsSync(specsDir)) return [];
  return fs.readdirSync(specsDir)
    .filter(f => f.endsWith('.md') && f.startsWith('SPEC-'))
    .sort()
    .map(f => {
      const fp = path.join(specsDir, f);
      const id = f.replace('.md', '');
      const titleMatch = fs.readFileSync(fp, 'utf8').match(/^#\s+(.*)/m);
      return {
        id,
        title: titleMatch ? titleMatch[1] : id,
        status: parseMarkdownStatus(fp),
        uuid: parseMarkdownField(fp, 'UUID'),
        dependencies: parseMarkdownField(fp, 'Dependencies'),
        skills: parseMarkdownField(fp, 'Skills'),
        triggers: parseMarkdownField(fp, 'Triggers'),
        commit: parseMarkdownField(fp, 'Commit'),
        filePath: fp,
      };
    });
}

// readEpics reads all epic MD files and returns an array of metadata.
function readEpics(aiDir) {
  const epicsDir = path.join(aiDir, 'epics');
  if (!fs.existsSync(epicsDir)) return [];
  return fs.readdirSync(epicsDir)
    .filter(f => f.endsWith('.md') && f.startsWith('EPIC-'))
    .sort()
    .map(f => {
      const fp = path.join(epicsDir, f);
      const id = f.replace('.md', '');
      const titleMatch = fs.readFileSync(fp, 'utf8').match(/^#\s+(.*)/m);
      return {
        id,
        title: titleMatch ? titleMatch[1] : id,
        status: parseMarkdownStatus(fp),
        uuid: parseMarkdownField(fp, 'UUID'),
        dependencies: parseMarkdownField(fp, 'Dependencies'),
        skills: parseMarkdownField(fp, 'Skills'),
        triggers: parseMarkdownField(fp, 'Triggers'),
        commit: parseMarkdownField(fp, 'Commit'),
        filePath: fp,
      };
    });
}

// readPlans reads all plan MD files and returns an array of metadata.
function readPlans(aiDir) {
  const plansDir = path.join(aiDir, 'plans');
  if (!fs.existsSync(plansDir)) return [];
  return fs.readdirSync(plansDir)
    .filter(f => f.endsWith('.md') && f.startsWith('PLAN-') && !f.includes('.timeline.'))
    .sort()
    .map(f => {
      const fp = path.join(plansDir, f);
      const id = f.replace('.md', '');
      const titleMatch = fs.readFileSync(fp, 'utf8').match(/^#\s+(.*)/m);
      return {
        id,
        title: titleMatch ? titleMatch[1] : id,
        status: parseMarkdownStatus(fp),
        uuid: parseMarkdownField(fp, 'UUID'),
        parent: parseMarkdownField(fp, 'Parent'),
        source: parseMarkdownField(fp, 'Source'),
        dependencies: parseMarkdownField(fp, 'Dependencies'),
        skills: parseMarkdownField(fp, 'Skills'),
        triggers: parseMarkdownField(fp, 'Triggers'),
        commit: parseMarkdownField(fp, 'Commit'),
        filePath: fp,
      };
    });
}

// readTaskFiles reads all task MD files and returns an array of metadata.
function readTaskFiles(aiDir) {
  const tasksDir = path.join(aiDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  return fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('.md') && f.startsWith('TASK-'))
    .sort()
    .map(f => {
      const fp = path.join(tasksDir, f);
      const id = f.replace('.md', '');
      const titleMatch = fs.readFileSync(fp, 'utf8').match(/^#\s+(.*)/m);
      return {
        id,
        title: titleMatch ? titleMatch[1] : id,
        status: parseMarkdownStatus(fp),
        parent: parseMarkdownField(fp, 'Parent'),
        dependencies: parseMarkdownField(fp, 'Dependencies'),
        skills: parseMarkdownField(fp, 'Skills'),
        triggers: parseMarkdownField(fp, 'Triggers'),
        commit: parseMarkdownField(fp, 'Commit'),
        filePath: fp,
      };
    });
}

// ---------------------------------------------------------------------------
// Identity and skills (from JSON files)
// ---------------------------------------------------------------------------

// readIdentity reads data/identity.json.
function readIdentity(aiDir) {
  return readJSON(path.join(aiDir, 'data', 'identity.json')) || {};
}

// readSkills reads data/skills.json (skill registry + matrix).
function readSkills(aiDir) {
  return readJSON(path.join(aiDir, 'data', 'skills.json')) || { skills: [], matrix: [] };
}

// ---------------------------------------------------------------------------
// Init helpers (create JSONL/JSON files)
// ---------------------------------------------------------------------------

// createDataFiles creates the initial JSONL and JSON data files.
function createDataFiles(aiDir, language, projectName, repoName) {
  const preset = LANGUAGE_PRESETS[language] || LANGUAGE_PRESETS.unknown;
  const dataDir = path.join(aiDir, 'data');

  // identity.json
  writeJSON(path.join(dataDir, 'identity.json'), {
    name: projectName,
    description: 'Project initialized with project-context',
    stack: preset.stack,
    repository: `git@github.com:bperin/${repoName}.git`,
    manifests: '',
    primaryLanguage: language,
    memoryLake: {
      workspace: 'default',
      project: repoName,
    },
    discoveredAt: new Date().toISOString(),
  });

  // skills.json
  writeJSON(path.join(dataDir, 'skills.json'), {
    sharedSkillsRoot: '/Users/brian/.agents/skills',
    skills: [...PLANNING_SKILLS, ...preset.skills].map(row => ({
      skill: row[0],
      path: row[1],
      layer: row[2],
      workflowTrigger: row[3],
      purpose: row[4],
    })),
    matrix: preset.matrix.map(row => ({
      trigger: row[0],
      language: row[1],
      primarySkills: row[2],
      secondarySkills: row[3],
      notes: row[4],
    })),
  });

  // decisions.json
  writeJSON(path.join(dataDir, 'decisions.json'), { decisions: [] });

  // tasks.jsonl — start empty
  appendJSONL(path.join(dataDir, 'tasks.jsonl'), { _init: true, ts: new Date().toISOString() });
}

// Ensure existing managers learn about the shared planning methods during
// upgrade without replacing project-specific skill registrations.
function ensurePlanningSkills(aiDir) {
  const skillsPath = path.join(aiDir, 'data', 'skills.json');
  const data = readJSON(skillsPath) || { skills: [], matrix: [] };
  if (!Array.isArray(data.skills)) data.skills = [];
  const existing = new Set(data.skills.map(entry => entry && entry.skill));
  let changed = false;
  for (const row of PLANNING_SKILLS) {
    if (existing.has(row[0])) continue;
    data.skills.unshift({
      skill: row[0],
      path: row[1],
      layer: row[2],
      workflowTrigger: row[3],
      purpose: row[4],
    });
    existing.add(row[0]);
    changed = true;
  }
  if (!data.sharedSkillsRoot) {
    data.sharedSkillsRoot = '/Users/brian/.agents/skills';
    changed = true;
  }
  if (changed || !fs.existsSync(skillsPath)) writeJSON(skillsPath, data);
  return data;
}

const LEGACY_NODE_DEFAULTS = [
  ['typescript-code-review', 'user-level', 'always-on', 'all', 'Code quality checks at session start'],
  ['typescript-unit-testing', 'user-level', 'project-local', 'all', 'Any task in this JS/TS project'],
  ['typescript-security-review', 'user-level', 'user-local', 'security', 'Security review for JS/TS code'],
  ['accelint-ts-performance', 'user-level', 'user-local', 'performance', 'JS/TS performance audit and optimization'],
  ['js-ts-performance-readability', 'user-level', 'user-local', 'api-routing', 'Readable, performant JS/TS'],
];

const LEGACY_NODE_MATRIX = [
  ['api-validation', 'JavaScript/Node', 'typescript-unit-testing', 'typescript-code-review', 'REST API input validation, error handling'],
  ['api-routing', 'JavaScript/Node', 'typescript-code-review', 'js-ts-performance-readability', 'Express route wiring, controller patterns'],
  ['testing', 'JavaScript/Node', 'typescript-unit-testing', 'accelint-ts-performance', 'Test suite design, mocking, coverage'],
  ['performance', 'JavaScript/Node', 'accelint-ts-performance', 'js-ts-performance-readability', 'Hot path optimization, allocation reduction'],
  ['security', 'JavaScript/Node', 'typescript-security-review', 'typescript-code-review', 'XSS, injection, JWT/OAuth flaws, dependency CVEs'],
];

function isLegacyNodeDefault(entry) {
  return LEGACY_NODE_DEFAULTS.some(([skill, pathName, layer, workflowTrigger, purpose]) => (
    entry && entry.skill === skill && entry.path === pathName && entry.layer === layer
      && entry.workflowTrigger === workflowTrigger && entry.purpose === purpose
  ));
}

function isLegacyNodeMatrix(entry) {
  return LEGACY_NODE_MATRIX.some(([trigger, language, primarySkills, secondarySkills, notes]) => (
    entry && entry.trigger === trigger && entry.language === language
      && entry.primarySkills === primarySkills && entry.secondarySkills === secondarySkills
      && entry.notes === notes
  ));
}

// Migrate only known generated defaults; similarly named project additions are
// preserved because their registration metadata differs from the old preset.
function ensureLanguageSkills(aiDir, language) {
  const skillsPath = path.join(aiDir, 'data', 'skills.json');
  const data = ensurePlanningSkills(aiDir);
  const preset = LANGUAGE_PRESETS[language] || LANGUAGE_PRESETS.unknown;
  const retained = (data.skills || []).filter((entry) => !isLegacyNodeDefault(entry));
  data.matrix = (Array.isArray(data.matrix) ? data.matrix : []).filter((entry) => !isLegacyNodeMatrix(entry));
  const existing = new Set(retained.map((entry) => entry && entry.skill));

  if (language === 'nextjs') {
    for (const row of preset.skills) {
      if (existing.has(row[0])) continue;
      retained.push({
        skill: row[0], path: row[1], layer: row[2], workflowTrigger: row[3], purpose: row[4],
      });
      existing.add(row[0]);
    }
    const matrixTriggers = new Set(data.matrix.map((row) => row && row.trigger));
    for (const row of preset.matrix) {
      if (matrixTriggers.has(row[0])) continue;
      data.matrix.push({
        trigger: row[0], language: row[1], primarySkills: row[2], secondarySkills: row[3], notes: row[4],
      });
    }
  }

  data.skills = retained;
  data.sharedSkillsRoot = data.sharedSkillsRoot || '/Users/brian/.agents/skills';
  writeJSON(skillsPath, data);
  return data;
}

module.exports = {
  LANGUAGE_PRESETS,
  detectLanguage,
  copyWithHeader,
  ensureContextPacketsIgnored,
  MEMORY_LAKE_MCP_URL,
  ensureProjectMcpServer,
  ensureMemoryLakeMcp,
  ensureMemoryLakeIdentity,
  // JSONL utilities
  readJSONL,
  appendJSONL,
  readJSON,
  writeJSON,
  // Task state
  readTasks,
  getTaskStates,
  getTaskState,
  appendTaskEvent,
  appendTimelineEvent,
  readTimeline,
  // Spec/Plan state
  parseMarkdownStatus,
  updateMarkdownStatus,
  parseMarkdownField,
  readSpecs,
  readEpics,
  readPlans,
  readTaskFiles,
  // Identity and skills
  readIdentity,
  readSkills,
  PLANNING_SKILLS,
  // Init
  createDataFiles,
  ensurePlanningSkills,
  ensureLanguageSkills,
};
