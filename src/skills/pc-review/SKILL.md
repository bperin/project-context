---
name: pc-review
description: "Explicit final PR review for a completed plan; runs only when the user invokes it"
argument-hint: "[PLAN-NNN]"
triggers:
  - user
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

Follow `workflows/pc-review.md` exactly. In order:

1. Detect the project stack and run only applicable configured checks
2. `git diff <protected>...<feature>`
3. Dispatch `reviewer` (foreground, read-only,
   `is_background: false`) — feed it the diff, `AGENTS.md`, the
   project's code-review skill, and project context
4. Apply one correction pass for deduplicated MUST-FIX findings; keep
   SHOULD-FIX as non-blocking follow-up work
5. Re-run verification and confirm only the original blockers
6. Open the PR (`PLAN-NNN: <plan name>`, body lists completed tasks)
7. Report

Block on `read_subagent` to collect the reviewer's findings.
Do not start a second correction loop.
