# pc-epic

Write a verbose epic from a user's vision or an input document. The
planning-brain thinks with ADHD and writes the epic directly. No
separate writer subagent. Epics are intentionally verbose to preserve
fidelity downstream.

## What this skill does

You are the orchestrator. Follow `workflows/pc-epic.md`. Dispatch
the `planning-brain` subagent — it loads ADHD, thinks, and writes
the epic directly.

## Input

Accepts either:
- **Text** — the user describes their vision in the prompt
- **An .md file** — the user provides a path to a markdown file
  containing the vision, requirements, or notes

If an .md file is provided, read it and pass its content to the
planning-brain as the vision input.

## When to use

- The user describes a high-level vision with multiple features/phases
- The user provides an .md file with notes or requirements to turn into an epic
- The user wants to plan out what needs doing in order

## When NOT to use

- Single feature — use `/pc-spec` directly
- Implementation work — use `/pc-implement`
- Task creation — use `/pc-create-tasks`

## CLI

```bash
./tools/project-context add --type epic --title "<title>" -w <workspace> -t .
```

The workspace name is the `.{reponame}-manager` directory. Check the
root `AGENTS.md` for the exact name. Do not guess.
