#!/usr/bin/env bash
set -euo pipefail

# Interactive Project Context Protocol setup.
# Creates a .ai/ directory with the full context hierarchy in any project.
#
# Structure:
#   <project-root>/
#   ├── .ai/                        — project context (own git repo)
#   │   ├── context/
#   │   │   ├── identity/           — name, purpose, stack, repo
#   │   │   ├── architecture/       — domains, services, boundaries
#   │   │   ├── state/              — current execution state
#   │   │   ├── specs/              — SPEC-NNN.md
#   │   │   ├── plans/              — PLAN-NNN.md
#   │   │   ├── tasks/              — TASK-NNN.md
#   │   │   ├── decisions/          — ADR-NNN.md
#   │   │   ├── workflows/          — agent workflow definitions
#   │   │   ├── skills/             — project-level skill definitions
#   │   │   └── knowledge/          — semantic/historical (Qdrant backend)
#   │   ├── graph/                  — relationship schema
#   │   ├── adapters/               — IDE adapters (claude, cursor, etc.)
#   │   ├── .devin/agents/          — agent definitions
#   │   ├── AGENTS.md               — workflow protocol
#   │   └── templates/              — blank reusable templates
#   ├── <repo-1>/                   — code repository (sibling)
#   └── <repo-2>/                   — code repository (sibling)
#
# Hierarchy: SPEC-NNN → context/plans/PLAN-NNN.md → context/tasks/TASK-NNN.md
# Context: Identity → Architecture → State → Specs → Plans → Tasks
# Decisions (ADRs) constrain Specs. Workflows define how agents operate.
# Knowledge is the RAG fallback (Qdrant) for unknowns the graph can't resolve.

START_DIR="$PWD"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ask() {
  local prompt="$1" default="${2:-}" answer
  if [[ -n "$default" ]]; then
    read -r -p "$prompt [$default]: " answer
    printf '%s' "${answer:-$default}"
  else
    read -r -p "$prompt: " answer
    printf '%s' "$answer"
  fi
}

confirm() {
  local prompt="$1" default="${2:-y}" answer
  if [[ "$default" == "y" ]]; then
    read -r -p "$prompt [Y/n]: " answer
    answer="${answer:-y}"
  else
    read -r -p "$prompt [y/N]: " answer
    answer="${answer:-n}"
  fi
  [[ "$answer" =~ ^[Yy]$ ]]
}

echo
echo "=============================================="
echo " Devin Multi-Repository Project Setup"
echo "=============================================="
echo

# Prompt for the destination directory (Project Root)
PROJECT_ROOT="$(ask "Destination directory (Project Root)" "$PWD")"

# Expand ~ to $HOME
if [[ "$PROJECT_ROOT" =~ ^\~ ]]; then
  PROJECT_ROOT="${PROJECT_ROOT/#\~/$HOME}"
fi

# Ensure directory exists and switch to it
mkdir -p "$PROJECT_ROOT"
cd "$PROJECT_ROOT"
PROJECT_ROOT="$PWD"

AI=".ai"

echo "Project root: $PROJECT_ROOT"
echo "AI workspace:  $PROJECT_ROOT/$AI (own git repo, sibling to code repos)"
echo

if [[ -d "$AI" ]]; then
  echo "Existing $AI found."
  confirm "Keep it and only create missing files?" "y" || {
    echo "Aborted."
    exit 0
  }
fi

echo
echo "MODEL CONFIGURATION"
echo "All agents run on the same model. No model switching between roles."
echo

MODEL="$(ask "Model for all agents" "${MODEL:-glm-5.2-high}")"

echo
echo "HIGH-LEVEL SPEC"
echo "Your existing master SPEC should describe WHAT/WHY, not implementation tasks."
echo

SPEC_PATH="$(ask "Path to existing SPEC (blank if none)" "")"
if [[ -n "$SPEC_PATH" ]]; then
  SPEC_PATH="${SPEC_PATH/#\~/$HOME}"
  # If the file doesn't exist relative to the new PROJECT_ROOT, check START_DIR
  if [[ ! -f "$SPEC_PATH" && -f "$START_DIR/$SPEC_PATH" ]]; then
    SPEC_PATH="$START_DIR/$SPEC_PATH"
  fi
  [[ -f "$SPEC_PATH" ]] || { echo "SPEC not found: $SPEC_PATH"; exit 1; }
fi

echo
echo "REPOSITORIES"
echo "Repositories remain normal Git repos."
echo "The shared AI control plane lives in .ai/ as a sibling git repo."
echo

CANDIDATES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && CANDIDATES+=("$line")
done < <(
  find . -mindepth 1 -maxdepth 1 -type d     ! -name ".ai" ! -name ".git" -print | sort
)

REPOS=()
TYPES=()
DESCS=()

