# Workflow: pc-epic

> Write a verbose epic from a user's vision or an input .md file. The
> planning-brain thinks with ADHD and writes the epic directly. No
> separate writer subagent.

```mermaid
flowchart TD
    A["User input: text or .md file"] --> B[planning-brain loads adhd]
    B --> C[planning-brain writes EPIC-NNN.md]
    C --> D[reviewer checks epic]
    D --> E{MUST-FIX?}
    E -->|yes| C
    E -->|no| F[Stop: user approves epic]
    F --> G[Commit]
```

## Input

Accepts either:
- **Text** — the user describes their vision in the prompt
- **An .md file** — the user provides a path to a markdown file
  containing the vision, requirements, or notes

If an .md file is provided, read it and pass its content to the
planning-brain as the vision input.

## CLI

```bash
./tools/project-context add --type epic --title "<title>" -w <workspace> -t .
```

The workspace name is the `.{reponame}-manager` directory. Check the
root `AGENTS.md` for the exact name. Do not guess.

## Steps

1. **Read the input.** If the user provided an .md file path, read
   it. If text, use it directly. This is the vision input.

2. **Dispatch `planning-brain`** (foreground, `is_background: false`).
   Give it the vision input and repo context. The planning-brain
   loads `adhd` for divergent ideation, then writes the epic directly.
   It registers via CLI and edits the generated file. Items must be
   verbose — each item needs enough detail that the planning-brain
   can produce a concrete spec without re-reading the original
   conversation. Fidelity is lost when items are vague. Write more,
   not less.

3. **Dispatch the reviewer** (foreground, `is_background: false`).
   Give it the epic file. The reviewer checks only:
   - Each item has: what it does, why it matters, dependencies, out of scope
   - Items are ordered with dependencies explained
   - Each item is a coherent unit of work
   - Out of scope is present
   - Template sections present
   Nothing else. Block on `read_subagent` to collect results.

4. **Apply reviewer findings.** If MUST-FIX issues remain, re-dispatch
   the planning-brain with the findings. At most one correction pass.

5. **Stop. Wait for the user to approve the epic.** Do not register
   or commit until the user says to.

6. **Commit.** Commit the epic file.

## Refining an epic item into a spec

When the user is ready to build an item from the epic, use
`/pc-spec`. The planning-brain takes the epic item + the epic
for context, and produces a concrete spec for that item. The spec's
`Dependencies` field points to the epic ID (e.g. `EPIC-001`).

```mermaid
flowchart LR
    R[EPIC-NNN item] --> PC[/pc-spec/]
    PC --> S[SPEC-NNN]
    S --> P[PLAN-NNN]
    P --> T[TASK-NNN]
```

The epic tracks which items have been specced. Update the item's
`Status` and `Spec` fields in the epic MD when a spec is created:
- Status: `specced`
- Spec: `SPEC-NNN`
