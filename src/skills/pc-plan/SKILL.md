---
name: pc-plan
description: "ADHD once for the original input, then SOL planning-brain, then pinned GLM writers and a pinned SWE reviewer for spec and plan artifacts"
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

You are the lightweight orchestrator. Load `adhd` once for the original
input, then dispatch pinned subagents for decisions, writing, and review.
Do not rely on the root session's selected model.

Follow `workflows/pc-plan.md` exactly:

1. **Load `adhd`** (`skill invoke adhd`). Think about the original user input
   from multiple cognitive frames. This is the ONLY time `adhd` runs.
2. Dispatch pinned `planning-brain` (`gpt-5.6-sol-medium`) with the ADHD
   output for the specification decision brief.
3. Dispatch pinned `spec-writer` (`glm-5.2-high`) with that brief.
4. Dispatch pinned `reviewer` (`swe-1.7-medium`); allow one correction pass.
5. **Stop and wait for explicit specification approval.**
6. Dispatch pinned `planning-brain` again for the architecture brief.
7. Dispatch pinned `plan-writer` (`glm-5.2-high`).
8. Dispatch pinned `reviewer` (`swe-1.7-medium`); allow one correction pass.
9. **Stop and wait for explicit plan approval.**
10. After approval, commit and hand off to `/pc-create-tasks`.

Use only explicitly pinned `planning-brain`, `spec-writer`, `plan-writer`, and
`reviewer` profiles. Never use `subagent_general` or an unpinned custom profile.
Do not write long-form spec or plan prose, implement code, create tasks, or
auto-progress past either gate. Do not run `adhd` again after step 1.
