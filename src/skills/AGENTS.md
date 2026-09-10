# Agent Instructions — project-context skills

> All skills in `.agents/skills/` must read this file first. It defines
> the shared protocol, the tools available, and how the skills work
> together. Individual SKILL.md files define the skill-specific steps
> — this file defines the common ground.

## Project model

This project uses `project-context` to manage AI agent context. The
workspace directory is named `.{reponame}-manager` (e.g.
`.trust-manager`, `.fake-project-manager`). A `.agents` symlink at the
project root points to the workspace's `.agents/` directory so Devin
discovers the skills.

The directory structure is flat — no nesting:

```
.{reponame}-manager/
├── AGENTS.md                        # Workflow protocol (read this too)
├── overview.xlsx                    # Source of truth — all specs, plans, tasks
├── .agents/
│   ├── AGENTS.md                    # Shared skill instructions (this file)
│   ├── agents/                      # Custom subagent profiles (optimizer, blind-reviewer)
│   └── skills/                      # Workflow + utility + skill wrappers
├── workflows/*.md                   # Workflow definitions (mermaid diagrams)
├── specs/SPEC-NNN.md               # Spec documents
├── plans/PLAN-NNN.md               # Plan documents
├── tasks/TASK-NNN.md               # Task documents
├── architecture/                    # Architecture docs
├── decisions/                       # ADRs
├── identity/                        # Project identity
└── graph/
    ├── nodes/                       # Source file nodes (JSON)
    └── edges/                       # Dependency edges (JSON)
```

## Source of truth

`overview.xlsx` is the single source of truth for all structured data.
Every spec, plan, task, module, component, dependency, decision, and
workflow link lives in that workbook. Markdown files are documents —
the xlsx is the index.

### Sheets

| Sheet | Content |
|-------|---------|
| Identity | Project name, stack, modules |
| Specs | UUID, ID, Title, Status, Progress, Dependencies, Skills, Commit |
| Plans | UUID, ID, Title, Status, Progress, Dependencies, Skills, Commit |
| Tasks | UUID, ID, Title, Status, Dependencies, Skills, Commit |
| Modules | Module, Path, Import, Purpose |
| Code Structure | Domain, Path, Module, Responsibility |
| Components | Component, Module, Layer, Status |
| Dependencies | Dependency, Version, Module, Purpose |
| Data Ownership | Data, Owner, Store, Ephemeral? |
| Realtime/Events/Channels | Channel, Direction, Transport, Purpose |
| Deployment | Unit, Type, Deploys to, Notes |
| Always-on (user-level) | Skills loaded at session start |
| On-demand (project-local) | Skills loaded for any task in this project |
| On-demand (user-level) | Skills loaded when the trigger condition matches |
| Skill Matrix | Trigger → primary/secondary skill mapping |
| Decisions | ADR index |
| Workflows | Links to workflow files |

### Skills column

The `Skills` column on Specs, Plans, and Tasks sheets contains
comma-separated skill names. Skills cascade downward:

- A **spec** lists skills needed for the whole feature area.
- A **plan** inherits its parent spec's skills and adds its own.
- A **task** inherits its parent plan's skills (and grandparent spec's)
  and adds its own.

When building a context packet, all applicable skills are collected
and deduplicated: always-on + on-demand project + on-demand user +
Skill Matrix triggers + target skills + parent skills + grandparent skills.

### Skill layers

The context packet exposes four skill layers plus a trigger matrix:

| Layer | Source | When to load |
|-------|--------|--------------|
| `alwaysOn` | `Always-on (user-level)` sheet | At session start, for every task |
| `projectLocal` | `On-demand (project-local)` sheet | When working on this project |
| `userLocal` | `On-demand (user-level)` sheet | When the trigger condition in the sheet matches |
| `matrixSkills` | `Skill Matrix` sheet | When the task's `Triggers` column matches a matrix row |
| `target/parent/grandparent` | `Skills` column on Specs/Plans/Tasks | Cascaded from spec → plan → task |

### Skill Matrix

