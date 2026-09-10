---
name: create-task
description: "Run the task-creation workflow — write task from plan, task-optimizer + blind review, max 3 rounds"
argument-hint: "<TASK-NNN> from <PLAN-NNN>"
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
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **task-creation workflow** for this project. Read
`workflows/task-creation.md` before starting and follow it exactly.

## What you are doing

Creating a new task (TASK-NNN) from a committed plan using the
writer-task-optimizer-blind review pattern.

## Steps

1. **Generate a UUID** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid TASK-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation on the task approach.

3. **Read the parent plan** from the Plans sheet in `overview.xlsx`.
   The task must trace to a plan.

4. **Write the task** using `templates/TASK-NNN.template.md`. The task
   describes the specific unit of work — goal, files, acceptance
   criteria. Write to `tasks/TASK-NNN.md`.

5. **Build a context packet**:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

6. **Run review per `workflows/task-creation.md`:**
   - `task-optimizer` (medium, `glm-5.2-high`) — checks file paths, algorithm IDs, test vectors
   - `blind-reviewer` (cheap) — rules check, no context
   - Max 3 rounds, then escalate

7. **Register the task via the CLI.** Do not edit `overview.xlsx` directly:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --status committed --dependencies "<PLAN-NNN>" --skills "<skills>" --triggers "<triggers>" -t .
   ```

8. **Report.** Summarize the task goal, files to touch, and acceptance
   criteria.
