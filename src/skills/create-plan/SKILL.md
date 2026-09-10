---
name: create-plan
description: "Run the plan-creation workflow — divergent ideation (adhd), research, write plan, blind rounds 1-2, plan-optimizer round 3, max 3 rounds"
argument-hint: "<PLAN-NNN> from <SPEC-NNN>"
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
    - Write(plans/**)
    - Edit(plans/**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **plan-creation workflow** for this project. Read
`workflows/plan-creation.md` before starting and follow it exactly.

## What you are doing

Creating a new plan (PLAN-NNN) from a committed spec using the
writer-research-plan-optimizer-security-blind review pattern.

## Steps

1. **Generate a UUID** for the plan:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid PLAN-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation on the plan
   structure.

3. **Read the parent spec** from the Specs sheet in `overview.xlsx`.
   The plan must trace to a spec.

4. **Spawn the research agent** (background, read-only). Save findings
   to `decisions/PLAN-NNN-research.md`.

5. **Write the plan** using `templates/PLAN-NNN.template.md`. The plan
   describes HOW — architecture, workstreams, dependencies, test
   vectors. Write to `plans/PLAN-NNN.md`.

6. **Build a context packet**:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
   ```

7. **Run tiered review per `workflows/plan-creation.md`:**
   - Rounds 1-2: `blind-reviewer` (cheap) + `security reviewer` if crypto
   - Round 3 (final): `plan-optimizer` (medium, `glm-5.2-high`) with `adhd` loaded
   - Max 3 rounds, then escalate

8. **Register the plan via the CLI.** Do not edit `overview.xlsx` directly:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type plan --title "<title>" --status committed --dependencies "<SPEC-NNN>" --skills "<skills>" --triggers "<triggers>" -t .
   ```

9. **Report.** Summarize workstreams, tasks, and skills per workstream.
