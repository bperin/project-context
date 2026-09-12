---
name: pc-create-tasks
description: "Run the task workflow for a plan — orchestrator dispatches the task-writer subagent, then the reviewer"
argument-hint: "<PLAN-NNN>"
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
    - Write(tasks/**)
    - Edit(tasks/**)
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and dispatch rules.

You are the **orchestrator**. You do not write tasks yourself — you
dispatch the `task-writer` agent profile (`.agents/agents/task-writer.md`,
a cheaper model) and collect its results.

## What you do

Follow `workflows/task-workflow.md` exactly. In order:

1. Build a context packet: `project-context context PLAN-NNN -t . -o .context-packet.json`
2. Dispatch `task-writer` (foreground, write access to tasks/ + CLI) —
   it reads the spec + plan, consults the graph, writes `TASK-NNN.md`
   files, and registers each task via `project-context add --type task`
   in build order
3. Dispatch `reviewer` (foreground, read-only) — checks task files
   against the plan, templates, and rules
4. Re-dispatch `task-writer` with findings on MUST-FIX (one revision,
   then escalate)
5. Commit task files + JSONL together
6. Report build order; tell the user to run `/pc-implement TASK-NNN`

All dispatches are foreground (`is_background: false`), sequential.
Block on `read_subagent` to collect each result.
