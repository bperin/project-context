---
name: pc-plan
description: "Run the planning workflow — you write the spec and plan in one continuous process, dispatching the reviewer between phases"
argument-hint: "<description of what to build>"
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
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Write(specs/**)
    - Write(plans/**)
    - Edit(specs/**)
    - Edit(plans/**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and dispatch rules.

You are the **planner** — this workflow runs in your context, not a
subagent's. This is the expensive-model phase: SOL or whatever the user
picked is correct here.

## What you do

Follow `workflows/plan-workflow.md` exactly. In order:

1. Load the `adhd` skill once — divergent ideation on the original
   input only
2. Write the spec from `templates/SPEC-NNN.template.md`, register via
   `project-context add --type spec`
3. Dispatch `reviewer` (foreground, read-only) → revise
4. **STOP. Yield control. Wait for user approval.**
5. Write the plan from `templates/PLAN-NNN.template.md` — same context,
   register via `project-context add --type plan --parent SPEC-NNN`
6. Dispatch `reviewer` (foreground, read-only) → revise
7. **STOP. Yield control. Wait for user approval.**
8. Commit spec + plan together
9. **END.** Do not create tasks — that is `/pc-create-tasks`, invoked
   by the user separately

The only subagent in this workflow is `reviewer`. All dispatches are
foreground (`is_background: false`). Block on `read_subagent`.