The `Skill Matrix` sheet maps a `Trigger` to `Primary Skills` and
`Secondary Skills`:

```
| Trigger    | Primary Skills       | Secondary Skills     | Notes |
|------------|----------------------|----------------------|-------|
| ed25519    | ed25519-skill        | wycheproof, crypto   | …     |
| ui-review  | design-system, a11y  | —                    | …     |
```

A task lists its triggers in the `Triggers` column (e.g. `ed25519, crypto`).
The context packet resolves those triggers into `matrixSkills`, then splits
`Primary Skills` and `Secondary Skills` into `primarySkills` and
`secondarySkills`.

### How attached skills are loaded

Skills listed in the xlsx are **loaded by the orchestrator** at the
point of use, not at session start. The orchestrator (spec, plan,
task-create, implement) reads the context packet to find which skills
apply, then invokes each skill using the `skill` tool:

```
skill invoke --skill <skill-name>
```

- **Spec/plan/task creation**: the writer loads `adhd` for divergent
  ideation. Attached skills are listed in the document but not loaded
  during creation — they load during implementation.
- **Task implementation**: the implementer loads `alwaysOn` skills first,
  then the `primarySkills` for the primary implementer. The secondary
  implementer loads `secondarySkills` plus any `userLocal` skills.

### Subagent profiles

`optimizer`, `blind-reviewer`, and `test-agent` are **custom subagent profiles** under `.agents/agents/`. They are not invoked as regular skills. The thin skill wrappers (`/optimizer`, `/blind-reviewer`, `/test`) use `agent: optimizer` / `agent: blind-reviewer` / `agent: test-agent` in their frontmatter to spawn them. Subagents can run in the foreground or background — the orchestrator decides.

### Skill triggers

| Trigger | Meaning |
|---------|---------|
| `user` | Invokable by the user via `/skill-name` |
| `model` | Invokable by the model (orchestrator) autonomously |

Orchestrator skills (spec-create, plan-create, task-create, implement,
review, approve-spec, approve-plan) use both triggers. Utility skills
(inspect, context, uuid) use both. Subagent wrapper skills (optimizer,
blind-reviewer) use `model` only — they are spawned by orchestrators, not
invoked directly by users.

## CLI commands

All skills use the `project-context` CLI at
`/Users/brian/code/project-context/bin/cli.js`:

```bash
# Generate a deterministic v5 UUID from an ID
node /Users/brian/code/project-context/bin/cli.js uuid SPEC-001

# Build a minimal context packet for a spec/plan/task (JSON output)
# -w is optional — auto-detects .{reponame}-manager
node /Users/brian/code/project-context/bin/cli.js context TASK-012 -t .

# Read the xlsx and print specs/plans/tasks with status
node /Users/brian/code/project-context/bin/cli.js inspect -t .

# Refresh the Workflows sheet from workflow markdown files
node /Users/brian/code/project-context/bin/cli.js overview -t .

# Build graph nodes and edges from source files
node /Users/brian/code/project-context/bin/cli.js graph -t .

# Scaffold a new .{reponame}-manager workspace
node /Users/brian/code/project-context/bin/cli.js init -t . --discover

# Add a spec/plan/task row to overview.xlsx (agents use this, not direct edits)
node /Users/brian/code/project-context/bin/cli.js add --type spec --title "<title>" --skills "<skills>" --triggers "<triggers>" -t .
node /Users/brian/code/project-context/bin/cli.js add --type plan --title "<title>" --dependencies "SPEC-001" --skills "<skills>" -t .
node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --dependencies "PLAN-001" --skills "<skills>" --triggers "<triggers>" -t .

# Update a spec/plan/task status (agents use this, not direct edits)
node /Users/brian/code/project-context/bin/cli.js status TASK-001 done -t .
```

## Context packets

Subagents must not receive conversation history. Instead, the
orchestrator builds a context packet and feeds it to the subagent:

```bash
node /Users/brian/code/project-context/bin/cli.js context TASK-012 -t . -o .{reponame}-manager/.context-packet.json
```

