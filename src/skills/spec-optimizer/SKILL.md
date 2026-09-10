---
name: spec-optimizer
description: "Spawn the spec-optimizer subagent (read-only, with context) to review a spec for problem fit, desired behaviors, success criteria, scope, and research completeness"
argument-hint: "<spec-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: spec-optimizer
---

The caller will provide:
- The spec file path
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this spec is for
- The AGENTS.md path

Read the document, context packet, and AGENTS.md. Return findings in
the format specified by the spec-optimizer agent profile. Do not review
plans, tasks, or code — that is the plan-optimizer, task-optimizer, and
test-agent's jobs.
