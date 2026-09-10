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
│   ├── agents/                      # Custom subagent profiles (spec-optimizer, plan-optimizer, task-optimizer, reviewer, code-optimizer, test-agent)
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
| Skill Matrix | Trigger × Language → primary/secondary skill mapping |
| Decisions | ADR index |
| Workflows | Links to workflow files |

### Skills sheet

The `Skills` sheet is a unified skill registry:

```
| Skill | Path | Layer | Workflow/Trigger | Purpose |
|-------|------|-------|------------------|---------|
| go-systems-programmer | user-level | always-on | all | Base Go style for all sessions |
| go-security-expert | user-level | always-on | task-implementation | Security for crypto tasks |
| golang-testing | user-level | project-local | all | Testing for any Go task |
| golang-security | user-level | user-local | crypto | Crypto security review |
```

- **Skill**: the skill name (used with `skill invoke --skill <name>`)
- **Path**: `user-level`, `project-local`, or the path to the skill
- **Layer**: `always-on`, `project-local`, or `user-local`
- **Workflow/Trigger**:
  - For `always-on` / `project-local`: the workflow name (e.g. `task-implementation`) or `all`
  - For `user-local`: the trigger name (e.g. `crypto`)
- **Purpose**: human-readable note

### Skills column

The `Skills` column on Specs, Plans, and Tasks sheets contains
comma-separated skill names. Skills cascade downward:

- A **spec** lists skills needed for the whole feature area.
- A **plan** inherits its parent spec's skills and adds its own.
- A **task** inherits its parent plan's skills (and grandparent spec's)
  and adds its own.

