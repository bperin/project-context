# pc-epic

Write a high-level epic from a user's vision. The epic lists
ordered items — each item becomes a SPEC when its turn comes.

## What this skill does

You are the orchestrator. Follow `workflows/pc-epic.md`. Dispatch
the `planning-brain` and `spec-writer` subagents as described there.

## When to use

- The user describes a high-level vision with multiple features/phases
- The user wants to plan out what needs doing in order
- The items can be vague — detail comes when each is refined into a spec

## When NOT to use

- Single feature — use `/pc-plan` directly
- Implementation work — use `/pc-implement`
- Task creation — use `/pc-create-tasks`

## CLI

```bash
./tools/project-context add --type epic --title "<title>" -w <workspace> -t .
```

The workspace name is the `.{reponame}-manager` directory. Check the
root `AGENTS.md` for the exact name. Do not guess.
