---
name: pc-create-tasks
description: "Root coordinator decomposes an approved plan into explicit task records; subagents provide only bounded evidence or completed-diff review."
argument-hint: "<PLAN-NNN>"
triggers:
  - user
  - model
---

> Read [`.agents/AGENTS.md`](../AGENTS.md) first.

You are the task author. Read the approved spec and plan, inspect repository
boundaries, and create the task records yourself. Do not hand dependent planning
work to a separate planning subagent.

Use `grill-me` to test workstream boundaries. Use `adhd` only for a genuinely
open-ended dependency or architecture decision. Register every task with
`./tools/project-context add` before editing the generated task file, so JSONL
history remains append-only.

Every implementation task states: exact write set, data/API boundary,
success/failure/boundary tests, verification command, do-not-touch list,
dependencies, and `gpt-5.6-luna` with high reasoning as its runtime.

Subagents are allowed only for independent research, implementation of a ready
task with an exclusive write set, or a bounded review of a finished diff. The
root coordinator reconciles all results and performs manager-state changes.
