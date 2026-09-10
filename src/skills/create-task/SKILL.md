---
name: create-task
description: "Run the task-creation workflow — write task from plan, optimizer + blind review, max 3 rounds"
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

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are running the **task-creation workflow** for this project.

Read the full workflow at `workflows/task-creation.md` before starting. Follow it exactly.

## Steps

1. **Generate a UUID** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid TASK-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation on the task approach.

3. **Read the parent plan** from the Plans sheet in `overview.xlsx`. The task must trace to a plan.

4. **Write the task** using the structure below. The task describes the specific unit of work — goal, files, acceptance criteria. Write to `tasks/TASK-NNN.md`.

```markdown
# TASK-NNN — <short title>

## Parent
- Plan: `plans/PLAN-NNN.md` (or **standalone** — no plan)
- SPEC: `specs/SPEC-NNN.md` (if applicable)

## Supersedes
- Supersedes: <TASK-NNN, or "none">
- Reason: <why the old task is no longer valid>
- Superseded by: <filled in when a newer task replaces this one>

## Status
- **Status**: draft
- **Owner**: unassigned
- **Dependencies**: <TASK-NNN, or "none">

## Goal
<one sentence — what success looks like>

## Relevant Files
### To create
- `<path>` — <one-line purpose>
### To modify
- `<path>` — <what changes>

## Relevant Symbols
### Existing (read-only reference)
- `<file>` → `<symbol>` (<type>)
### To create
- `<module>.<function>(<args>) -> <return>`

## Required Change
1. **`<file>`**: <what to do>

## Constraints
- <hard constraints>

## Acceptance Criteria
1. <observable, testable condition>
2. <observable, testable condition>

## Verification
```
<test command>
```

## Do-Not-Touch
- <files/modules the worker must not modify>

## Commit Log
| Commit | Date | Type | Message |
|---|---|---|---|
| | | | |

## Review Findings
| Round | Reviewer | Type | Finding | Resolution |
|---|---|---|---|---|
| | | | | |
```

5. **Build a context packet**:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

6. **Spawn the optimizer** using the `skill` tool to invoke `/optimizer` (subagent, read-only, with context). Feed it:
   - The task file path
   - The context packet file path
   - A 1-2 sentence context summary of what this task is for
   - The AGENTS.md path

7. **Apply optimizer findings.** Append each finding to the `## Review Findings` table in the task with the current round, reviewer `optimizer`, type, and a brief description. Revise the task.

8. **Spawn the blind reviewer** using the `skill` tool to invoke `/blind-reviewer` (subagent, read-only, no context). Feed it:
   - The task file path
   - The AGENTS.md path

9. **Apply blind reviewer findings.** Append each finding to the `## Review Findings` table with the current round and reviewer `blind-reviewer`. Revise the task.

10. **Resolve findings.** After each round, update the `Resolution` column for findings that were fixed in that round. Keep all rows for traceability.

10. **Round counter.** Max 3 rounds. Escalate to user if unresolved.

11. **Register the task via the CLI.** Do not edit `overview.xlsx` directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --status committed --dependencies "<PLAN-NNN>" --skills "<comma-separated>" --triggers "<comma-separated>" -t .
    ```

12. **Report.** Summarize the task goal, files to touch, and acceptance criteria.
