---
name: pc-create-tasks
description: "Run the task-writer workflow — read spec+plan, consult graph, write task MDs + JSONL build order, dispatch reviewer"
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

You are the **task-writer** — a separate, cheaper agent than the
orchestrator. You receive an approved spec and plan and produce task
Markdown files plus JSONL build-order records. You do not run `adhd`.
You do not write specs or plans. You dispatch a reviewer subagent to
check your work.

## Steps

1. **Read the spec and plan.** Use the context packet:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
   ```
   Read the packet, the spec MD, and the plan MD.

2. **Consult the project graph.** Read `graph/nodes/` and `graph/edges/`
   to understand file structure and dependencies. Identify where each
   workstream's code should land.

3. **Identify implementation units.** Break the plan's workstreams into
   discrete tasks. Each task is one coherent unit of implementation.

4. **Write task Markdown files** using `templates/TASK-NNN.template.md`.
   One file per task, in `tasks/TASK-NNN.md`. Include:
   - Goal (one sentence)
   - Files to touch (from the graph)
   - Algorithm IDs / test vectors (if applicable)
   - Dependencies on other tasks
   - Skills and triggers (recorded for the implementer to load later)

5. **Register each task via the CLI** in build order. This appends to
   `data/tasks.jsonl` (with skills + triggers in the record) and writes
   the plan timeline:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --parent PLAN-NNN --status draft --skills "<skills>" --triggers "<triggers>" -t .
   ```
   Register tasks in the order they must be built. The `skills` and
   `triggers` values are stored in the JSONL record so the implementer
   knows what to load at implementation time. The task-writer does not
   load them.

6. **Dispatch the reviewer** (foreground, `reviewer` profile, read-only).
   Give it the task file paths, the parent plan path, the spec path,
   `AGENTS.md`, and a 1-2 sentence context summary. It checks plan
   alignment, build order, file placement, technical accuracy, format
   consistency, rule compliance, internal consistency. One pass — if
   MUST-FIX issues remain after one revision, escalate to the user.

7. **Revise the task files.** Fix MUST-FIX issues based on reviewer
   findings.

8. **Report.** List the tasks created and their build order. Tell the
   user to run `/pc-implement TASK-NNN` to start implementation (one at a
   time).

## Constraints

- **No adhd.** The task-writer does not run divergent ideation.
- **No orchestrator model.** The task-writer is a cheaper model.
- **No optimizer subagent.** The task-writer writes; the reviewer checks.
- **No skill loading.** The task-writer records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them. Skills
  are loaded by the implementer at implementation time.
- **Build order matters.** Tasks are registered in the order they must
  be built. The JSONL records are append-only — do not reorder past
  lines.
- **One task at a time during implementation.** The build order you
  write determines the implementation sequence.
