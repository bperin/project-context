// init command — scaffolds the .ai/ directory
// See MASTER_PROMPT.md for the full spec.

const fs = require("fs");
const path = require("path");

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const WORKFLOWS_DIR = path.join(__dirname, "..", "workflows");

const DIRECTORY_STRUCTURE = [
  "context/architecture",
  "context/decisions",
  "context/identity",
  "context/plans",
  "context/skills",
  "context/specs",
  "context/state",
  "context/tasks",
  "context/workflows",
  "graph/edges",
  "graph/nodes",
  "templates",
];

function init(options) {
  const target = path.resolve(options.target);
  const workspace = path.join(target, options.workspace);

  console.log(`Scaffolding ${workspace}...`);

  // Create directory structure
  for (const dir of DIRECTORY_STRUCTURE) {
    fs.mkdirSync(path.join(workspace, dir), { recursive: true });
  }

  // Copy templates into .ai/templates/ and .ai/context/<subdir>/
  copyTemplates(workspace);

  // Copy workflows into .ai/context/workflows/
  copyWorkflows(workspace);

  // Write AGENTS.md (the protocol)
  writeAgentsMd(workspace);

  // Write STATE.md (stub)
  writeStateMd(workspace);

  // Write DECISIONS.md (stub)
  writeDecisionsMd(workspace);

  // Write context/state/current.md (stub)
  writeCurrentMd(workspace);

  console.log(`Done. ${workspace} scaffolded.`);
}

function copyTemplates(workspace) {
  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const src = path.join(TEMPLATES_DIR, file);
    const content = fs.readFileSync(src, "utf-8");

    // Copy to .ai/templates/
    fs.writeFileSync(path.join(workspace, "templates", file), content);

    // Copy to .ai/context/<subdir>/ based on filename prefix
    const subdir = getSubdirForTemplate(file);
    if (subdir) {
      fs.writeFileSync(path.join(workspace, "context", subdir, file), content);
    }
  }
}

function getSubdirForTemplate(filename) {
  if (filename.startsWith("SPEC-")) return "specs";
  if (filename.startsWith("PLAN-")) return "plans";
  if (filename.startsWith("TASK-")) return "tasks";
  if (filename.startsWith("ADR-")) return "decisions";
  if (filename.startsWith("architecture.")) return "architecture";
  if (filename.startsWith("identity.")) return "identity";
  if (filename.startsWith("skill")) return "skills";
  if (filename.startsWith("state.")) return "state";
  if (filename.startsWith("workflow.")) return "workflows";
  return null;
}

function copyWorkflows(workspace) {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const src = path.join(WORKFLOWS_DIR, file);
    const content = fs.readFileSync(src, "utf-8");
    fs.writeFileSync(path.join(workspace, "context", "workflows", file), content);
  }
}

function writeAgentsMd(workspace) {
  // Read the canonical AGENTS.md from the trust reference
  // The agent implementing this should copy the full content from
  // /Users/brian/code/trust/.ai-trust/AGENTS.md
  const content = `# Agent Protocol

<!-- TODO: Copy the full AGENTS.md protocol from the trust reference. -->
<!-- See MASTER_PROMPT.md section "AGENTS.md — the protocol file" -->
`;
  fs.writeFileSync(path.join(workspace, "AGENTS.md"), content);
}

function writeStateMd(workspace) {
  const content = `# State

- **Status**: active
- **Active Plan**: none
- **Completed Tasks**: none
- **Next**: none
`;
  fs.writeFileSync(path.join(workspace, "STATE.md"), content);
}

function writeDecisionsMd(workspace) {
  const content = `# Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|

No decisions yet.
`;
  fs.writeFileSync(path.join(workspace, "DECISIONS.md"), content);
}

function writeCurrentMd(workspace) {
  const content = `# Current State

- **Status**: initialized
- **Active Plan**: none
- **Next**: write first spec
`;
  fs.writeFileSync(path.join(workspace, "context", "state", "current.md"), content);
}

module.exports = { init };