The packet contains:
- **target**: the spec/plan/task row (id, uuid, title, status, skills)
- **parent**: the parent plan (if task) or parent spec (if plan)
- **grandparent**: the grandparent spec (if task)
- **children**: child plans (if spec) or child tasks (if plan)
- **modules**: all project modules
- **components**: all project components
- **allSkills**: deduplicated cascade of target + parent + grandparent skills

The subagent reads the packet + AGENTS.md + the document file. Nothing
else. This keeps subagent context lean and prevents conversation history
from leaking into reviews.

## Workflow lifecycle

```
SPEC → `/create-spec` workflow (writer-optimizer-blind, max 3 rounds)
  ↓
PLAN → `/create-plan` workflow (writer-optimizer-blind, max 3 rounds)
  ↓
TASK → `/create-task` workflow (writer-optimizer-blind, max 3 rounds)
  ↓
IMPLEMENT → `/implement` workflow (primary → secondary → reviewer → tester)
  ↓
REVIEW → `/review` workflow (mechanical → review subagent → apply → PR)
```

## Writer-optimizer-blind pattern

Every creation workflow (spec, plan, task) uses three perspectives with
escalating objectivity:

1. **Writer** (you, the orchestrator) — has full context, loads the
   `adhd` skill for divergent ideation, writes the document.
2. **Optimizer** (subagent, read-only, with context) — sees the document
   + a context summary. Suggests improvements, challenges scope, checks
   completeness. Reports findings. Does not fix.
3. **Blind reviewer** (subagent, read-only, no context) — sees only the
   document + AGENTS.md. Judges against rules, not intent. Reports
   findings. Does not fix.

Max 3 rounds. If unresolved after round 3, escalate to the user.

## Skills in this project

| Skill | Type | Purpose |
|-------|------|---------|
| `/create-spec` | Orchestrator | Run spec-creation workflow |
| `/create-plan` | Orchestrator | Run plan-creation workflow |
| `/create-task` | Orchestrator | Run task-creation workflow |
| `/implement` | Orchestrator | Run task-implementation workflow |
| `/review` | Orchestrator | Run code-review workflow |
| `/test` | Orchestrator | Spawn the test-agent (background, write access) |
| `/approve-spec` | Orchestrator | Approve a committed spec and start `/create-plan` |
| `/approve-plan` | Orchestrator | Approve a committed plan and start `/create-task` for each task |
| `/inspect-project` | Utility | Read xlsx, print status |
| `/context` | Utility | Build context packet for subagents |
| `/uuid` | Utility | Generate v5 UUID |
| `/optimizer` | Subagent | Review with context (read-only) |
| `/blind-reviewer` | Subagent | Review without context (read-only) |
| `/test-agent` | Subagent | Write the full test suite (write access) |

## Rules for all skills

1. **Read AGENTS.md first.** It has the project workflow protocol.
2. **Read this file first.** It has the shared instructions.
3. **The xlsx is the source of truth.** Markdown files are documents.
   Status, progress, dependencies, and skills live in the xlsx.
4. **Subagents get context packets, not conversation history.** Build
   a packet with `/context <ID>` and feed it to the subagent.
5. **Never block.** If something fails, report the error and continue.
6. **Never modify generated files.** If you need a template, copy the structure from the sample `overview.xlsx` and the relevant skill (`/create-spec`, `/create-plan`, `/create-task`), not by editing the xlsx.
7. **Generate UUIDs with the CLI.** Don't make up UUIDs. Use
   `project-context uuid <ID>`.
8. **Update the xlsx through the CLI.** Never edit `overview.xlsx`
   directly. Use `project-context add` to register specs/plans/tasks and
   `project-context status` to update status. The CLI handles UUID
   generation, column order, and duplicate detection.
9. **Skills cascade.** A task inherits skills from its plan and spec.
   Load all applicable skills before starting work.
10. **The optimizer suggests, the writer revises.** Subagents are
    read-only. They report findings. The orchestrator applies fixes.
