---
name: plan-optimizer
description: "Spawn the plan-optimizer subagent (read-only, with context) to review a plan for spec coverage, workstream ordering, completion criteria, and skill/algorithm mapping"
argument-hint: "<plan-path> <context-packet-path> <summary> <agents-md-path>"
triggers:
  - model
agent: plan-optimizer
---

The caller will provide:
- The plan file path
- The context packet file path (JSON from `project-context context <ID>`)
- A 1-2 sentence context summary of what this plan covers
- The AGENTS.md path

Read the document, context packet, and AGENTS.md. Return findings in
the format specified by the plan-optimizer agent profile. Do not review
specs, tasks, or code — that is the spec-optimizer, task-optimizer, and
test-agent's jobs.
