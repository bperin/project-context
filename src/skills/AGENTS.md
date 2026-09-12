# Agent Instructions — project-context skills

> All skills in `.agents/skills/` must read this file first. It defines
> the shared protocol, the tools available, and how the skills work
> together. Individual SKILL.md files define the skill-specific steps
> — this file defines the common ground.

## Three concepts — do not conflate them

| Concept | Lives in | What it is |
|---------|----------|------------|
| **Workflow** | `workflows/*.md` | The process — steps, order, gates, checks. The source of truth for HOW work flows. |
| **Skill** | `.agents/skills/pc-*/SKILL.md` | A thin entry point — invoked by the user or model, points at a workflow, lists which agent profiles to dispatch. |
| **Agent** | `.agents/agents/*.md` | A subagent profile — `model:` + `allowed-tools:` + system prompt. Dispatched via `run_subagent`. |

Skills are not workflows — a skill never contains process steps beyond
"follow `workflows/X.md`". Workflows are not agents — they describe a
process, they don't have a model or tools. Agents are not skills — they
are dispatched, not invoked.

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

`planning-brain`, `spec-writer`, `plan-writer`, `task-writer`,
`workstream-analyst`, `implementer`, `reviewer`, `code-optimizer`, and
`test-agent` are custom profiles under `.agents/agents/`.
They are pinned to specific models via the `model:` field in their
profile so they don't all run on the expensive orchestrator model.

| Profile | Model | Role | Fires when |
|---------|-------|------|------------|
| `planning-brain` | `gpt-5.6-sol-medium` | Scope and architecture decisions | Twice during planning |
| `spec-writer` | `glm-5.2-high` | Write spec from decision brief | After spec framing |
| `plan-writer` | `glm-5.2-high` | Write plan from architecture brief | After plan framing |
| `task-writer` | `glm-5.2-high` | Write task MDs + JSONL build order from approved plan | After plan committed |
| `workstream-analyst` | `glm-5.2-high` | Read-only task research | Optional parallel task creation |
| `implementer` | `swe-2-high` | Write code + complete task-level tests | Task implementation |
| `reviewer` | `swe-1.7-medium` | Correctness, rule compliance, template compliance | After writer, all creation workflows |
| `code-optimizer` | `glm-5.2-high` | Code optimization (inefficiencies, OOM, concurrency) | After implementer, before reviewer |
| `test-agent` | `swe-1.7-medium` | Optional specialist for test-only repair | Explicitly requested or isolated test defects |

The top-level agent is a lightweight orchestrator. Planning decisions run in the
custom `planning-brain` profile pinned to `gpt-5.6-sol-medium`; writers and
reviewers use their own cheaper pins. Never rely on parent-model inheritance.

Do not use the built-in `subagent_general` profile for pipeline work —
it inherits the parent's model (which may be SOL/expensive). Always
use the custom profiles above, which are pinned to cheaper models.

During task creation, up to four pinned read-only `workstream-analyst` agents may
run in parallel. During implementation, up to three pinned `implementer` agents
may run in parallel only for ready tasks with disjoint write sets. Reviews,
commits, and manager-state mutations remain serial.

### Dispatch protocol — FOREGROUND, not background

All dispatched pipeline subagents must run as **foreground** subagents.

When you dispatch a subagent with `run_subagent`, you MUST set:
- `is_background: false` — the subagent blocks the orchestrator until it finishes
- `profile:` — the subagent profile name (e.g. `implementer`, `reviewer`)

Set `is_background: true` only for pinned read-only `workstream-analyst` agents or
for a wave of at most three pinned `implementer` agents with exclusive file/symbol
ownership. Collect every result before verification or state changes. All other
pipeline agents are foreground.

Background agents cannot request new permissions. If a required read is denied,
resume that analyst in the foreground or continue without its report. Custom
profiles are experimental in Devin, so `upgrade` keeps both supported project
locations synchronized.

Graph update may run in the background because it does not affect the pipeline.

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

When a task is code-heavy, the implementer, optional `test-agent`, optional
`code-optimizer`, and `reviewer` load language-specific skills based on manifests:

