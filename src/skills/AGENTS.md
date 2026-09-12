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
├── .agents/
│   ├── AGENTS.md                    # Shared skill instructions (this file)
│   ├── agents/                      # Custom subagent profiles (implementer, reviewer, code-optimizer, test-agent)
│   └── skills/                      # pc-* workflow + utility skills
├── workflows/*.md                   # Workflow definitions (mermaid diagrams)
├── specs/SPEC-NNN.md               # Spec documents
├── plans/PLAN-NNN.md               # Plan documents
├── plans/PLAN-NNN.timeline.jsonl   # Per-plan build timeline (append-only)
├── tasks/TASK-NNN.md               # Task documents
├── data/
│   ├── tasks.jsonl                 # Task event log (append-only)
│   ├── identity.json               # Project identity
│   ├── skills.json                 # Skill registry + matrix
│   └── decisions.json              # ADR index
├── architecture/                    # Architecture docs
├── decisions/                       # ADRs
├── identity/                        # Project identity
└── graph/
    ├── nodes/                       # Source file nodes (JSON)
    └── edges/                       # Dependency edges (JSON)
```

## Source of truth

JSONL files hold task state. Markdown files hold spec/plan/task
documents. JSON files hold project metadata.

| File | Content |
|------|---------|
| `data/tasks.jsonl` | Task event log — append-only. Each line is an event (created, started, done). |
| `plans/PLAN-NNN.timeline.jsonl` | Per-plan build timeline — append-only. |
| `data/identity.json` | Project name, stack, modules, repo |
| `data/skills.json` | Skill registry and skill matrix |
| `data/decisions.json` | ADR index |
| `specs/SPEC-NNN.md` | Spec documents (human-readable, status in file) |
| `plans/PLAN-NNN.md` | Plan documents (human-readable, status in file) |
| `tasks/TASK-NNN.md` | Task documents (human-readable, status in file) |

Do not edit JSONL files directly. Register specs/plans/tasks with
`project-context add` and update status with `project-context status`.
The CLI handles UUID generation, event formatting, and timeline updates.

### tasks.jsonl format

Append-only event log. Each line is a JSON object:

```jsonl
{"id":"TASK-001","event":"created","title":"Add JSONL backend","plan":"PLAN-001","status":"draft","skills":"go-crypto","triggers":"crypto","ts":"2026-09-11T..."}
{"id":"TASK-001","event":"started","ts":"2026-09-11T..."}
{"id":"TASK-001","event":"done","ts":"2026-09-11T..."}
```

The `created` event is written by the task-writer. The `started` and
`done` events are written by the `status` command during
implementation. The log is a historical record — do not modify past
lines.

### Plan timeline format

```jsonl
{"plan":"PLAN-001","task":"TASK-001","event":"queued","ts":"2026-09-11T..."}
{"plan":"PLAN-001","task":"TASK-001","event":"started","ts":"2026-09-11T..."}
{"plan":"PLAN-001","task":"TASK-001","event":"done","ts":"2026-09-11T..."}
```

### Skills

The `data/skills.json` file contains the skill registry and matrix:

```json
{
  "skills": [
    {"skill": "go-systems-programmer", "path": "user-level", "layer": "always-on", "workflowTrigger": "all", "purpose": "Base Go style"},
    {"skill": "golang-testing", "path": "user-level", "layer": "project-local", "workflowTrigger": "all", "purpose": "Testing for Go tasks"}
  ],
  "matrix": [
    {"trigger": "crypto", "language": "Go", "primarySkills": "golang-security", "secondarySkills": "wycheproof", "notes": "Crypto implementation"}
  ]
}
```

Skills cascade downward: a spec lists skills for the whole feature
area, a plan inherits and adds, a task inherits and adds.

### How attached skills are loaded

Skills are recorded in spec/plan/task metadata during planning and
task-writing, but they are not loaded until implementation. The
planner and task-writer record what skills will be needed; the
implementer loads them at implementation time.

- **Plan workflow**: the orchestrator loads `adhd` once, before
  writing the spec. No other skill is loaded during planning. Skills
  needed for implementation are recorded in the spec/plan metadata.
- **Task workflow**: the task-writer does not load `adhd` or any
  skills. It reads the spec and plan, thinks through implementations,
  writes tasks, and records each task's skills + triggers in the MD
  file and JSONL record.
- **Task implementation**: the implementer reads the task's skills
  and triggers from the JSONL record and loads them.

## Subagent profiles

`implementer`, `reviewer`, `code-optimizer`, and `test-agent` are
**custom subagent profiles** under `.agents/agents/`. They are pinned to
specific models via the `model:` field in their profile so they don't
all run on the expensive orchestrator model.

| Profile | Model | Role | Fires when |
|---------|-------|------|------------|
| `implementer` | `gpt-5.6-sol-medium` | Write code + initial tests | Task implementation |
| `reviewer` | `swe-1.7-medium` | Correctness, rule compliance, template compliance | After writer, all creation workflows |
| `code-optimizer` | `glm-5.2-high` | Code optimization (inefficiencies, OOM, concurrency) | After implementer, before reviewer |
| `test-agent` | `swe-1.7-medium` | Test suite writing | After implementation review |

The orchestrator runs on `gpt-5.6-sol-high`. All subagents are pinned to
different models via the `model:` field in their profile — none use the
orchestrator's model.

Subagents run **sequentially**, not in parallel. Each one finishes
before the next starts. One task at a time — no parallel lanes.

### Dispatch protocol — FOREGROUND, not background

All subagents in the implementation pipeline (implementer,
code-optimizer, reviewer, test-agent) must run as **foreground**
subagents. This is mandatory.

When you dispatch a subagent with `run_subagent`, you MUST set:
- `is_background: false` — the subagent blocks the orchestrator until it finishes
- `profile:` — the subagent profile name (e.g. `implementer`, `reviewer`)

**Never** set `is_background: true` for pipeline subagents. Background
subagents return immediately and you cannot collect their results. The
pipeline is sequential — each subagent must complete and return its
findings before the next one starts.

The only exception is the graph-update utility (step 10 of
pc-implement), which can run in the background because it doesn't
affect the pipeline.

Template for dispatching a pipeline subagent:
```
run_subagent(
  title: "Review TASK-NNN implementation",
  task: "<detailed task with context packet, file paths, AGENTS.md path>",
  profile: "reviewer",
  is_background: false
)
```

After dispatching, call `read_subagent` with `block: true` to wait for
the result. Do not poll — block until it finishes.

### Language skill matrix

When a task is code-heavy, the `test-agent`, `code-optimizer`, and
`reviewer` load language-specific skills based on the repo's manifests:

| Language | Detected by | test-agent | code-optimizer | reviewer |
|---|---|---|---|---|
| Go | `go.mod` | `golang-testing` | `golang-performance` | `go-code-review` |
| TypeScript | `package.json` | `typescript-unit-testing` | `typescript-code-review` | `typescript-security-review` |
| Python | `pyproject.toml`, `requirements.txt`, `setup.py` | `python-testing-patterns` | `python-code-style` | `python-code-style` |
| Rust | `Cargo.toml` | `rust-testing` | `rust-performance` | `rust-security` |

Each specialized agent loads its own column. The implementer loads the task's primary skill from the algorithm registry (not from this matrix). If a language skill is not installed, the subagent uses general knowledge and reports that the skill is missing.

## CLI commands

All skills use the `project-context` CLI at
`/Users/brian/code/project-context/bin/cli.js`:

```bash
# Generate a deterministic v5 UUID from an ID
node /Users/brian/code/project-context/bin/cli.js uuid SPEC-001

# Build a minimal context packet for a spec/plan/task (JSON output)
node /Users/brian/code/project-context/bin/cli.js context TASK-012 -t .

# Read project state and print specs/plans/tasks with status
node /Users/brian/code/project-context/bin/cli.js inspect -t .

# Refresh project overview from workflow markdown files
node /Users/brian/code/project-context/bin/cli.js overview -t .

# Build graph nodes and edges from source files
node /Users/brian/code/project-context/bin/cli.js graph -t .

# Scaffold a new .{reponame}-manager workspace
node /Users/brian/code/project-context/bin/cli.js init -t . --discover

# Add a spec/plan/task (creates MD file, appends to JSONL for tasks)
node /Users/brian/code/project-context/bin/cli.js add --type spec --title "<title>" --skills "<skills>" --triggers "<triggers>" -t .
node /Users/brian/code/project-context/bin/cli.js add --type plan --title "<title>" --parent "SPEC-001" --skills "<skills>" -t .
node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --parent "PLAN-001" --skills "<skills>" --triggers "<triggers>" -t .

# Update a spec/plan/task status (updates MD file, appends to JSONL for tasks)
node /Users/brian/code/project-context/bin/cli.js status TASK-001 done -t .

# Archive done/superseded records (moves MD to archive/, appends JSONL event)
node /Users/brian/code/project-context/bin/cli.js archive TASK-014 -t .
node /Users/brian/code/project-context/bin/cli.js archive --status done -t .
node /Users/brian/code/project-context/bin/cli.js inspect -t . --include-archived
```

## Context packets

Subagents must not receive conversation history. Instead, the
orchestrator builds a context packet and feeds it to the subagent:

```bash
node /Users/brian/code/project-context/bin/cli.js context TASK-012 -t . -o .context-packet.json
```

The packet contains:
- **target**: the spec/plan/task (id, uuid, title, status, skills, body)
- **parent**: the parent plan (if task) or parent spec (if plan)
- **grandparent**: the grandparent spec (if task)
- **children**: child plans (if spec) or child tasks (if plan)
- **modules**: project modules from the graph
- **skillLayers**: alwaysOn, projectLocal, userLocal, matrixSkills,
  primarySkills, secondarySkills
- **allSkills**: deduplicated cascade of all applicable skills

The subagent reads the packet + AGENTS.md + the document file. Nothing
else. This keeps subagent context lean and prevents conversation history
from leaking into reviews.

## Workflow lifecycle

```
PLAN → /pc-plan workflow (adhd once → write spec → review → [user approves] → write plan → review → [user approves])
  ↓
TASK → /pc-create-tasks workflow (task-writer reads spec+plan → writes task MDs + JSONL → review)
  ↓
IMPLEMENT → /pc-implement workflow (implementer → code-optimizer → reviewer → test-agent, sequential)
  ↓
REVIEW → /pc-review workflow (mechanical → dispatch reviewer → apply → PR)
  ↓
ARCHIVE → /pc-archive (move done/superseded records to archive/, append JSONL event)
```

Everything is linear. One task at a time. Subagents run sequentially —
each one finishes before the next starts.

## Rules for all skills

1. **Read AGENTS.md first.** It has the project workflow protocol.
2. **Read this file first.** It has the shared instructions.
3. **JSONL is the task state.** MD files are documents. Status for
   specs/plans is in the MD files. Status for tasks is in
   `data/tasks.jsonl`.
4. **Subagents run sequentially.** No parallel lanes. One task at a
   time. Each subagent finishes before the next starts.
5. **Pipeline subagents are FOREGROUND.** Always set `is_background:
   false` when dispatching implementer, code-optimizer, reviewer, or
   test-agent. Never background them. Block on `read_subagent` to
   collect results before proceeding.
6. **Generate UUIDs with the CLI.** Don't make up UUIDs. Use
   `project-context uuid <ID>`.
7. **Update state through the CLI.** Never edit JSONL files directly.
   Use `project-context add` to register specs/plans/tasks and
   `project-context status` to update status.
8. **Skills cascade.** A task inherits skills from its plan and spec.
   Load all applicable skills before starting work.
9. **One task at a time.** No parallel lanes. The build order in JSONL
   determines the sequence.
10. **Hard gates.** Stop and wait for the user after spec review and
    after plan review. Never auto-progress.
