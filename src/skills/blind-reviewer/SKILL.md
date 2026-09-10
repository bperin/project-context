---
name: blind-reviewer
description: "Spawn the blind reviewer subagent (read-only, no context) to review a spec/plan/task"
argument-hint: "<document-path> <agents-md-path>"
triggers:
  - model
agent: blind-reviewer
---

The caller will provide:
- The document file path (spec, plan, or task)
- The AGENTS.md path

Read the document and AGENTS.md only. Do not read the context packet or any conversation history. Return findings in the format specified by the blind-reviewer agent profile.