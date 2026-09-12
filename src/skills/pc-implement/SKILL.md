---
name: pc-implement
description: "Implement up to three independent tasks in a bounded background wave, then verify and review the integrated diff"
argument-hint: "<TASK-NNN> [TASK-NNN ...]"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
  - run_subagent
  - read_subagent
  - skill
  - todo_write
permissions:
  allow:
    - Read(**)
    - Write(**)
    - Edit(**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(go **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and dispatch rules.

You are the orchestrator. Build a wave of at most three dependency-ready tasks
with disjoint declared write sets. Fall back to one task when ownership is unclear.

## What you do

Follow `workflows/pc-implement.md` exactly. In order:

1. Select at most three ready, non-overlapping tasks and build separate packets
2. Append their `in_progress` statuses serially
3. Dispatch one pinned `implementer` per task in the background; collect all results
4. Check file ownership and run integrated mechanical checks
5. Dispatch `code-optimizer` only for explicit or measured performance,
   memory, or concurrency risk
6. Dispatch one focused reviewer over the combined diff
7. Allow one correction wave, capped at three, for original blockers only
8. Commit once, append done statuses serially, rebuild the graph, and report

Background implementers share the working tree. Assign exclusive files/symbols,
do not edit while they run, and never let them commit or mutate manager state.
Review and state transitions remain serial. `SHOULD-FIX` does not block.
