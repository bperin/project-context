---
name: pc-create-tasks
description: "Build tasks from a plan using optional pinned parallel analysts, one serial task writer, then one reviewer"
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

Follow `workflows/pc-create-tasks.md` exactly. In order:

1. Build a context packet: `project-context context PLAN-NNN -t . -o .context-packet.json`
2. For multiple independent workstreams, optionally dispatch up to four pinned
   `workstream-analyst` agents in the background and collect every report
3. Dispatch `task-writer` (foreground, write access to tasks/ + CLI) —
   it reads the spec + plan, consults the graph, **registers each task
   via `project-context add --type task` first** (creates the MD from
   template + JSONL record), **then edits the generated MD files** to
   fill in detailed content (goal, files, symbols, constraints,
   verification). Never `write` a TASK-NNN.md directly — the CLI `add`
   is the only thing that creates task files and JSONL records.
4. Dispatch `reviewer` (foreground, read-only) — checks task files
   against the plan, templates, and rules
5. Re-dispatch `task-writer` with findings on MUST-FIX (one revision,
   then escalate)
6. Commit task files + JSONL together
6. Report build order; tell the user to run `/pc-implement TASK-NNN`

Only read-only workstream analysis may run in parallel/background. Every analyst
must use the pinned `workstream-analyst` profile. Collect all reports before the
single foreground task-writer mutates state; reviewer and revisions remain serial.
