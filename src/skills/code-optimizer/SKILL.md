---
name: code-optimizer
description: "Spawn the code-optimizer subagent (read-only, with context) to optimize implemented code for inefficiencies, OOM, concurrency, and error handling. Runs after the implementer, before the reviewer."
triggers:
  - model
allowed-tools:
  - read
  - run_subagent
  - read_subagent
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

This skill spawns the `code-optimizer` subagent profile from
`.agents/agents/code-optimizer.md`. The code-optimizer checks
implemented code for inefficiencies, OOM risks, concurrency issues,
error handling gaps, and style violations using the project's Go
skills. It runs AFTER the implementer writes code, BEFORE the
reviewer checks correctness.

Use `agent: code-optimizer` in the subagent spawn.
