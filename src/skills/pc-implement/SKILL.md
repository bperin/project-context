---
name: pc-implement
description: "Run the task-implementation workflow for a task — orchestrator dispatches implementer, code-optimizer, reviewer, test-agent sequentially"
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

You are the **orchestrator**. You do not write code yourself — you
dispatch agent profiles from `.agents/agents/` and collect their
results.

## What you do

Follow `workflows/task-implementation.md` exactly. In order:

1. Build a context packet: `project-context context TASK-NNN -t . -o .context-packet.json`
2. Dispatch `implementer` (foreground, write access)
3. Dispatch `code-optimizer` (foreground, read-only)
4. Dispatch `reviewer` (foreground, read-only)
5. Re-dispatch `implementer` on MUST-FIX findings
6. Dispatch `test-agent` (foreground, write access)
7. On test failure → `workflows/test-failure.md` (max 3 rounds)
8. Commit, then `project-context status TASK-NNN done -t .`
9. Rebuild the graph (`project-context graph -t .`) — may be dispatched
   as a background subagent
10. Report

All dispatches are foreground (`is_background: false`), sequential,
one at a time. Block on `read_subagent` to collect each result.
