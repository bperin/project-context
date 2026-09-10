---
name: approve-plan
description: "Approve a committed plan and start task-creation for each task"
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
  - skill
  - todo_write
permissions:
  allow:
    - Read(**)
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are approving a committed plan and starting task-creation.

## Steps

1. **Verify the plan exists and is committed.** Use `inspect` or read the xlsx. If it is not `committed`, stop and tell the user to run `/create-plan PLAN-NNN` first.

2. **Read the plan markdown** at `plans/PLAN-NNN.md` and collect the task IDs listed in the workstreams (e.g. `TASK-001`, `TASK-002`).

3. **Update the plan status via the CLI.** Do not edit `overview.xlsx` directly:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js status PLAN-NNN approved -t .
   ```

4. **Start each task-creation workflow.** For every task ID in the plan, invoke `/create-task <TASK-NNN> from <PLAN-NNN>`:
   ```
   skill invoke --skill create-task
   ```
   Then pass each `TASK-NNN from PLAN-NNN` as the argument.

   - If there is only one task, run it in the foreground.
   - If there are several, you may run them sequentially. Do not fan out into more than 3 at once.

5. **Report.** Confirm the plan is approved and which task workflows were started.
