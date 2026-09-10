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

Detect the project language and load the matching testing skills:

- `go.mod` → primary `golang-testing`, secondary `golang-performance`, `golang-security`
- `package.json` → primary `typescript-unit-testing`, secondary `typescript-security-review`, `typescript-code-review`, `accelint-ts-performance`
- `pyproject.toml`/`requirements.txt`/`setup.py` → primary `python-testing-patterns`, secondary `python-performance-optimization`, `python-cybersecurity-tool-development`, `python-code-style`
- `Cargo.toml` → primary `rust-testing`, secondary `rust-performance`, `rust-security`

Load the primary skill first, then any secondary skills from the task's `Skills` column or the Skill Matrix.

Write the full test suite. Do not modify implementation code. Run the tests. Report the tests written and results.
