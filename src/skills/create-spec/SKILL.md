---
name: create-spec
description: "Run the spec-creation workflow — divergent ideation (adhd skill), write spec, code-optimizer + blind review, max 3 rounds"
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

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are running the **spec-creation workflow** for this project.

Read the full workflow at `workflows/spec-creation.md` before starting. Follow it exactly.

## What you are doing

Creating a new spec (SPEC-NNN) using the writer-code-optimizer-blind review pattern.

## Steps

1. **Generate a UUID** for the spec:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js uuid SPEC-NNN
   ```

2. **Load the `adhd` skill** for divergent ideation. Use it to explore the design space before writing. Spawn divergent branches under different cognitive frames, score and prune, then write the spec from the survivors. Do not lock onto the first approach before alternatives are considered.

3. **Write the spec** using the structure below. The spec describes WHAT and WHY, not HOW. Write it to `specs/SPEC-NNN.md`.

```markdown
# SPEC-NNN: <short title>

## Supersedes
- Supersedes: <SPEC-NNN, or "none">
- Reason: <why the old spec is no longer accurate>
- Superseded by: <filled in when a newer spec replaces this one>

## Status
- **Status**: draft
- **Progress**: 0% (0 of N plans done)
- **Plans**: <list plans created from this spec, or "none yet">

## What
<one paragraph: what the system does at a high level>

## Why
- <bullet points explaining the motivation>

## Desired Behavior
### <Feature Area 1>
1. <observable behavior>
2. <observable behavior>

## Scope
### In Scope
- <item>
### Out of Scope
- <item>

## Constraints
- <hard, non-negotiable invariants>

## Success Criteria
1. <observable, testable condition>
2. <observable, testable condition>

## Linked Plan
- Plan: `plans/PLAN-NNN.md` (created by Architect)
- Tasks: listed in the plan under Workstreams

## Review Findings
| Round | Reviewer | Type | Finding | Resolution |
|---|---|---|---|---|
| | | | | |
```

4. **Build a context packet** for the code-optimizer:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context SPEC-NNN -t . -o .context-packet.json
   ```

5. **Spawn the code-optimizer** using the `skill` tool to invoke `/code-optimizer` (subagent, read-only, with context). Feed it:
   - The spec file path
   - The context packet file path
   - A 1-2 sentence context summary of what this spec is for
   - The AGENTS.md path

6. **Apply code-optimizer findings.** Append each finding to the `## Review Findings` table in the spec with the current round, reviewer `code-optimizer`, type, and a brief description. Revise the spec. If the code-optimizer found a fundamental problem (wrong problem, wrong scope), stop and discuss with the user before rewriting.

7. **Spawn the blind reviewer** using the `skill` tool to invoke `/blind-reviewer` (subagent, read-only, no context). Feed it:
   - The spec file path
   - The AGENTS.md path
   - No context summary, no conversation history.

8. **Apply blind reviewer findings.** Append each finding to the `## Review Findings` table with the current round and reviewer `blind-reviewer`. Revise the spec.

9. **Resolve findings.** After each round, update the `Resolution` column for findings that were fixed in that round. Keep all rows for traceability.

10. **Round counter.** This is round 1. If either reviewer found MUST-FIX or SHOULD-FIX issues, go back to step 5 (re-spawn both reviewers on the revised spec). Max 3 rounds. If still unresolved after round 3, escalate to the user with a summary of the disagreement.

11. **Refine or accept.** Use `ask_user_question` to present the spec and ask:

    - Question: "Does the spec look right?"
    - Options: `Accept` (register the spec and finish), `Refine` (describe what to change)
    - If the user chooses `Refine`, capture their feedback in `custom_text` and go back to step 3 (rewrite the spec).
    - If the user chooses `Accept`, continue to step 12.

12. **Register the spec via the CLI.** Do not edit `overview.xlsx` directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js add --type spec --title "<title>" --status committed --skills "<comma-separated>" --triggers "<comma-separated>" -t .
    ```
    The CLI auto-assigns the ID and UUID. Use the returned ID for the spec filename.

13. **Report.** Summarize what the review changed and what the spec covers.
