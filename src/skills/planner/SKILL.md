---
name: planner
description: "Spawn the planner subagent (read-only, with context) to review a spec or plan for coverage, scope, dependency ordering, and research completeness"
argument-hint: "<document-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: planner
---

The caller will provide:
- The document file path (spec or plan — not a task)
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this document is for
- The AGENTS.md path

Read the document, context packet, and AGENTS.md. Return findings in
the format specified by the planner agent profile. Do not review code
or test-suite design — that is the `code-optimizer` and `test-agent`'s
jobs.