| Language | Detected by | test-agent | code-optimizer | reviewer |
|---|---|---|---|---|
| Go | `go.mod` | `golang-testing` | `golang-performance` | `go-code-review` |
| TypeScript | `package.json` | `typescript-unit-testing` | `typescript-code-review` | `typescript-security-review` |
| Python | `pyproject.toml`, `requirements.txt`, `setup.py` | `python-testing-patterns` | `python-code-style` | `python-code-style` |
| Rust | `Cargo.toml` | `rust-testing` | `rust-performance` | `rust-security` |

Each specialized agent loads its own column. The implementer loads the task's primary skill from the algorithm registry (not from this matrix). If a language skill is not installed, the subagent uses general knowledge and reports that the skill is missing.

## CLI commands

All skills use the installed `project-context` CLI:

```bash
# Generate a deterministic v5 UUID from an ID
project-context uuid SPEC-001

# Build a minimal context packet for a spec/plan/task (JSON output)
project-context context TASK-012 -t .

# Read project state and print specs/plans/tasks with status
project-context inspect -t .

# Refresh project overview from workflow markdown files
project-context overview -t .

# Build graph nodes and edges from source files
project-context graph -t .

# Scaffold a new .{reponame}-manager workspace
project-context init -t . --discover

# Add a spec/plan/task (creates MD file, appends to JSONL for tasks)
project-context add --type spec --title "<title>" --skills "<skills>" --triggers "<triggers>" -t .
project-context add --type plan --title "<title>" --parent "SPEC-001" --skills "<skills>" -t .
project-context add --type task --title "<title>" --parent "PLAN-001" --skills "<skills>" --triggers "<triggers>" -t .
project-context update TASK-001 --skills "<skills>" --triggers "<triggers>" -t .

# Select the next ready implementation wave (maximum three active tasks)
project-context ready --limit 3 -t .

# Update a spec/plan/task status (updates MD file, appends to JSONL for tasks)
project-context status TASK-001 done -t .

# Archive done/superseded records (moves MD to archive/, appends JSONL event)
project-context archive TASK-014 -t .
project-context archive --status done -t .
project-context inspect -t . --include-archived
```

## Context packets

Subagents must not receive conversation history. Instead, the
orchestrator builds a context packet and feeds it to the subagent:

```bash
project-context context TASK-012 -t . -o .context-packet.json
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
IMPLEMENT → /pc-implement workflow (implementer + tests → verify → focused reviewer)
  ↓
REVIEW → /pc-review workflow (mechanical → dispatch reviewer → apply → PR)
  ↓
ARCHIVE → /pc-archive (move done/superseded records to archive/, append JSONL event)
```

Planning and review remain gated and serial. Task analysis and implementation may
use only the bounded parallel waves defined by their workflows.

## Rules for all skills

1. **Read AGENTS.md first.** It has the project workflow protocol.
2. **Read this file first.** It has the shared instructions.
3. **JSONL is append-only task history.** Add events; never rewrite old events.
   Markdown specs, plans, and tasks are living documents and may be edited.
4. **Bounded parallel work.** Up to four pinned read-only analysts may fan out
   during task creation. Up to three pinned implementers may run for ready,
   non-overlapping tasks. Reviews and state mutations are serial.
5. **Background is explicit.** Only eligible analyst or implementer waves use
   `is_background: true`. Optional optimizer and reviewer stay foreground. Always
   collect all background results before proceeding.
6. **Generate UUIDs with the CLI.** Don't make up UUIDs. Use
   `project-context uuid <ID>`.
7. **Update state through the CLI.** Never edit JSONL files directly.
   Use `project-context add` to register records, `project-context update` to
   append metadata changes, and `project-context status` to update status.
8. **Skills cascade.** A task inherits skills from its plan and spec.
   Load all applicable skills before starting work.
9. **Maximum three implementation tasks.** Dependencies and disjoint ownership
   determine wave eligibility; JSONL event order breaks ties.
10. **Hard gates.** Stop and wait for the user after spec review and
    after plan review. Never auto-progress.
