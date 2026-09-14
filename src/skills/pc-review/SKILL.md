---
name: pc-review
description: "PR readiness check for a completed plan — run checks, verify tasks done, open PR. Not a second code review."
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

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

You are the orchestrator. Code was already reviewed per-wave during
implementation. This is a PR readiness check, not a second code review.

Follow `workflows/pc-review.md` exactly:

1. Run project checks (`go test ./...`, `go vet ./...`, `npm test`, etc.)
2. Verify all tasks in the plan are `done` via `./tools/project-context inspect -t .`
3. Check the diff is clean — no debug code, no leftover `.context-*.json`
4. Open the PR with the plan name and completed task list

Do not dispatch a reviewer. Do not re-review code. Do not start
correction loops. If checks fail, tell the user to fix the issue —
the implementation workflow handles corrections.
