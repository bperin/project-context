---
name: create-spec
description: "Run the spec-creation workflow — divergent ideation (adhd), research, write spec, reviewer, max 3 rounds"
argument-hint: "<SPEC-NNN title>"
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
  - run_subagent
  - read_subagent
  - skill
  - todo_write
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Write(specs/**)
    - Edit(specs/**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **spec-creation workflow** for this project. Read
`workflows/spec-creation.md` before starting and follow it exactly.

## What you are doing

Creating a new spec (SPEC-NNN) using the
orchestrator-research-reviewer pattern.

## Steps

1. **Generate a UUID** for the spec:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid SPEC-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation. Explore the design
   space before writing. Score and prune alternatives, then write the
   spec from the survivors.

3. **Spawn the research agent** (background, read-only). Give it the spec
   topic and the algorithms/standards the spec will touch. Save
   findings to `decisions/SPEC-NNN-research.md`.

4. **Write the spec** using `templates/SPEC-NNN.template.md`. The spec
   describes WHAT and WHY, not HOW. Pull citations from the research
   file.

5. **Build a context packet** for reviewers:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context SPEC-NNN -t . -o .context-packet.json
   ```

6. **Run review per `workflows/spec-creation.md`:**
   - `spec-optimizer` (heavy, `gpt-5.6-sol-medium`) with `adhd` loaded
   - Max 3 rounds, then escalate

7. **Register the spec via the CLI.** Do not edit `overview.xlsx` directly:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type spec --title "<title>" --status committed --skills "<skills>" --triggers "<triggers>" -t .
   ```

8. **Report.** Summarize what the review changed and what the spec covers.
