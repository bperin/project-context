---
name: approve-spec
description: "Approve a committed spec and start the plan-creation workflow"
argument-hint: "<SPEC-NNN>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
  - skill
  - todo_write
permissions:
  allow:
    - Read(**)
    - Exec(node **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are approving a committed spec and starting the next workflow.

## Steps

1. **Verify the spec exists and is committed.** Use `inspect` or read the xlsx. If it is not `committed`, stop and tell the user to run `/create-spec SPEC-NNN` first.

2. **Update the spec status via the CLI.** Do not edit `overview.xlsx` directly:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js status SPEC-NNN approved -t .
   ```

3. **Build a context packet** for the spec (to pass to `/plan-create`):
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context SPEC-NNN -t . -o .context-packet.json
   ```

4. **Start the plan-creation workflow.** Invoke `/create-plan SPEC-NNN`:
   ```
   skill invoke --skill create-plan
   ```
   Then pass `SPEC-NNN` as the argument to the create-plan skill.

5. **Report.** Confirm the spec is approved and the plan workflow has started.
