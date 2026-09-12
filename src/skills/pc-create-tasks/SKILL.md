---
name: pc-create-tasks
description: "Run the task-writer workflow — dispatch task-writer subagent to write task MDs + JSONL build order, then dispatch reviewer"
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
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **task-writer workflow**. Read
`workflows/task-workflow.md` before starting and follow it exactly.

## What you are doing

You are the orchestrator. You dispatch the **task-writer** subagent
(`task-writer` profile, `glm-5.2-high` — a separate, cheaper agent) to
convert an approved spec and plan into task Markdown files plus JSONL
build-order records. Then you dispatch the reviewer to check the work.
You do not write the tasks yourself — the task-writer subagent does.

## Steps

1. **Build a context packet** for the plan:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
   ```

2. **Dispatch the task-writer** (foreground, `task-writer` profile,
   `is_background: false`). Give it:
   - The context packet path
   - The spec MD path
   - The plan MD path
   - `AGENTS.md` path
   - Instruction: read the spec and plan, consult `graph/nodes/` and
     `graph/edges/` for file placement, write `TASK-NNN.md` files using
     `templates/TASK-NNN.template.md`, register each task via the CLI in
     build order.

   The task-writer writes each task with: goal, files to touch,
   dependencies, skills + triggers (recorded for the implementer, not
   loaded), acceptance criteria, verification, do-not-touch. It
   registers tasks via `add --type task` in the order they must be
   built — the JSONL order IS the build order. Block on
   `read_subagent` to collect its report.

3. **Dispatch the reviewer** (foreground, `reviewer` profile, read-only,
   `is_background: false`). Give it the task file paths, the parent
   plan path, the spec path, `AGENTS.md`, and a 1-2 sentence context
   summary. It checks plan alignment, build order, file placement,
   technical accuracy, format consistency, rule compliance, internal
   consistency. Block on `read_subagent` to collect results. One pass —
   if MUST-FIX issues remain after one revision, escalate to the user.

4. **Revise.** If the reviewer reports MUST-FIX findings, re-dispatch
   the task-writer (foreground, `is_background: false`) with the
   findings. It fixes the task files and updates JSONL records via the
   CLI if needed.

5. **Report.** List the tasks created and their build order. Tell the
   user to run `/pc-implement TASK-NNN` to start implementation (one at
   a time).

## Constraints

- **No adhd.** Neither you nor the task-writer runs divergent ideation.
- **You do not write tasks.** The task-writer subagent writes them.
  You dispatch, collect results, and re-dispatch on reviewer findings.
- **No optimizer subagent.** The task-writer writes; the reviewer checks.
- **No skill loading.** The task-writer records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them. Skills
  are loaded by the implementer at implementation time.
- **Build order matters.** Tasks are registered in the order they must
  be built. The JSONL records are append-only — do not reorder past
  lines.
- **One task at a time during implementation.** The build order the
  task-writer writes determines the implementation sequence.
