---
name: pc-archive
description: "Archive done/superseded specs, plans, and tasks — moves MD to archive/, appends JSONL event"
argument-hint: "[<ID> | --status <done|superseded>] [--force]"
triggers:
  - user
  - model
allowed-tools:
  - exec
permissions:
  allow:
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

Archive terminal records (`done` / `superseded`) out of the active
`specs/`, `plans/`, and `tasks/` directories into `archive/`. Keeps
active work focused on what's in flight. JSONL history is never
rewritten — an `archived` event is appended.

## Archive one record

```bash
project-context archive TASK-014 -t .
project-context archive PLAN-003 -t .
project-context archive SPEC-002 -t .
```

Refuses non-terminal status and parents with active children. Use
`--force` to override:

```bash
project-context archive PLAN-003 -t . --force
```

## Bulk archive all terminal records

Archives every active record with `done` or `superseded` status.
Children first (tasks → plans → specs):

```bash
project-context archive --status done -t .
project-context archive --status superseded -t .
```

## What moves

- `specs/SPEC-NNN.md` → `archive/specs/SPEC-NNN.md`
- `plans/PLAN-NNN.md` → `archive/plans/PLAN-NNN.md`
- `tasks/TASK-NNN.md` → `archive/tasks/TASK-NNN.md`
- `plans/PLAN-NNN.timeline.jsonl` → `archive/timelines/PLAN-NNN.timeline.jsonl`
  (only when the plan itself is archived)
- `archive/archive.jsonl` — append-only audit log (id, type, from, to, ts)

## What stays untouched

- `data/tasks.jsonl` is never rewritten. An `archived` event is appended.
- All historical `created` / `started` / `done` events remain in place.

## Inspecting archived records

`inspect` hides archived records by default:

```bash
project-context inspect -t .                       # active only
project-context inspect -t . --include-archived    # include archive/
```

`sync` skips archived records so they don't roll up into parent status.

Print the output. That's it — no analysis, no recommendations.
