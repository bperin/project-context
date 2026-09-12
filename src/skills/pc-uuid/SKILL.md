---
name: pc-uuid
description: "Generate a deterministic v5 UUID from an ID (SPEC-001, PLAN-001, TASK-001)"
argument-hint: "<ID>"
triggers:
  - user
  - model
allowed-tools:
  - exec
permissions:
  allow:
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

Generate a deterministic v5 UUID from the given ID.

```bash
project-context uuid <ID>
```

Print the UUID. Use this when adding rows to data/tasks.jsonl and Markdown files.
