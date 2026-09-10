---
name: optimizer
description: "Spawn the optimizer subagent (read-only, with context) to review a spec/plan/task"
argument-hint: "<document-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: optimizer
---

The caller will provide:
- The document file path (spec, plan, or task)
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this document is for
- The AGENTS.md path

Read the document, context packet, and AGENTS.md, then return findings in the format specified by the optimizer agent profile.