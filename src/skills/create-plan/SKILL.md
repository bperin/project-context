---
name: create-plan
description: "Run the plan-creation workflow — divergent ideation (adhd skill), write plan, code-optimizer + blind review, max 3 rounds"
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

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are running the **plan-creation workflow** for this project.

Read the full workflow at `workflows/plan-creation.md` before starting. Follow it exactly.

## Steps

1. **Generate a UUID** for the plan:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid PLAN-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation on the plan structure.

3. **Read the parent spec** from the Specs sheet in `overview.xlsx`. The plan must trace to a spec.

4. **Write the plan** using the structure below. The plan describes HOW the system is built — architecture, not what/why. Write to `plans/PLAN-NNN.md`.

```markdown
# PLAN-NNN: <short title>

## Supersedes
- Supersedes: <PLAN-NNN, or "none">
- Reason: <why the old plan is no longer accurate>
- Superseded by: <filled in when a newer plan replaces this one>

## Status
- **Status**: draft
- **Progress**: 0% (0 of N tasks done)
- **Tasks**: <list tasks created from this plan, or "none yet">

## Source Specification
SPEC-NNN — <short title> (`specs/SPEC-NNN.md`)

## Objective
<one-paragraph summary of what this plan achieves>

## System Map
<ASCII diagram of major components and their relationships>

## Repositories
| Path | Role | Description |
|---|---|---|
| `<repo>/` | | |

## Architecture
### New package: `<name>/`
```
<package>/
├── __init__.py
├── <module>.py          # <one-line responsibility>
└── ...
```

### Key design decisions
1. **<decision>** — <rationale>

## Communication Topology
| Path | Transport | Purpose |
|---|---|---|
| <A → B> | | |

## Data / Ownership
- **<data category>**: <owner / location>

## Workstreams
| ID | Workstream | Tasks |
|---|---|---|
| W1 | | TASK-NNN |

## Dependencies
### External packages (to add)
### Existing code dependencies (read-only, not modified)

## Constraints
- <hard constraints>

## Current Focus
**TASK-NNN: <title>** — <why this is next>

## Completion Criteria
1. <observable, testable condition>

## Linked Tasks
- `tasks/TASK-NNN.md` — <one-line summary>

## Review Findings
| Round | Reviewer | Type | Finding | Resolution |
|---|---|---|---|---|
| | | | | |
```

5. **Build a context packet**:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
   ```

6. **Spawn the code-optimizer** using the `skill` tool to invoke `/code-optimizer` (subagent, read-only, with context). Feed it:
   - The plan file path
   - The context packet file path
   - A 1-2 sentence context summary of what this plan is for
   - The AGENTS.md path

7. **Apply code-optimizer findings.** Append each finding to the `## Review Findings` table in the plan with the current round, reviewer `code-optimizer`, type, and a brief description. Revise the plan.

8. **Spawn the blind reviewer** using the `skill` tool to invoke `/blind-reviewer` (subagent, read-only, no context). Feed it:
   - The plan file path
   - The AGENTS.md path

9. **Apply blind reviewer findings.** Append each finding to the `## Review Findings` table with the current round and reviewer `blind-reviewer`. Revise the plan.

10. **Resolve findings.** After each round, update the `Resolution` column for findings that were fixed in that round. Keep all rows for traceability.

11. **Round counter.** Max 3 rounds. Escalate to user if unresolved.

12. **Refine or accept.** Use `ask_user_question` to present the plan and ask:

    - Question: "Does the plan look right?"
    - Options: `Accept` (register the plan and finish), `Refine` (describe what to change)
    - If the user chooses `Refine`, capture their feedback in `custom_text` and go back to step 4 (rewrite the plan).
    - If the user chooses `Accept`, continue to step 13.

13. **Register the plan via the CLI.** Do not edit `overview.xlsx` directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js add --type plan --title "<title>" --status committed --dependencies "<SPEC-NNN>" --skills "<comma-separated>" --triggers "<comma-separated>" -t .
    ```

14. **Report.** Summarize workstreams, tasks, and skills per workstream.
