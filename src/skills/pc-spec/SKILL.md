---
name: pc-spec
description: "Root coordinator writes and owns the spec and plan; use skills for interrogation and bounded evidence, not planning handoffs."
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

You are the planning brain. Write and integrate specs and plans yourself.
Load `grill-me` when it helps resolve product decisions and `adhd` only for
open-ended exploration. Use subagents only for bounded independent evidence or
a scoped challenge; never delegate dependent planning or document authorship.

Follow `workflows/pc-spec.md` exactly:

1. **Load `grill-me` skill.** Interrogate the user about the problem
   until the decision tree is resolved.
2. Inspect the relevant repository context and write the specification directly.
3. **Stop and wait for explicit specification approval.**
4. Write the architecture brief and plan directly, with explicit file ownership,
   dependencies, validation, and implementation runtime per workstream.
5. **Stop and wait for explicit plan approval.**
6. After approval, commit and hand off to `/pc-create-tasks`.

The root coordinator owns final decisions and artifacts. Do not substitute a
subagent report for a spec or plan.
