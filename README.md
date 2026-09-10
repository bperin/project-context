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
        XLSX[overview.xlsx — source of truth]
        DOCS[specs/, plans/, tasks/ — prose documents]
        AGENTS[.ai-trust/.agents/ — skills + agent profiles]
        DEVIN[.devin/agents/ — host-discovered profiles]
        WF[.ai-trust/workflows/ — workflow definitions]
        TEMPLATES[.ai-trust/templates/ — document templates]
        BIN[tools/project-context — bundled CLI]
    end

    SRC -->|"upgrade --source ... --no-symlink --no-hooks --no-bundled-skills"| AGENTS
    SRC -->|upgrade| WF
    SRC -->|upgrade| TEMPLATES
    SRC -->|upgrade| DEVIN
    SRC -->|"esbuild bundle"| BIN

    XLSX -->|context packet| BIN
    DOCS -->|document bodies| BIN
    BIN -->|inspect / status / add / sync| XLSX
```

The `overview.xlsx` workbook is the source of truth for structured
data (IDs, UUIDs, statuses, dependencies, skills). Markdown documents
hold prose, requirements, acceptance criteria, and implementation
detail. The workbook indexes the documents; the documents provide the
substance.

## Workflow lifecycle

Every workflow starts with the `adhd` skill for divergent ideation,
regardless of which model runs the steps.

```mermaid
graph LR
    SPEC["**SPEC**<br/>adhd → research → write<br/>→ optimize → review"]
    PLAN["**PLAN**<br/>adhd → research → write<br/>→ optimize → review"]
    TASK["**TASK**<br/>adhd → write<br/>→ optimize → review"]
    IMPL["**IMPLEMENT**<br/>adhd → implementer<br/>→ code-optimizer → reviewer → tester"]
    REVIEW["**REVIEW**<br/>adhd → mechanical<br/>→ reviewer → PR"]

    SPEC -->|approve| PLAN
    PLAN -->|approve| TASK
    TASK -->|implement| IMPL
    IMPL -->|all tasks done| REVIEW
    REVIEW -->|squash merge| DONE["**DONE**<br/>tag + record in xlsx"]
```

## Orchestrator-optimizer-reviewer pattern

Every workflow starts with the `adhd` skill for divergent ideation,
loaded by the orchestrator (the big brain with full context). The
orchestrator writes the document, then dispatches an optimizer subagent
(with context) to tighten it, then a reviewer subagent (with context)
to check correctness.

```mermaid
graph TD
    WRITE["**Orchestrator** (main agent)<br/>loads adhd, writes document"]
    OPT["**Optimizer** (subagent, with context)<br/>tightens scope, challenges approach,<br/>checks coverage"]
    REVIEW["**Reviewer** (subagent, with context)<br/>checks correctness, rule compliance,<br/>template compliance, dependencies"]
    COMMIT["**Commit**"]

    WRITE --> OPT
    OPT --> REVIEW
    REVIEW -->|"MUST-FIX? revise, re-run"| REVIEW
    REVIEW -->|"pass (NITs only)"| COMMIT
    REVIEW -->|"MUST-FIX? escalate"| USER["**Escalate to user**"]
```

Max 3 rounds, then escalate to the user.

## Model rotation

Custom subagent profiles are pinned to specific models via the `model:`
field in their definition files. Profiles are discovered from
`.devin/agents/` at the project root.

| Profile | Model | Role | Fires when |
|---------|-------|------|------------|
| `implementer` | `gpt-5.6-sol-medium` | Write code + initial tests | Task implementation |
| `spec-optimizer` | `gpt-5.6-sol-medium` | Spec optimization (approach, scope) | Spec creation, before reviewer |
| `plan-optimizer` | `glm-5.2-high` | Plan optimization (ordering, coverage) | Plan creation, before reviewer |
| `task-optimizer` | `glm-5.2-high` | Task optimization (files, vectors, readiness) | Task creation, before reviewer |
| `reviewer` | `swe-1.7-medium` | Correctness, rule compliance, template compliance | After optimizer, all creation workflows |
| `code-optimizer` | `glm-5.2-high` | Code optimization (inefficiencies, OOM, concurrency) | After implementer, before reviewer |
| `test-agent` | `swe-1.7-medium` | Test suite writing | After implementation review |

The orchestrator runs on `gpt-5.6-sol-high`. All subagents are pinned
to different models via the `model:` field in their profile — none use
the orchestrator's model.

## Subagent architecture

```mermaid
graph TD
    ORCH["**Orchestrator** (main agent)<br/>loads adhd, builds context packets,<br/>dispatches subagents, applies findings"]

    subgraph "Custom profiles (.devin/agents/)"
        IMPL["implementer.md<br/>model: gpt-5.6-sol-medium<br/>write access, with context"]
        SPECOPT["spec-optimizer.md<br/>model: gpt-5.6-sol-medium<br/>read-only, with context"]
        PLANOPT["plan-optimizer.md<br/>model: glm-5.2-high<br/>read-only, with context"]
        TASKOPT["task-optimizer.md<br/>model: glm-5.2-high<br/>read-only, with context"]
        REV["reviewer.md<br/>model: swe-1.7-medium<br/>read-only, with context"]
        CODEOPT["code-optimizer.md<br/>model: glm-5.2-high<br/>read-only, with context"]
        TEST["test-agent.md<br/>model: swe-1.7-medium<br/>write access"]
    end

    ORCH -->|"implementation"| IMPL
    ORCH -->|"spec creation"| SPECOPT
    ORCH -->|"plan creation"| PLANOPT
    ORCH -->|"task creation"| TASKOPT
    ORCH -->|"after optimizer"| REV
    ORCH -->|"after implementer"| CODEOPT
    ORCH -->|"after review"| TEST
