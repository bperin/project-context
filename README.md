# Project Context

[![npm version](https://img.shields.io/npm/v/@bperin/project-context-protocol.svg)](https://www.npmjs.com/package/@bperin/project-context-protocol)
[![GitHub Package](https://img.shields.io/badge/GitHub%20Packages-%40bperin-blue)](https://github.com/bperin/project-context/pkgs/npm/project-context-protocol)
[![CI](https://github.com/bperin/project-context/actions/workflows/release.yml/badge.svg)](https://github.com/bperin/project-context/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Git-backed project management and context protocol for AI coding
agents. Project Context gives an existing codebase a durable,
structured source of truth for specs, plans, tasks, architecture,
decisions, and workflows — with review pipelines that pressure-test
every document before it ships.

## Install

```bash
# From npm
npm install -g @bperin/project-context-protocol

# From GitHub Packages
npm install -g @bperin/project-context-protocol --registry=https://npm.pkg.github.com

# Run without installing
npx @bperin/project-context-protocol --help

# Or download the self-contained bundle from the latest release
# https://github.com/bperin/project-context/releases/latest
```

The bundled CLI (no `node_modules` needed) is also available as a
build artifact from every CI run and as a release asset on every
semantic-release tag.

## Nightly builds

A nightly CI run checks for new commits since the last release. If
there are changes, it bundles the CLI and uploads it as a
`project-context-nightly` artifact (7-day retention). Download from
the [Actions tab](https://github.com/bperin/project-context/actions)
— filter by the "Nightly Build" workflow.

## How it works

```mermaid
graph TD
    subgraph "Source repository"
        SRC[src/ — workflows, templates, agents, skills]
    end

    subgraph "Target repository"
        DATA[data/tasks.jsonl — task state log]
        DOCS[specs/, plans/, tasks/ — Markdown documents]
        AGENTS[.agents/ — skills + agent profiles]
        WF[workflows/ — workflow definitions]
        TEMPLATES[templates/ — document templates]
        BIN[tools/project-context — bundled CLI]
    end

    SRC -->|"upgrade --source ... --no-symlink --no-hooks --no-bundled-skills"| AGENTS
    SRC -->|upgrade| WF
    SRC -->|upgrade| TEMPLATES
    SRC -->|"esbuild bundle"| BIN

    DATA -->|context packet| BIN
    DOCS -->|document bodies| BIN
    BIN -->|inspect / status / add / sync / graph| DATA
```

JSONL files (`data/tasks.jsonl`) hold task state as an append-only event
log. Markdown documents hold prose, requirements, acceptance criteria,
and implementation detail. Specs and plans carry status in their Markdown
front-matter; tasks carry status in the JSONL event log.

## Workflow lifecycle

The orchestrator runs the planning workflow in one continuous context:
divergent ideation (`adhd`) once on the original input, then write spec,
review, write plan, review. A separate task-writer then converts the
approved plan into task Markdown files and JSONL records.

```mermaid
graph LR
    SPEC["**SPEC**<br/>adhd once → write<br/>→ review"]
    PLAN["**PLAN**<br/>write → review<br/>(same context as SPEC)"]
    TASK["**TASKS**<br/>task-writer reads spec+plan<br/>→ writes task MDs + JSONL → review"]
    IMPL["**IMPLEMENT**<br/>implementer → code-optimizer<br/>→ reviewer → test-agent"]
    REVIEW["**REVIEW**<br/>mechanical<br/>→ review diff → PR"]

    SPEC -->|approve| PLAN
    PLAN -->|approve| TASK
    TASK -->|implement one at a time| IMPL
    IMPL -->|all tasks done| REVIEW
    REVIEW -->|squash merge| DONE["**DONE**<br/>tag + record in JSONL"]
```

Everything is linear. One task at a time. Subagents run sequentially —
each one finishes before the next starts.

## Planning workflow

The orchestrator uses one continuous high-context process for spec and
plan creation. `adhd` runs once, on the original user input, to frame the
problem. The same context then writes the spec, dispatches the reviewer,
writes the plan, and dispatches the reviewer. No optimizer or research
subagents run during planning.

```mermaid
graph TD
    ADHD["**adhd** (once, on original input)<br/>divergent problem framing"]
    WRITESPEC["**Write spec**<br/>same orchestrator context"]
    REVIEWSPEC["**Review spec**<br/>reviewer subagent, with context"]
    GATE1["**User approves spec**<br/>hard gate — no auto-progression"]
    WRITEPLAN["**Write plan**<br/>same orchestrator context"]
    REVIEWPLAN["**Review plan**<br/>reviewer subagent, with context"]
    GATE2["**User approves plan**<br/>hard gate — no auto-progression"]
    COMMIT["**Commit**"]

    ADHD --> WRITESPEC
    WRITESPEC --> REVIEWSPEC
    REVIEWSPEC -->|"MUST-FIX? revise"| WRITESPEC
    REVIEWSPEC -->|"pass"| GATE1
    GATE1 -->|"approved"| WRITEPLAN
    GATE1 -->|"changes"| WRITESPEC
    WRITEPLAN --> REVIEWPLAN
    REVIEWPLAN -->|"MUST-FIX? revise"| WRITEPLAN
    REVIEWPLAN -->|"pass"| GATE2
    GATE2 -->|"approved"| COMMIT
    GATE2 -->|"changes"| WRITEPLAN
```

One review pass per artifact. If MUST-FIX issues remain after one
revision, escalate to the user.

## Model rotation

Custom subagent profiles are pinned to specific models via the `model:`
field in their definition files. Profiles are discovered from
`.agents/agents/` in the workspace.

| Profile | Model | Role | Fires when |
|---------|-------|------|------------|
| `implementer` | `gpt-5.6-sol-medium` | Write code + initial tests | Task implementation |
| `reviewer` | `swe-1.7-medium` | Correctness, rule compliance, template compliance | After writer, all creation workflows |
| `code-optimizer` | `glm-5.2-high` | Code optimization (inefficiencies, OOM, concurrency) | After implementer, before reviewer |
| `test-agent` | `swe-1.7-medium` | Test suite writing | After implementation review |

The orchestrator runs on `gpt-5.6-sol-high`. All subagents are pinned
to different models via the `model:` field in their profile — none use
the orchestrator's model. The orchestrator is used only for the
planning workflow (spec + plan). A separate task-writer handles task
creation so the expensive orchestrator is not used for every task.

## Subagent architecture

```mermaid
graph TD
    ORCH["**Orchestrator** (main agent)<br/>loads adhd once, builds context packets,<br/>writes spec + plan, dispatches reviewer"]

    subgraph "Custom profiles (.agents/agents/)"
        IMPL["implementer.md<br/>model: gpt-5.6-sol-medium<br/>write access, with context"]
        REV["reviewer.md<br/>model: swe-1.7-medium<br/>read-only, with context"]
        CODEOPT["code-optimizer.md<br/>model: glm-5.2-high<br/>read-only, with context"]
        TEST["test-agent.md<br/>model: swe-1.7-medium<br/>write access"]
    end

    ORCH -->|"implementation"| IMPL
    ORCH -->|"after writer"| REV
    ORCH -->|"after implementer"| CODEOPT
    ORCH -->|"after review"| TEST
```

Subagents run **sequentially**, not in parallel. Each one finishes
before the next starts. One task at a time — no parallel lanes.
Subagents receive context packets (not conversation history) built by
the CLI. Each packet contains the target entity, parent, children,
modules, components, and cascaded skills.

## Workflow skills

The `pc-*` skills are the user-facing slash commands that drive the
workflow. They live in `.agents/skills/` and are discovered by Devin.

| Command | Purpose |
|---------|---------|
| `/pc-plan` | Run the planning workflow — adhd once, write spec, review, write plan, review |
| `/pc-create-tasks` | Run the task-writer workflow — read spec+plan, write task MDs + JSONL |
| `/pc-implement` | Run the task-implementation workflow — implementer → code-optimizer → reviewer → test-agent |
| `/pc-review` | Run the PR review workflow — mechanical checks, dispatch reviewer, open PR |
| `/pc-inspect-project` | Read project state and print specs/plans/tasks with status |
| `/pc-context` | Build a context packet for a spec/plan/task |
| `/pc-uuid` | Generate a deterministic UUID from an ID |

## Commands

```bash
# Scaffold a new workspace (do NOT run against existing repos with data)
project-context init -t <target> [--discover] [-w <workspace>]

# Inspect project state
project-context inspect -t .

# Refresh project overview from workflow .md files
project-context overview -t .

# Build graph nodes and edges from source files
project-context graph -t .

# Build a context packet for a spec/plan/task
project-context context PLAN-003 -t . -o packet.json

# Add a new spec/plan/task (creates MD file, appends to JSONL for tasks)
project-context add --type plan --title "Title" --parent SPEC-001 -t .

# Update status (updates MD file, appends to JSONL for tasks)
project-context status PLAN-003 committed -t .

# Sync task→plan and plan→spec status rollups
project-context sync -t .

# Safe asset synchronization (workflows, templates, skills, agent profiles)
project-context upgrade -t . \
  --source /path/to/project-context/src \
  --no-symlink --no-hooks --no-bundled-skills
```

### Safe upgrade

`upgrade` synchronizes generated assets from the source repository
while preserving workspace data. It copies:

- workflows → `workflows/`
- skills → `.agents/skills/`
- agent profiles → `.agents/agents/`
- templates → `templates/`

The `--no-symlink`, `--no-hooks`, and `--no-bundled-skills` flags
prevent unwanted side effects:

- `--no-symlink` — don't create a `.agents` symlink at the project root
- `--no-hooks` — don't create `.devin/hooks.v1.json`
- `--no-bundled-skills` — don't copy language/implementation skills
  into the workflow workspace (they belong at the repo root or
  user-level)

`upgrade` also removes obsolete assets from older versions:
`overview.xlsx`, old workflow files (`spec-creation.md`, etc.), old
skill directories (unprefixed names), old agent profiles
(`spec-optimizer.md`, `plan-optimizer.md`, `task-optimizer.md`), and
stale templates.

## Directory structure

```text
target repository/
├── .ai-trust/                      # durable workspace
│   ├── AGENTS.md                   # workflow protocol (generated)
│   ├── .agents/
│   │   ├── AGENTS.md               # shared skill instructions (generated)
│   │   ├── agents/                 # subagent profiles (generated)
│   │   │   ├── reviewer.md
│   │   │   ├── code-optimizer.md
│   │   │   ├── implementer.md
│   │   │   └── test-agent.md
│   │   └── skills/                 # pc-* workflow skills (generated)
│   ├── workflows/                  # workflow definitions (generated)
│   ├── templates/                  # document templates (generated)
│   ├── specs/                      # spec documents (authored)
│   ├── plans/                      # plan documents (authored)
│   ├── tasks/                      # task documents (authored)
│   ├── data/                       # JSONL + JSON state files
│   │   ├── tasks.jsonl             # task event log (append-only)
│   │   ├── identity.json           # project identity
│   │   ├── skills.json            # skill registry + matrix
│   │   └── decisions.json         # ADR index
│   ├── decisions/                  # ADRs and research findings
│   └── architecture/              # architecture docs
└── tools/
    └── project-context             # bundled CLI (esbuild, self-contained)
```

## Bundled CLI

The CLI is bundled with esbuild into a single self-contained file.
This eliminates the need for `node_modules` or an external checkout:

```bash
npm run bundle
# or
npx esbuild bin/cli.js --bundle --platform=node --format=cjs \
  --outfile=dist/project-context --keep-names
chmod +x dist/project-context
```

Check the version:

```bash
node dist/project-context --version
```

The release workflow (`.github/workflows/release.yml`) automates
bundling on every merge to `main`. The bundle is uploaded as a GitHub
release asset and as a CI artifact. Target repos download it and
place it in their `tools/` directory.

## Versioning

This project uses [semantic-release](https://semantic-release.gitbook.io/)
with [conventional commits](https://www.conventionalcommits.org/).
Version bumps are automatic based on commit messages:

| Commit type | Version bump |
|-------------|-------------|
| `feat:` | minor |
| `fix:`, `perf:` | patch |
| `feat!:` or `BREAKING CHANGE:` | major |
| `docs:`, `chore:`, `style:`, `test:`, `refactor:` | none |

A `CHANGELOG.md` is generated automatically with each release.

## Source repository layout

```text
project-context/
├── bin/cli.js                      # CLI entry point
├── src/
│   ├── agents/                     # subagent profile source
│   │   ├── reviewer.md             #   model: swe-1.7-medium
│   │   ├── code-optimizer.md       #   model: glm-5.2-high
│   │   ├── implementer.md          #   model: gpt-5.6-sol-medium
│   │   └── test-agent.md           #   model: swe-1.7-medium
│   ├── commands/                   # CLI commands
│   │   ├── init.js
│   │   ├── inspect.js
│   │   ├── overview.js
│   │   ├── context.js
│   │   ├── add.js
│   │   ├── status.js
│   │   ├── sync.js
│   │   ├── upgrade.js
│   │   └── shared.js
│   ├── skills/                     # pc-* workflow skill source
│   ├── templates/                  # document template source
│   └── workflows/                  # workflow definition source
├── test/                           # test suite
├── package.json
└── AGENTS.md                       # development workflow for this repo
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Bundle the CLI
npx esbuild bin/cli.js --bundle --platform=node --format=cjs \
  --outfile=dist/project-context --keep-names
```

## Core invariant

Project Context is the source of truth. Graph and semantic indexes are
derived views. Agents consume compiled context packets rather than
reconstructing the project from scratch.
