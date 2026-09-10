---
name: context
description: "Build a minimal context packet for a spec/plan/task — feed to subagents instead of conversation history"
argument-hint: "<SPEC-NNN | PLAN-NNN | TASK-NNN>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - exec
permissions:
  allow:
    - Read(**)
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

Build a context packet for the given ID. This produces a JSON object containing only the relevant rows from overview.xlsx — the target, its parent, its grandparent, its children, all modules, all components, and all applicable skills (cascaded from target → parent → grandparent).

```bash
node /Users/brian/code/project-context/bin/cli.js context <ID> -t .
```

Print the output. Use this to feed subagents only the context they need — no conversation history, no unrelated tasks, no noise.