```

Subagents receive context packets (not conversation history) built by
the CLI. Each packet contains the target entity, parent, children,
modules, components, and cascaded skills.

## Commands

```bash
# Scaffold a new workspace (do NOT run against existing repos with data)
project-context init -t <target> [--discover] -w <workspace>

# Inspect the workbook
project-context inspect -w .ai-trust -t .

# Refresh the Workflows sheet from workflow .md files (preserves all other sheets)
project-context overview -w .ai-trust -t .

# Build a context packet for a spec/plan/task
project-context context PLAN-003 -w .ai-trust -t . -o packet.json

# Add a new spec/plan/task row
project-context add --type plan --title "Title" --parent SPEC-001 -w .ai-trust -t .

# Update status
project-context status PLAN-003 committed -w .ai-trust -t .

# Sync task→plan and plan→spec status rollups
project-context sync -w .ai-trust -t .

# Safe asset synchronization (workflows, templates, skills, agent profiles)
project-context upgrade -w .ai-trust -t . \
  --source /path/to/project-context/src \
  --no-symlink --no-hooks --no-bundled-skills
```

### Safe upgrade

`upgrade` synchronizes generated assets from the source repository
while preserving workbook data. It copies:

- workflows → `.ai-trust/workflows/`
- skills → `.ai-trust/.agents/skills/`
- agent profiles → `.ai-trust/.agents/agents/` **and** `.devin/agents/`
- templates → `.ai-trust/templates/`

The `--no-symlink`, `--no-hooks`, and `--no-bundled-skills` flags
prevent unwanted side effects:

- `--no-symlink` — don't create a `.agents` symlink at the project root
- `--no-hooks` — don't create `.devin/hooks.v1.json`
- `--no-bundled-skills` — don't copy language/implementation skills
  into the workflow workspace (they belong at the repo root or
  user-level)

Agent profiles are copied to `.devin/agents/` (without generated
headers) so the Devin host discovers them as custom subagent
profiles with their pinned models.

## Directory structure

```text
target repository/
├── .ai-trust/                      # durable workspace
│   ├── overview.xlsx               # source of truth (structured data)
│   ├── AGENTS.md                   # workflow protocol (generated)
│   ├── .agents/
│   │   ├── AGENTS.md               # shared skill instructions (generated)
│   │   ├── agents/                 # subagent profiles (generated)
│   │   │   ├── spec-optimizer.md
│   │   │   ├── plan-optimizer.md
│   │   │   ├── task-optimizer.md
│   │   │   ├── reviewer.md
│   │   │   ├── code-optimizer.md
│   │   │   ├── implementer.md
│   │   │   └── test-agent.md
│   │   └── skills/                 # workflow skills (generated)
│   ├── workflows/                  # workflow definitions (generated)
│   ├── templates/                  # document templates (generated)
│   ├── specs/                      # spec documents (authored)
│   ├── plans/                      # plan documents (authored)
│   ├── tasks/                      # task documents (authored)
│   ├── decisions/                  # ADRs and research findings
│   └── architecture/              # architecture docs
├── .devin/
│   └── agents/                     # host-discovered subagent profiles
│       ├── spec-optimizer.md
│       ├── plan-optimizer.md
│       ├── task-optimizer.md
│       ├── reviewer.md
│       ├── code-optimizer.md
│       ├── implementer.md
│       └── test-agent.md
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
│   │   ├── spec-optimizer.md       #   model: gpt-5.6-sol-medium
│   │   ├── plan-optimizer.md       #   model: glm-5.2-high
│   │   ├── task-optimizer.md       #   model: glm-5.2-high
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
│   ├── skills/                     # workflow skill source
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
