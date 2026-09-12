const fs = require('fs');
const path = require('path');

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
    if (ev.event === 'created') {
      existing.title = ev.title || existing.title;
      existing.plan = ev.plan || existing.plan;
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
    discoveredAt: new Date().toISOString(),
  });

  // skills.json
  writeJSON(path.join(dataDir, 'skills.json'), {
    skills: preset.skills.map(row => ({
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

module.exports = {
  LANGUAGE_PRESETS,
  detectLanguage,
  copyWithHeader,
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
  readPlans,
  readTaskFiles,
  // Identity and skills
  readIdentity,
  readSkills,
  // Init
  createDataFiles,
};
