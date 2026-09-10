---
name: test
description: "Spawn the test-agent subagent (write access) to write the full test suite for a task after code review passes"
argument-hint: "<TASK-NNN>"
triggers:
  - model
agent: test-agent
---

The caller will provide:
- The task file path (`tasks/TASK-NNN.md`)
- The context packet file path (JSON from `project-context context TASK-NNN`)
- The AGENTS.md path

Read the task, context packet, and AGENTS.md. Write the full test suite for the task. Do not modify implementation code. Run the tests. Report the tests written and results.
