---
name: pc-spec
description: "Planning-brain loads ADHD, writes spec and plan directly, reviewer checks each. One agent thinks and writes."
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
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

You are the lightweight orchestrator. Dispatch the `planning-brain`
subagent — it loads ADHD, thinks, and writes specs and plans directly.
No separate writer subagents. Do not rely on the root session's model.

Follow `workflows/pc-spec.md` exactly:

1. Dispatch pinned `planning-brain` (`deepseek-4.1-flash-high`) with the
   request and repository context. It loads `adhd`, thinks, then writes
   the spec directly.
2. Dispatch pinned `reviewer` (`swe-2-high`); allow one correction pass.
3. **Stop and wait for explicit specification approval.**
4. Re-dispatch `planning-brain` for the architecture brief and plan.
   It has the spec in context — no re-reading. It **loads `adhd` again**
   for implementation approach ideation, then writes the plan directly.
5. Dispatch pinned `reviewer` (`swe-2-high`); allow one correction pass.
6. **Stop and wait for explicit plan approval.**
7. After approval, commit and hand off to `/pc-create-tasks`.

Use only explicitly pinned `planning-brain` and `reviewer` profiles.
Never use `subagent_general` or an unpinned custom profile. Do not
write specs, plans, or code yourself. Do not load `adhd` yourself —
the planning-brain does that.
