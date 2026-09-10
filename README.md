# Project Context

A Git-backed project management and context protocol for AI coding
agents. Project Context gives an existing codebase a durable,
structured source of truth for specs, plans, tasks, architecture,
decisions, and workflows — with review pipelines that pressure-test
every document before it ships.

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
    SPEC["**SPEC**<br/>adhd → research → write<br/>blind rounds 1-2 → planner round 3"]
    PLAN["**PLAN**<br/>adhd → research → write<br/>blind rounds 1-2 → planner round 3"]
    TASK["**TASK**<br/>adhd → write<br/>code-optimizer → blind"]
    IMPL["**IMPLEMENT**<br/>adhd → primary → secondary<br/>→ reviewer → tester"]
    REVIEW["**REVIEW**<br/>adhd → mechanical<br/>→ review subagent → PR"]

    SPEC -->|approve| PLAN
    PLAN -->|approve| TASK
    TASK -->|implement| IMPL
    IMPL -->|all tasks done| REVIEW
    REVIEW -->|squash merge| DONE["**DONE**<br/>tag + record in xlsx"]
```

## Tiered review (credit-efficient)

Spec and plan creation use a tiered review pattern: cheap models catch
structural issues first, then a heavy model fires once for deep
architecture review.

```mermaid
graph TD
    WRITE["**Writer** (orchestrator)<br/>loads adhd, writes document"]
    BLIND1["**Round 1-2: Blind reviewer**<br/>swe-1.7-medium (cheap)<br/>structural / template / rule checks"]
    SEC["**Security reviewer** (parallel)<br/>subagent_explore (cheap)<br/>only if crypto/auth work"]
    PLANNER["**Round 3: Planner**<br/>gpt-5.6-sol-medium (heavy)<br/>adhd loaded<br/>architecture / coverage / problem fit"]
    COMMIT["**Commit**"]

    WRITE --> BLIND1
    WRITE --> SEC
    BLIND1 -->|"MUST-FIX? revise, re-run"| BLIND1
    BLIND1 -->|"rounds 1-2 pass"| PLANNER
    SEC -->|"findings applied"| PLANNER
    PLANNER -->|"pass (NITs only)"| COMMIT
    PLANNER -->|"MUST-FIX? escalate"| USER["**Escalate to user**"]
```

This cuts heavy-model calls from 6 per spec+plan pair to 1.

## Model rotation

Custom subagent profiles are pinned to specific models via the `model:`
field in their definition files. Profiles are discovered from
`.devin/agents/` at the project root.

| Profile | Model | Role | Fires when |
|---------|-------|------|------------|
| `planner` | `gpt-5.6-sol-medium` | Spec/plan architecture review | Round 3 only |
| `code-optimizer` | `glm-5.2-high` | Task implementation review | Task creation |
| `blind-reviewer` | `swe-1.7-medium` | Rules compliance, no context | Rounds 1-2, every workflow |
| `test-agent` | `swe-1.7-medium` | Test suite writing | After implementation |
| research/security | `subagent_explore` (host default) | Research, security review | Background, cheap |

## Subagent architecture

```mermaid
graph TD
    ORCH["**Orchestrator** (main agent)<br/>builds context packets, spawns subagents,<br/>applies findings, never writes code"]

    subgraph "Custom profiles (.devin/agents/)"
        PLANNER["planner.md<br/>model: gpt-5.6-sol-medium<br/>read-only, with context"]
        CODEOPT["code-optimizer.md<br/>model: glm-5.2-high<br/>read-only, with context"]
        BLIND["blind-reviewer.md<br/>model: swe-1.7-medium<br/>read-only, no context"]
        TEST["test-agent.md<br/>model: swe-1.7-medium<br/>write access"]
    end

    subgraph "Built-in profiles"
        EXPLORE["subagent_explore<br/>host default model<br/>read-only + web search"]
    end

    ORCH -->|"spec/plan round 3"| PLANNER
    ORCH -->|"task creation"| CODEOPT
    ORCH -->|"rounds 1-2, all workflows"| BLIND
    ORCH -->|"after implementation"| TEST
    ORCH -->|"research, security review"| EXPLORE
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
│   │   │   ├── planner.md
│   │   │   ├── code-optimizer.md
│   │   │   ├── blind-reviewer.md
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
│       ├── planner.md
│       ├── code-optimizer.md
│       ├── blind-reviewer.md
│       └── test-agent.md
└── tools/
    └── project-context             # bundled CLI (esbuild, self-contained)
```

## Bundled CLI

The CLI is bundled with esbuild into a single self-contained file at
`tools/project-context` in the target repository. This eliminates the
need for `node_modules` or an external checkout:

```bash
npx esbuild bin/cli.js --bundle --platform=node --format=cjs \
  --outfile=target/tools/project-context --keep-names
chmod +x target/tools/project-context
```

The GitHub Actions workflow (`.github/workflows/bundle.yml`) automates
this on every push to `main`.

## Source repository layout

```text
project-context/
├── bin/cli.js                      # CLI entry point
├── src/
│   ├── agents/                     # subagent profile source
│   │   ├── planner.md              #   model: gpt-5.6-sol-medium
│   │   ├── code-optimizer.md       #   model: glm-5.2-high
│   │   ├── blind-reviewer.md       #   model: swe-1.7-medium
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
