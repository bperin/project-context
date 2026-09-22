---
name: pc-create-tasks
description: "Grill-me interrogates plan, planning-brain with ADHD writes tasks and JSONL. No separate reviewer."
argument-hint: "<PLAN-NNN>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
  - skill
  - run_subagent
  - read_subagent
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
dispatch the `planning-brain` agent profile (`.agents/agents/planning-brain.md`)
and collect its results.

## What you do

Follow `workflows/pc-create-tasks.md` exactly. In order:

1. **Load `grill-me` skill.** Interrogate the plan about workstreams,
   dependencies, and risks.
2. Build a context packet: `./tools/project-context context PLAN-NNN -t . -o .context-PLAN-NNN.json`
3. Dispatch `planning-brain` (foreground, write access to tasks/ + CLI) —
   it reads the spec + plan + grill-me findings, loads `adhd` for divergent
   ideation on task decomposition, **registers each task via
   `./tools/project-context add --type task` first** (creates the MD from
   template + JSONL record), **then edits the generated MD files** to
   fill in detailed content (goal, files, symbols, constraints,
   verification). Never `write` a TASK-NNN.md directly — the CLI `add`
   is the only thing that creates task files and JSONL records.
4. Commit task files + JSONL together
5. Report build order; tell the user to run `/pc-implement TASK-NNN`

The planning-brain runs in the foreground. No separate reviewer — grill-me
and ADHD serve as quality gates.
