---
name: task-optimizer
description: "Spawn the task-optimizer subagent (read-only, with context) to review a task for file paths, algorithm IDs, test vectors, and implementation readiness"
argument-hint: "<task-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: task-optimizer
---

The caller will provide:
- The task file path
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this task covers
- The AGENTS.md path

Read the document, context packet, and AGENTS.md. Return findings in
the format specified by the task-optimizer agent profile. Do not review
specs, plans, or write tests — that is the spec-optimizer,
plan-optimizer, and test-agent's jobs.
