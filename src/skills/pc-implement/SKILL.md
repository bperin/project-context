---
name: pc-implement
description: "Implement one task with complete tests, verification, one focused review, and a bounded correction pass"
argument-hint: "<TASK-NNN>"
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

You are the **orchestrator**. Keep the normal path lean: one implementer,
mechanical verification, and one focused reviewer.

## What you do

Follow `workflows/pc-implement.md` exactly. In order:

1. Build a context packet: `project-context context TASK-NNN -t . -o .context-packet.json`
2. Dispatch `implementer` to write code and complete task-level tests
3. Run applicable mechanical checks
4. Dispatch `code-optimizer` only for explicit or measured performance,
   memory, or concurrency risk
5. Dispatch one focused `reviewer`
6. If blocked, re-dispatch the implementer once with the deduplicated findings
7. Re-run verification and confirm only the original blockers
8. Commit, mark the task done, rebuild the graph, and report

All pipeline dispatches are foreground and sequential. There is at most one
correction pass. `SHOULD-FIX` findings do not block completion.