When building a context packet, all applicable skills are collected
and deduplicated: always-on (for this workflow) + project-local (for this
workflow) + user-local (matching the task's triggers) + Skill Matrix
(by language and trigger) + target skills + parent skills + grandparent
skills.

### Skill layers

The context packet exposes four skill layers plus a trigger matrix:

| Layer | Source | When to load |
|-------|--------|--------------|
| `alwaysOn` | `Skills` sheet, layer `always-on` | At session start, for the current workflow |
| `projectLocal` | `Skills` sheet, layer `project-local` | When working on any task in this project, for the current workflow |
| `userLocal` | `Skills` sheet, layer `user-local` | When the task's `Triggers` column matches the row's `Workflow/Trigger` |
| `matrixSkills` | `Skill Matrix` sheet | When the task's `Triggers` column matches a matrix row for the project language |
| `target/parent/grandparent` | `Skills` column on Specs/Plans/Tasks | Cascaded from spec → plan → task |

### Skill Matrix

The `Skill Matrix` sheet maps a `Trigger` + `Language` to `Primary Skills` and
`Secondary Skills`:

```
| Trigger  | Language | Primary Skills        | Secondary Skills     | Notes |
|----------|----------|----------------------|----------------------|-------|
| ed25519  | Go       | ed25519-skill        | wycheproof, crypto   | …     |
| ed25519  | Rust     | rust-ed25519         | rust-security        | …     |
| ui-review| any      | design-system, a11y  | —                    | …     |
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
  then the `primarySkills` for its primary lens. The testing agent loads
  `secondarySkills` plus any `userLocal` skills when writing the full
  test suite.

### Subagent profiles

`spec-optimizer`, `plan-optimizer`, `task-optimizer`, `reviewer`, `code-optimizer`, and `test-agent` are **custom subagent profiles** under `.agents/agents/`. They are not invoked as regular skills. The thin skill wrappers (`/spec-optimizer`, `/plan-optimizer`, `/task-optimizer`, `/reviewer`, `/code-optimizer`, `/test`) use `agent: spec-optimizer` / `agent: plan-optimizer` / `agent: task-optimizer` / `agent: reviewer` / `agent: code-optimizer` / `agent: test-agent` in their frontmatter to spawn them. Subagents can run in the foreground or background — the orchestrator decides.

- **`spec-optimizer`** — optimizes **specs** for problem fit, scope discipline, approach soundness, and coverage. Runs BEFORE the reviewer. Read-only, with context. Model: `gpt-5.6-sol-medium` (heavy).
- **`plan-optimizer`** — optimizes **plans** for spec coverage, workstream ordering, approach soundness, and dependency edges. Runs BEFORE the reviewer. Read-only, with context. Model: `glm-5.2-high` (medium).
- **`task-optimizer`** — optimizes **tasks** for file paths, algorithm IDs, test vectors, and implementation readiness. Runs BEFORE the reviewer. Read-only, with context. Model: `glm-5.2-high`.
- **`reviewer`** — checks any document (spec, plan, task) for correctness, rule compliance, template compliance, and dependency compliance. Runs AFTER the optimizer. Read-only, with context. Model: `swe-1.7-medium`.
- **`code-optimizer`** — optimizes implemented code for inefficiencies, OOM risks, concurrency bugs, error handling gaps, and style. Runs after the implementer, before the reviewer. Read-only, with context. Model: `glm-5.2-high`.
- **`test-agent`** — writes the full test suite during implementation. Write access. Model: `swe-1.7-medium`.

### Language skill matrix

When a task is code-heavy, the `test-agent`, `code-optimizer`, and `task-optimizer` load language-specific skills based on the repo's manifests:

| Language | Detected by | Primary skill | Secondary skills |
|---|---|---|---|
| Go | `go.mod` | `golang-testing` | `golang-performance`, `golang-security`, `golang-code-style` |
| TypeScript | `package.json` | `typescript-unit-testing` | `typescript-security-review`, `typescript-code-review`, `accelint-ts-performance` |
| Python | `pyproject.toml`, `requirements.txt`, `setup.py` | `python-testing-patterns` | `python-performance-optimization`, `python-cybersecurity-tool-development`, `python-code-style` |
| Rust | `Cargo.toml` | `rust-testing` | `rust-performance`, `rust-security` |

For `task-optimizer`, the primary skill is `golang-performance` / `typescript-code-review` / `python-code-style` / `rust-performance`. For `code-optimizer`, the primary skill is `golang-performance` / `typescript-code-review` / `python-code-style` / `rust-performance` (same lens, applied to implemented code). For `test-agent`, the primary is the testing skill listed above.

If a language skill is not installed, the subagent uses general knowledge and reports that the skill is missing. The orchestrator can install it later with `npx skills add <owner/repo@skill> -g -y`.

### Skill triggers

| Trigger | Meaning |
|---------|---------|
| `user` | Invokable by the user via `/skill-name` |
| `model` | Invokable by the model (orchestrator) autonomously |

Orchestrator skills (spec-create, plan-create, task-create, implement,
review, approve-spec, approve-plan) use both triggers. Utility skills
(inspect, context, uuid) use both. Subagent wrapper skills (spec-optimizer,
plan-optimizer, task-optimizer, reviewer, code-optimizer) use `model` only — they are spawned by orchestrators, not
invoked directly by users.

## CLI commands

All skills use the `project-context` CLI at
`/Users/brian/code/project-context/bin/cli.js`:

```bash
# Generate a deterministic v5 UUID from an ID
node /Users/brian/code/project-context/bin/cli.js uuid SPEC-001

# Build a minimal context packet for a spec/plan/task (JSON output)
# -w is optional — auto-detects .{reponame}-manager
# --workflow defaults to 'all'; use it to scope always-on/project-local skills
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
SPEC → `/create-spec` workflow (adhd → research → write → optimize → review, max 3 rounds)
  ↓
PLAN → `/create-plan` workflow (adhd → research → write → optimize → review, max 3 rounds)
  ↓
TASK → `/create-task` workflow (adhd → write → optimize → review, max 3 rounds)
  ↓
IMPLEMENT → `/implement` workflow (adhd → implementer → code-optimizer → reviewer → tester)
  ↓
REVIEW → `/review` workflow (adhd → mechanical → reviewer → apply → PR)
```

## Orchestrator-optimizer-reviewer pattern

Every workflow starts with the `adhd` skill for divergent ideation,
loaded by the orchestrator (the big brain with full context). The
orchestrator writes the document, then dispatches an optimizer subagent
(with context) to tighten it, then a reviewer subagent (with context)
to check correctness.

### Spec and plan creation

1. **Orchestrator** — loads `adhd`, dispatches research subagent, writes
   the document.
2. **Optimizer** (spec-optimizer or plan-optimizer, with context) —
   optimizes for problem fit, approach soundness, scope discipline, and
   coverage. Reports findings. Does not fix.
3. **Reviewer** (reviewer, with context) — checks correctness, rule
   compliance, template compliance, dependency compliance. Reports
   findings. Does not fix.
4. The orchestrator revises. Max 3 rounds, then escalate.

### Task creation

1. **Orchestrator** — loads `adhd` + primary skill, writes the task file.
2. **Optimizer** (task-optimizer, with context) — optimizes for file
   paths, algorithm IDs, test vectors, and scope. Reports findings.
   Does not fix.
3. **Reviewer** (reviewer, with context) — checks correctness, rule
   compliance, template compliance, dependency compliance. Reports
   findings. Does not fix.
4. The orchestrator revises. Max 3 rounds, then escalate.

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
| `/spec-optimizer` | Subagent | Optimize a spec with context (read-only) |
| `/plan-optimizer` | Subagent | Optimize a plan with context (read-only) |
| `/task-optimizer` | Subagent | Optimize a task with context (read-only) |
| `/reviewer` | Subagent | Check correctness, rule compliance (read-only) |
| `/code-optimizer` | Subagent | Optimize implemented code (read-only) |
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
10. **Optimizers and reviewers suggest, the writer revises.** Subagents
    are read-only. They report findings. The orchestrator applies fixes.
    Use `spec-optimizer` for specs, `plan-optimizer` for plans,
    `task-optimizer` for tasks, then `reviewer` for correctness checks.
    Use `code-optimizer` for implemented code before the reviewer.
