---
name: reviewer
description: "Spawn the reviewer subagent (read-only, with context) to check a document for correctness, rule compliance, and template compliance. Runs AFTER the optimizer."
triggers:
  - model
allowed-tools:
  - read
  - run_subagent
  - read_subagent
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.**

This skill spawns the `reviewer` subagent profile from
`.agents/agents/reviewer.md`. The reviewer checks any document (spec,
plan, task) for correctness, rule compliance, template compliance, and
dependency compliance. It runs AFTER the optimizer has tightened the
document.

Use `agent: reviewer` in the subagent spawn.
