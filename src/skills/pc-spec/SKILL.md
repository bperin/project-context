---
name: pc-spec
description: "Grill-me interrogates user, planning-brain with ADHD (self-review) writes spec and plan directly. No separate reviewers."
argument-hint: "<description of what to build>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - skill
  - run_subagent
  - read_subagent
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

You are the lightweight orchestrator. Load `grill-me` to interrogate
the user, then dispatch the `planning-brain` subagent — it loads ADHD
for self-review, then writes specs and plans directly. No separate
reviewer subagents.

Follow `workflows/pc-spec.md` exactly:

1. **Load `grill-me` skill.** Interrogate the user about the problem
   until the decision tree is resolved.
2. Dispatch pinned `planning-brain` (`openai-terra-5.6-high`) with the
   grill-me findings and repository context. It loads `adhd` for
   divergent ideation (which serves as self-review), then writes the
   spec directly.
3. **Stop and wait for explicit specification approval.**
4. Re-dispatch `planning-brain` for the architecture brief and plan.
   It has the spec in context — no re-reading. It **loads `adhd` again**
   for implementation approach ideation (self-review), then writes the
   plan directly.
5. **Stop and wait for explicit plan approval.**
6. After approval, commit and hand off to `/pc-create-tasks`.

Use only explicitly pinned `planning-brain` profile. Never use
`subagent_general` or an unpinned custom profile. Do not write specs,
plans, or code yourself. Do not load `adhd` yourself — the
planning-brain does that.
