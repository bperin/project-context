---
name: pc-review
description: "Run the code-review workflow — mechanical checks, dispatch reviewer subagent, apply findings, open PR"
argument-hint: "[PLAN-NNN]"
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
permissions:
  allow:
    - Read(**)
    - Edit(src/**)
    - Write(src/**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(git **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and dispatch rules.

You are the **orchestrator**. You run mechanical checks and apply
fixes yourself; the only subagent is `reviewer`.

## What you do

Follow `workflows/code-review.md` exactly. In order:

1. Mechanical checks — lint, vet, test, vulnerability scanner
2. `git diff <protected>...<feature>`
3. Dispatch `reviewer` (foreground, read-only,
   `is_background: false`) — feed it the diff, `AGENTS.md`, the
   project's code-review skill, and project context
4. Apply MUST-FIX + SHOULD-FIX yourself
5. Re-run verification
6. Open the PR (`PLAN-NNN: <plan name>`, body lists completed tasks)
7. Report

Block on `read_subagent` to collect the reviewer's findings.
