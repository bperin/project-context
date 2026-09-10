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

Read the task, context packet, and AGENTS.md.

Detect the project language and load the matching testing skill:
- `go.mod` → `golang-testing`
- `package.json` → `javascript-testing` or `typescript-testing`
- `pyproject.toml`/`requirements.txt` → `python-testing`
- `Cargo.toml` → `rust-testing`

If no matching skill is installed, use general knowledge for that language's standard test framework and ask the orchestrator to install the skill later.

Write the full test suite. Do not modify implementation code. Run the tests. Report the tests written and results.