if [[ ${#CANDIDATES[@]} -gt 0 ]] && confirm "Configure the directories currently in this project?" "y"; then
  for d in "${CANDIDATES[@]}"; do
    repo="${d#./}"
    echo
    echo "Repository: $repo"
    type="$(ask "Role/type" "other")"
    desc="$(ask "Short description" "")"
    REPOS+=("$repo")
    TYPES+=("$type")
    DESCS+=("$desc")
  done
fi

while confirm "Add another repository?" "n"; do
  repo="$(ask "Repository path/name")"
  if [[ ! -d "$repo" ]]; then
    confirm "Create $repo?" "y" && mkdir -p "$repo" || continue
  fi
  type="$(ask "Role/type" "other")"
  desc="$(ask "Short description" "")"
  REPOS+=("$repo")
  TYPES+=("$type")
  DESCS+=("$desc")
done

# ------------------------------------------------------------
# Create directory structure
# ------------------------------------------------------------

mkdir -p "$AI/.devin/agents" \
  "$AI/context/identity" \
  "$AI/context/architecture" \
  "$AI/context/state" \
  "$AI/context/specs" \
  "$AI/context/plans" \
  "$AI/context/tasks" \
  "$AI/context/decisions" \
  "$AI/context/workflows" \
  "$AI/context/skills" \
  "$AI/context/knowledge" \
  "$AI/graph" \
  "$AI/adapters" \
  "$AI/templates"

# ============================================================
# AGENTS.md — workflow protocol
# ============================================================

cat > "$AI/AGENTS.md" <<'EOF'
# Project AI Development Protocol

This is a multi-repository project. This repository (`.ai/`) is the
durable AI control plane and is intentionally separate from individual Git
repositories. Code repos live as siblings (e.g. `../<repo-name>/`).

## Agent Configuration

All agents are defined in `.devin/agents/`.

Agent files:
- `.devin/agents/architect.md` — primary orchestrator (mode: primary)
- `.devin/agents/implementer.md` — bounded task implementation (mode: subagent)
- `.devin/agents/spec-researcher.md` — focused research, read-only (mode: subagent)
- `.devin/agents/fast-worker.md` — small mechanical tasks (mode: subagent)
- `.devin/agents/debugger.md` — debugging and second opinions (mode: subagent)
- `.devin/agents/checker.md` — independent read-only review (mode: subagent)

## Workflow Flow

```
SPEC → ARCHITECT → PLAN → TASK → IMPLEMENT → CHECK → DONE
```

1. **SPEC** (`specs/SPEC-NNN.md`) — what/why, written first
2. **ARCHITECT** reads SPEC + inspects repos → creates PLAN, DECISIONS, tasks
3. **PLAN** (`plans/PLAN-NNN.md`) — technical architecture/how
4. **TASK** (`tasks/TASK-NNN.md`) — bounded executable work item with exact info a worker needs
5. **IMPLEMENT** — implementer or fast-worker executes one TASK-NNN
6. **CHECK** — checker independently validates acceptance criteria
7. **DONE** — architect marks task complete, updates STATE.md

State transitions: `todo → in_progress → review → done`
Blocked: `in_progress → blocked`
Failed review: `review → in_progress`

## Durable source of truth

- `specs/` — high-level specifications (numbered: SPEC-NNN.md)
- `plans/` — numbered technical plans (one per SPEC: PLAN-NNN.md)
- `tasks/` — individual task files (one per TASK-NNN)
- `STATE.md` — current execution state
- `DECISIONS.md` — durable architectural decisions
- `templates/` — blank reusable templates for SPEC, PLAN, and TASK files

Conversation history is not durable project memory.

## Templates

Blank templates live in `templates/`, in hierarchy order:

1. `SPEC-NNN.template.md` — what/why (parent of a PLAN)
2. `PLAN-NNN.template.md` — how (parent of TASKs)
3. `TASK-NNN.template.md` — bounded work item (child of a PLAN, or standalone)

### Hierarchy

```
SPEC-NNN → plans/PLAN-NNN.md → tasks/TASK-NNN.md
                          tasks/TASK-NNN.md
                          tasks/TASK-NNN.md
```

- A SPEC may have one PLAN or none (purely descriptive).
- A PLAN lists its tasks under Workstreams and links them under Linked Tasks.
- A TASK belongs to a PLAN (linked in its Parent section) or is standalone (one-off, no plan needed).

### When the Architect starts a new SPEC:
1. Copy `SPEC-NNN.template.md` → `specs/SPEC-NNN.md`.
2. Copy `PLAN-NNN.template.md` → `plans/PLAN-NNN.md`.

### When the Architect creates a new task:
1. Copy `TASK-NNN.template.md` → `tasks/TASK-NNN.md`.
2. Replace `NNN` with the actual monotonically increasing task ID.
3. Set Parent to the plan it belongs to, or mark it standalone.
4. Fill every section. Do not leave placeholder text in the active instance.

Templates are never filled in place. Always copy to the active location first.

## Superseding

Over time, features are added and removed. Reading a project from the
beginning may not make sense. When a SPEC, PLAN, or TASK replaces an
earlier one, it MUST explicitly call out:

- **Supersedes**: which earlier document it replaces
- **Reason**: why the old document is no longer accurate
- **Superseded by**: filled in on the OLD document when a newer one replaces it

Never silently replace a document. Always link the replacement and explain why.

## Commit logging

Every commit related to a task is logged in that task's Commit Log table.
Workers append a row after each commit. Do not delete prior entries.
Fix commits are marked with "fix" in the Type column.

| Commit | Date | Type | Message |
|---|---|---|---|
| <hash> | <date> | fix/feat/chore | <message> |

## SPEC vs PLAN

The SPEC describes:
- what we are building
- why
- desired behavior
- requirements
- scope
- constraints
- success criteria

The Architect determines:
- how the existing system should implement it
- architecture
- technical decisions
- repository boundaries
- dependencies
- implementation tasks

Do not turn the SPEC into an implementation plan.

## Multi-repository work

A task may involve multiple repositories. Every task identifies:
- repositories
- relevant files
- relevant symbols
- dependencies
- acceptance criteria

Do not assume every repository is relevant.

## Context discipline

Never read the entire project merely to understand it.

Start with:
1. project state
2. current SPEC
3. current PLAN
4. task
5. listed repositories/files

Expand only when evidence requires it.

## Architecture defaults

Backend:
- preserve existing package boundaries
- prefer simple explicit designs
- use ports/adapters where they provide real value
- avoid unnecessary abstractions

Frontend:
- preserve the existing framework
- do not migrate unless explicitly required

Infrastructure and transport:
- infrastructure is part of the system architecture
- do not assume communication is HTTP
- HTTP, WebSocket, gRPC, bidi streams, queues, Pub/Sub, workers, and
  event-driven transports are all valid depending on the existing system

## Task IDs

Use monotonically increasing IDs:
TASK-001, TASK-002, TASK-003

Never reuse or renumber IDs.

## Lifecycle

todo → in_progress → review → done

Blocked:
in_progress → blocked

Failed review:
review → in_progress

## Roles

Architect:
- architecture
- decomposition
- hard reasoning
- cross-repository decisions

Researcher:
- focused repository discovery
- documentation
- technical investigation

Implementer:
- normal implementation

Fast Worker:
- small/mechanical work

Debugger:
- failures
- difficult debugging
- second opinions

Checker:
- independent validation

## General rule

The Architect owns WHAT and HOW the system should be built.

Workers execute bounded tasks.

Workers must not silently redesign architecture.
EOF

# ============================================================
# Agent definitions
# ============================================================

# ------------------------------------------------------------
# Architect
# ------------------------------------------------------------

cat > "$AI/.devin/agents/architect.md" <<EOF
---
description: Senior cross-repository architect and orchestrator. Converts high-level specifications into durable architecture, plans, and executable tasks.
mode: primary
model: $MODEL
steps: 45
permission:
  read: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
  task: allow
  todoread: allow
  todowrite: allow
---

You are the senior architect and orchestrator for this multi-repository project.

Read first:
- AGENTS.md
- plans/ (current and archived plans)
- STATE.md
- DECISIONS.md
- current SPEC in specs/
- existing task files in tasks/

Templates live in templates/:
- SPEC-NNN.template.md — copy to specs/SPEC-NNN.md when starting a new spec
- PLAN-NNN.template.md — copy to plans/PLAN-NNN.md when starting a new SPEC
- TASK-NNN.template.md — copy to tasks/TASK-NNN.md for each new task

Never fill a template in place. Always copy to the active location first.

The SPEC is high-level intent. Do not rewrite it as an implementation plan.

Your job:
1. Understand the SPEC (or create one from SPEC-NNN.template.md if starting fresh).
2. Inspect the actual repositories.
3. Research only what is necessary.
4. Resolve technical unknowns.
5. Make architectural decisions.
6. Create/update plans/PLAN-NNN.md (from PLAN-NNN.template.md).
7. Create bounded tasks/TASK-NNN.md files (from TASK-NNN.template.md).
8. Delegate implementation.

Do not read every repository by default.

When you need repository investigation, delegate focused questions to
spec-researcher rather than dumping an entire codebase into context.

## Multi-repository design

Understand:
- repository responsibilities
- service boundaries
- data ownership
- dependency direction
- communication topology
- runtime/deployment relationships

Do not assume HTTP. Consider HTTP, WebSocket, gRPC, bidi streams, queues,
Pub/Sub, workers, and event-driven communication as appropriate.

## Task format

Every task contains:
- Parent (plan or standalone)
- Supersedes (if replacing an earlier task)
- Status
- Owner
- Model class
- Repositories
- Dependencies
- Goal
- Relevant files
- Relevant symbols
- Existing behavior
- Required change
- Constraints
- Acceptance criteria
- Verification
- Do-not-touch
- Commit Log

Find the highest existing TASK-NNN and create the next ID.

## Superseding

When a new SPEC, PLAN, or TASK replaces an earlier one:
1. Fill the Supersedes section with the old document's ID and a reason.
2. Update the OLD document's Superseded by field to point to the new one.
3. Never silently replace — always link and explain.

## Commit logging

Workers log every commit in the task's Commit Log table. The Architect
verifies commit logs are maintained during review.

## Models

All agents: $MODEL

Every role runs on the same model. No model switching between roles.

## Delegation

spec-researcher:
- focused investigation
- repository discovery
- technical questions

implementer:
- normal implementation

fast-worker:
- simple/mechanical tasks

debugger:
- failures
- difficult debugging
- second opinions

checker:
- independent review

## State

todo → in_progress
in_progress → review
review → done
review → in_progress after REWORK

Keep STATE.md accurate.

A future Architect instance must be able to continue from the files without
conversation history.
EOF

# ------------------------------------------------------------
# Researcher
# ------------------------------------------------------------

cat > "$AI/.devin/agents/spec-researcher.md" <<EOF
---
description: Fast focused research agent for repository discovery and technical questions. Does not implement.
mode: subagent
model: $MODEL
steps: 20
permission:
  read: allow
  glob: allow
  grep: allow
  websearch: allow
  webfetch: allow
  bash: deny
  edit: deny
  task: deny
---

You are a focused research agent.

Answer a specific question for the Architect.

Do NOT read the entire project. Do NOT recursively inspect every repository.

Find:
- relevant repository
- relevant files
- relevant symbols
- callers
- interfaces
- dependencies
- tests
- configuration
- protocol behavior
- constraints

Return:
### Answer
### Evidence
### Relevant Files
### Existing Behavior
### Constraints
### Risks
### Unknowns
### Recommendation

Clearly distinguish facts from inference.

Do not modify source code.
EOF

# ------------------------------------------------------------
# Implementer
# ------------------------------------------------------------

cat > "$AI/.devin/agents/implementer.md" <<EOF
---
description: Primary implementation engineer for bounded cross-repository tasks.
mode: subagent
model: $MODEL
steps: 40
permission:
  read: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
  task: deny
---

You receive exactly one TASK-NNN.

Read:
- AGENTS.md
- STATE.md
- relevant plan in plans/
- tasks/TASK-NNN.md
- AGENTS.md files in affected repositories

Then inspect the listed files/symbols.

Do NOT read the entire repository.
Do NOT inspect unrelated repositories.

Follow the task, architecture, decisions, repository conventions, and
acceptance criteria.

If the task is architecturally wrong or incomplete, stop and report it
instead of silently redesigning it.

Run appropriate tests/builds/formatters/linters.

Inspect git diff in every affected repository.

Log every commit in the task's Commit Log table:
| Commit | Date | Type | Message |
Append a row after each commit. Do not delete prior entries.
Mark fix commits with "fix" in the Type column.

Report:
- repositories changed
- files changed
- implementation
- tests
- failures
- concerns
- commits logged

Move task to review. Never mark it done.
EOF

# ------------------------------------------------------------
# Fast worker
# ------------------------------------------------------------

cat > "$AI/.devin/agents/fast-worker.md" <<EOF
---
description: Ultra-fast worker for small, mechanical, tightly scoped tasks.
mode: subagent
model: $MODEL
steps: 20
permission:
  read: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
  task: deny
---

You are an ultra-fast implementation worker.

Good tasks:
- small edits
- boilerplate
- straightforward tests
- simple configuration
- mechanical refactors
- localized fixes
- repetitive implementation

Do NOT:
- redesign architecture
- explore the entire repository
- make cross-repository design decisions
- expand task scope

Start with the exact files in TASK-NNN.

If substantial reasoning or broad investigation is required, escalate to the
Implementer or Architect.

Log every commit in the task's Commit Log table.

Run relevant tests. Move task to review. Never mark it done.
EOF

# ------------------------------------------------------------
# Debugger
# ------------------------------------------------------------

cat > "$AI/.devin/agents/debugger.md" <<EOF
---
description: Debugging and independent second-opinion agent.
mode: subagent
model: $MODEL
steps: 35
permission:
  read: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
  task: deny
---

You are the debugging and independent reasoning specialist.

Start from the actual failure or question.

Read:
- TASK-NNN
- relevant plan in plans/
- changed files
- test output
- git diff

Do NOT read every repository.

For debugging:
1. inspect/reproduce the failure
2. determine root cause
3. make the smallest correct fix if authorized
4. run relevant tests
5. log fix commits in the task's Commit Log table

For second opinions:
- identify assumptions
- challenge the proposed design
- identify failure modes
- distinguish facts from speculation

Do not silently redesign architecture.

Report:
- root cause or critique
- repositories/files changed
- fix/recommendation
- tests
- remaining concerns

Move fixed tasks back to review. Never mark done.
EOF

# ------------------------------------------------------------
# Checker
# ------------------------------------------------------------

cat > "$AI/.devin/agents/checker.md" <<EOF
---
description: Independent read-only checker for acceptance, regressions, and cross-repository compatibility.
mode: subagent
model: $MODEL
steps: 30
permission:
  read: allow
  glob: allow
  grep: allow
  bash: allow
  edit: deny
  task: deny
---

You are an independent implementation checker.

You MUST NOT modify source files.

For TASK-NNN:
1. Read the task.
2. Read its task file (tasks/TASK-NNN.md).
3. Read relevant plan in plans/ and DECISIONS.
4. Read repository AGENTS.md files.
5. Inspect implementation.
6. Inspect diffs in every affected repository.
7. Run appropriate tests.
8. Check every acceptance criterion.
9. Check cross-repository contracts.
10. Check for regressions and scope creep.
11. Verify the Commit Log table is maintained with all relevant commits.

Return exactly:
PASS

or:
REWORK

For REWORK, list concrete failures and the smallest correction required.

Do not approve merely because tests pass.
Do not reject based on stylistic preferences.
EOF

# ============================================================
# Templates
# ============================================================

# ------------------------------------------------------------
# SPEC template
# ------------------------------------------------------------

cat > "$AI/templates/SPEC-NNN.template.md" <<'EOF'
# SPEC-NNN: <short title>

<!-- Template hierarchy: SPEC-NNN → plans/PLAN-NNN.md → tasks/TASK-NNN.md -->
<!-- Copy to specs/SPEC-NNN.md. Replace NNN with the real ID. -->
<!-- The SPEC describes WHAT and WHY. The Architect determines HOW in plans/PLAN-NNN.md. -->
<!-- Do not turn this into an implementation plan. -->

## Supersedes

<!-- If this spec replaces an earlier one, list it here with a reason. -->
<!-- Delete this section if this is the first spec for this feature area. -->
<!-- When a newer spec supersedes THIS one, add "Superseded by: SPEC-NNN" below. -->

- Supersedes: <!-- SPEC-NNN, or "none" -->
- Reason: <!-- why the old spec is no longer accurate — features removed, scope changed, etc. -->
- Superseded by: <!-- filled in when a newer spec replaces this one, or "none" -->

## What

<!-- One paragraph: what the system does at a high level. -->
<!-- Describe the end state, not the implementation path. -->

## Why

<!-- Bullet points explaining the motivation. -->
<!-- What problem does this solve? What pain does it remove? -->

- 

## Desired Behavior

<!-- Observable behavior from the user's perspective, grouped by feature area. -->
<!-- This is what a user manual would say — not what a code doc would say. -->

### <Feature Area 1>
1. 
2. 

### <Feature Area 2>
1. 
2. 

## Scope

### In Scope
- 

### Out of Scope
- 

## Constraints

<!-- Hard, non-negotiable invariants the implementation must respect. -->

- 

## Success Criteria

<!-- Observable, testable conditions. Each verifiable by command or action. -->

1. 
2. 

## Linked Plan

<!-- The Architect creates plans/PLAN-NNN.md from this SPEC. -->
<!-- A SPEC may have one plan or none (if it's purely descriptive). -->

- Plan: `plans/PLAN-NNN.md` (created by Architect)
- Tasks: listed in the plan under Workstreams
EOF

# ------------------------------------------------------------
# PLAN template
# ------------------------------------------------------------

cat > "$AI/templates/PLAN-NNN.template.md" <<'EOF'
# PLAN-NNN: <short title>

<!-- Template hierarchy: SPEC-NNN → plans/PLAN-NNN.md → tasks/TASK-NNN.md -->
<!-- Copy to plans/PLAN-NNN.md. Replace NNN with the real ID. -->
<!-- The PLAN describes HOW the system is built — architecture, not what/why. -->
<!-- The SPEC (in specs/SPEC-NNN.md) describes what/why. Do not duplicate it here. -->

## Supersedes

<!-- If this plan replaces an earlier one, list it here with a reason. -->
<!-- Delete this section if this is the first plan for this SPEC. -->
<!-- When a newer plan supersedes THIS one, add "Superseded by: PLAN-NNN" below. -->

- Supersedes: <!-- PLAN-NNN, or "none" -->
- Reason: <!-- why the old plan is no longer accurate — architecture changed, features removed, etc. -->
- Superseded by: <!-- filled in when a newer plan replaces this one, or "none" -->

## Source Specification

<!-- Which SPEC this plan implements. -->

SPEC-NNN — <short title> (`specs/SPEC-NNN.md`)

## Objective

<!-- One-paragraph summary of what this plan achieves. -->

## System Map

<!-- ASCII diagram of the major components and their relationships. -->
<!-- Show every process boundary, transport, and data flow. -->

```
┌─────────────────────────────────────┐
│  <Component A>                      │
│  - <responsibility>                 │
└──────────┬──────────────────────────┘
           │  <transport>
     ┌─────▼──────────────────────────┐
     │  <Component B>                  │
     │  - <responsibility>             │
     └────────────────────────────────┘
```

## Repositories

<!-- List every repository involved and its role. -->
<!-- Not every repository in the project is necessarily relevant. -->

| Path | Role | Description |
|---|---|---|
| `<repo>/` | | |

## Architecture

### New package: `<name>/`

```
<package>/
├── __init__.py
├── <module>.py          # <one-line responsibility>
└── ...
```

### Key design decisions

<!-- Numbered list of architectural decisions. -->
<!-- Record durable decisions in DECISIONS.md as ADR-NNN. -->

1. **<decision>** — <rationale>
2. **<decision>** — <rationale>

## Communication Topology

<!-- Every inter-component communication path and its transport. -->
<!-- Do not assume HTTP. Consider WebSocket, gRPC, SSE, queues, Pub/Sub, etc. -->

| Path | Transport | Purpose |
|---|---|---|
| <A → B> | | |

## Data / Ownership

<!-- Who owns each piece of data. Where it's stored. Ephemeral vs durable. -->

- **<data category>**: <owner / location>

## Workstreams

<!-- Group tasks into workstreams by concern. -->
<!-- Task IDs are monotonically increasing across all files in tasks/. -->
<!-- Each task here links to its task file in tasks/TASK-NNN.md. -->

| ID | Workstream | Tasks |
|---|---|---|
| W1 | | TASK-NNN |

## Dependencies

### External packages (to add)
<!-- Third-party packages that must be added as dependencies. -->

### Existing code dependencies (read-only, not modified)
<!-- Existing modules/functions that new code depends on but must not modify. -->

## Constraints

<!-- Hard constraints the implementation must respect. Non-negotiable. -->

- 

## Current Focus

<!-- The single task that should be executed next, with a one-line rationale. -->

**TASK-NNN: <title>** — <why this is next>

## Completion Criteria

<!-- Observable, testable conditions that mean the plan is fully delivered. -->

1. 
2. 

## Linked Tasks

<!-- Every task file created from this plan. -->
<!-- The Architect copies TASK-NNN.template.md → tasks/TASK-NNN.md for each. -->

- `tasks/TASK-NNN.md` — <one-line summary>
EOF

# ------------------------------------------------------------
# TASK template
# ------------------------------------------------------------

cat > "$AI/templates/TASK-NNN.template.md" <<'EOF'
# TASK-NNN — <short title>

<!-- Template hierarchy: SPEC-NNN → plans/PLAN-NNN.md → tasks/TASK-NNN.md -->
<!-- Copy to tasks/TASK-NNN.md for each new task. -->
<!-- Replace NNN with the actual monotonically increasing task ID. -->
<!-- A task may belong to a PLAN or be a standalone one-off (no plan needed). -->
<!-- This file contains EXACTLY the information a worker needs — nothing more. -->
<!-- Do not paste entire source files. Reference files and symbols by path/name. -->

## Parent

<!-- Link to the plan this task belongs to, or "standalone" if it's a one-off. -->

- Plan: `plans/PLAN-NNN.md` (or **standalone** — no plan, this is a one-off task)
- SPEC: `specs/SPEC-NNN.md` (if applicable)

## Supersedes

<!-- If this task replaces an earlier one, list it here with a reason. -->
<!-- Delete this section if this is a new task, not a replacement. -->
<!-- When a newer task supersedes THIS one, add "Superseded by: TASK-NNN" below. -->

- Supersedes: <!-- TASK-NNN, or "none" -->
- Reason: <!-- why the old task is no longer valid — scope changed, approach abandoned, etc. -->
- Superseded by: <!-- filled in when a newer task replaces this one, or "none" -->

## Status

<!-- Lifecycle: todo → in_progress → review → done -->
<!-- Blocked: in_progress → blocked. Failed review: review → in_progress -->

- **Status**: todo
- **Owner**: unassigned
- **Model class**: <!-- implementer | fast-worker | debugger -->
- **Dependencies**: <!-- TASK-NNN, or "none" -->

## Goal

<!-- One sentence — what success looks like. -->

## Repositories

<!-- Only repositories the worker will touch or read. Not every repository. -->

- `<repo-path>`

## Relevant Files

### To create
<!-- New files the worker must create. -->

- `<path>` — <one-line purpose>

### To modify
<!-- Existing files the worker must change. -->

- `<path>` — <what changes>

## Relevant Symbols

### Existing (read-only reference)
<!-- Functions/classes/types the worker must understand but not modify. -->

- `<file>` → `<symbol>` (<type>)

### To create
<!-- New functions/classes/types the worker must implement. Include signatures. -->

- `<module>.<function>(<args>) -> <return>`
- `<module>.<Class>`:
  - `<field>: <type>`

## Existing Behavior

<!-- How the relevant existing code works today. -->
<!-- Only the parts the worker needs to know to make correct changes. -->

- 

## Required Change

<!-- Numbered, concrete steps. Each unambiguous and independently verifiable. -->

1. **`<file>`**: <what to do>
2. **`<file>`**: <what to do>

## Constraints

<!-- Hard constraints for this task only. Project-wide constraints live in AGENTS.md. -->

- 

## Acceptance Criteria

<!-- Observable, testable conditions. The checker validates these. -->

1. 
2. 

## Verification

<!-- Exact test command to run. -->

```
<test command>
```

## Do-Not-Touch

<!-- Files/modules the worker must not modify under any circumstance. -->

- 

## Commit Log

<!-- Every commit related to this task is logged here. -->
<!-- Workers append a row after each commit. Do not delete prior entries. -->
<!-- Include fix commits — mark them with "fix" in the Type column. -->

| Commit | Date | Type | Message |
|---|---|---|---|
| | | | |
EOF

# ============================================================
# Identity, Architecture, ADR, Workflow, Skill templates
# ============================================================

cat > "$AI/templates/identity.template.md" <<'EOF'
# Project Identity

## Name

<!-- One word or short phrase. -->

## Purpose

<!-- One paragraph: what problem this project solves. -->

## Stack

<!-- Languages, frameworks, databases, cloud providers. One per line. -->

- 

## Repositories

| Path | Role | Stack |
|------|------|-------|
| `.` | | |

## Links

- 
EOF

cat > "$AI/templates/architecture.template.md" <<'EOF'
# Architecture

## Domains

| Domain | Path | Responsibility |
|--------|------|---------------|
| | | |

## Services

| Service | Path | Transport | Deploys to |
|---------|------|-----------|------------|
| | | | |

## Boundaries

| From | To | Transport | Purpose |
|------|----|-----------|---------|
| | | | |

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| | | |

## Data Ownership

| Data | Owner | Store | Ephemeral? |
|------|-------|-------|------------|
| | | | |
EOF

cat > "$AI/templates/ADR-NNN.template.md" <<'EOF'
# ADR-NNN: <title>

## Status

accepted

## Supersedes

- Supersedes: <!-- ADR-NNN, or "none" -->
- Superseded by: <!-- filled in when superseded, or "none" -->

## Context

<!-- What problem or situation forced this decision? -->

## Decision

<!-- What was decided. One paragraph. -->

## Consequences

- 

## Alternatives Considered

- **<alternative>** — <why not>
EOF

cat > "$AI/templates/workflow.template.md" <<'EOF'
# Workflow: <name>

## When

<!-- When does this workflow apply? -->

## Steps

1. 
2. 
3. 

## Inputs

- 

## Outputs

- 

## Constraints

- 
EOF

cat > "$AI/templates/skill.template.md" <<'EOF'
# Skill: <name>

## Capability

<!-- One sentence: what this skill enables. -->

## When to Invoke

- 

## What It Does

1. 
2. 

## Dependencies

- 

## Outputs

- 
EOF

# ============================================================
# Import existing SPEC
# ============================================================

if [[ -n "$SPEC_PATH" ]]; then
  if [[ -f "$AI/context/specs/SPEC-001.md" ]]; then
    echo
    echo "Existing specs/SPEC-001.md found."
    if confirm "Replace it with the supplied SPEC?" "n"; then
      cp "$SPEC_PATH" "$AI/context/specs/SPEC-001.md"
    fi
  else
    cp "$SPEC_PATH" "$AI/context/specs/SPEC-001.md"
  fi
fi

# ============================================================
# Durable project files
# ============================================================

# ------------------------------------------------------------
# STATE.md
# ------------------------------------------------------------

if [[ ! -f "$AI/context/state/STATE.md" ]]; then
cat > "$AI/context/state/STATE.md" <<'EOF'
# Current Project State

## Active Specification

None

## Objective

None

## Active Task

None

## In Progress

None

## Review

None

## Blocked

None

## Recently Completed

None

## Current Architecture

None documented yet.

## Next Action

Ask the Architect to inspect the SPEC and repositories.

## Important Context

None.
EOF
fi

# ------------------------------------------------------------
# DECISIONS.md
# ------------------------------------------------------------

if [[ ! -f "$AI/context/decisions/DECISIONS.md" ]]; then
cat > "$AI/context/decisions/DECISIONS.md" <<'EOF'
# Architectural Decisions

Durable cross-repository architectural decisions.

## ADR-001 — Project-Level AI Control Plane

- Status: accepted

### Context

The project contains multiple independent repositories.

### Decision

Keep specifications, plans, tasks, state, decisions, and bounded task context
in the `.ai/` repository rather than inside an individual repository.

### Consequences

- All agents share one task graph.
- Repositories remain independently versioned.
- Model conversations are not required for continuity.
- Cross-repository work has one durable source of truth.
EOF
fi

# ============================================================
# Write repository map into PLAN-001 if a SPEC was provided
# ============================================================

if [[ -n "$SPEC_PATH" ]] && [[ ! -f "$AI/context/plans/PLAN-001.md" ]]; then
{
  echo "# PLAN-001: <fill from SPEC>"
  echo ""
  echo "## Supersedes"
  echo ""
  echo "- Supersedes: none"
  echo "- Reason: N/A — first plan for this project"
  echo "- Superseded by: none"
  echo ""
  echo "## Source Specification"
  echo ""
  echo "SPEC-001 (`specs/SPEC-001.md`)"
  echo ""
  echo "## Initial Repository Map"
  echo ""
  if [[ ${#REPOS[@]} -eq 0 ]]; then
    echo "No repositories configured yet."
  else
    echo "| Repository | Role | Description |"
    echo "|---|---|---|"
    for i in "${!REPOS[@]}"; do
      desc="${DESCS[$i]//|/\|}"
      echo "| \`${REPOS[$i]}\` | ${TYPES[$i]} | $desc |"
    done
  fi
} > "$AI/context/plans/PLAN-001.md"
fi

# ============================================================
# Optional local AGENTS.md for each repo
# ============================================================

echo
if [[ ${#REPOS[@]} -gt 0 ]] && confirm "Create/update minimal repo-local AGENTS.md files?" "n"; then
  for i in "${!REPOS[@]}"; do
    repo="${REPOS[$i]}"
    file="$repo/AGENTS.md"

    if [[ -f "$file" ]]; then
      echo "Keeping existing $file"
      continue
    fi

    cat > "$file" <<EOF
# Repository Instructions

This repository is part of the parent multi-repository project.

Read the parent project's \`../.ai/AGENTS.md\` when working on
cross-repository tasks.

Repository role:
${TYPES[$i]}

Description:
${DESCS[$i]}

Follow existing conventions in this repository.

Do not make cross-repository architectural changes without updating the
project-level plan and decisions.
EOF

    echo "Created $file"
  done
fi

# ============================================================
# Summary
# ============================================================

echo
echo "=============================================="
echo " SETUP COMPLETE"
echo "=============================================="
echo
echo "Project:"
echo "  $PWD"
echo
echo "Shared AI workspace:"
echo "  $PWD/$AI"
echo
echo "Structure:"
echo "  $AI/AGENTS.md          — workflow protocol"
echo "  $AI/context/state/STATE.md           — current execution state"
echo "  $AI/context/decisions/DECISIONS.md       — architectural decisions"
echo "  $AI/context/specs/             — specifications (SPEC-NNN.md)"
echo "  $AI/context/plans/             — technical plans (PLAN-NNN.md)"
echo "  $AI/context/tasks/             — task files (TASK-NNN.md)"
echo "  $AI/templates/         — blank templates"
echo "  $AI/.devin/agents/     — agent definitions"
echo
echo "Model: $MODEL (all agents)"
echo
echo "SPEC:"
if [[ -f "$AI/context/specs/SPEC-001.md" ]]; then
  echo "  $PWD/$AI/context/specs/SPEC-001.md"
else
  echo "  none"
fi
echo
echo "Repositories:"
if [[ ${#REPOS[@]} -eq 0 ]]; then
  echo "  none configured"
else
  for i in "${!REPOS[@]}"; do
    echo "  ${REPOS[$i]} — ${TYPES[$i]}"
  done
fi
echo
echo "IMPORTANT:"
echo "The $AI/ directory is its own git repo — the project context."
echo "Code repos are siblings: $PWD/<repo-name>/"
echo "Agents reference code repos via ../<repo-name>/"
echo
echo "Context hierarchy:"
echo "  Identity → Architecture → State → Specs → Plans → Tasks"
echo "  Decisions (ADRs) constrain Specs."
echo "  Workflows define how agents operate."
echo "  Knowledge is the RAG fallback (Qdrant) for graph unknowns."
echo
echo "Hierarchy: SPEC-NNN → context/plans/PLAN-NNN.md → context/tasks/TASK-NNN.md"
echo "Tasks can be standalone (one-off, no plan needed)."
echo "Specs, plans, and tasks track superseding explicitly."
echo "Tasks log every commit in a Commit Log table."
echo
echo "FIRST ARCHITECT PROMPT:"
echo
echo '  "Read ../.ai/AGENTS.md and the current SPEC.'
echo '   Research the repositories as needed.'
echo '   Do not implement anything.'
echo '   Create the technical PLAN, resolve architectural unknowns,'
echo '   and decompose the work into durable TASK-NNN entries."'
echo
