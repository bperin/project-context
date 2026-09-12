---
name: pc-inspect-project
description: "Read project state and print a nice view of specs, plans, and tasks"
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

Read the project state from JSONL and Markdown files and print a summary.

```bash
project-context inspect -t .
```

Print the output. That's it — no analysis, no recommendations. Just the facts.
