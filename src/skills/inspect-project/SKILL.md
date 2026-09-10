---
name: inspect-project
description: "Read overview.xlsx and print a nice view of specs, plans, and tasks"
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

Read the project state from the overview.xlsx spreadsheet and print a summary.

```bash
node /Users/brian/code/project-context/bin/cli.js inspect -t .
```

Print the output. That's it — no analysis, no recommendations. Just the facts.
