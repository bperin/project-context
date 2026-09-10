---
name: code-optimizer
description: "Spawn the code-optimizer subagent (read-only, with context) to review a task"
argument-hint: "<document-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: code-optimizer
---

The caller will provide:
- The document file path (a task — not a spec or plan)
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this task is for
- The AGENTS.md path

Read the document, context packet, and AGENTS.md. If the task describes
code or the project is Go/TypeScript/Python/Rust, load the matching
language skills from the matrix in your agent profile, then return
findings in the format specified by the code-optimizer agent profile.
For specs or plans, use the `planner` subagent instead.