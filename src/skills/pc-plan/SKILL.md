---
name: pc-plan
description: "Use SOL as the planning brain, then pinned GLM writers and a pinned SWE reviewer for spec and plan artifacts"
argument-hint: "<description of what to build>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - run_subagent
  - read_subagent
  - skill
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

You are the lightweight orchestrator. Dispatch the explicitly pinned
`planning-brain` for decisions; pinned cheaper subagents write and review the
long-form artifacts. Do not rely on the root session's selected model.

Follow `workflows/pc-plan.md` exactly:

1. Dispatch pinned `planning-brain` (`gpt-5.6-sol-medium`) for the specification
   decision brief.
2. Dispatch pinned `spec-writer` (`glm-5.2-high`) with that brief.
3. Dispatch pinned `reviewer` (`swe-1.7-medium`); allow one correction pass.
4. **Stop and wait for explicit specification approval.**
5. Dispatch pinned `planning-brain` again for the architecture brief.
6. Dispatch pinned `plan-writer` (`glm-5.2-high`).
7. Dispatch pinned `reviewer` (`swe-1.7-medium`); allow one correction pass.
8. **Stop and wait for explicit plan approval.**
9. After approval, commit and hand off to `/pc-create-tasks`.

Use only explicitly pinned `planning-brain`, `spec-writer`, `plan-writer`, and
`reviewer` profiles. Never use `subagent_general` or an unpinned custom profile.
Do not write long-form spec or plan prose, implement code, create tasks, or
auto-progress past either gate.
