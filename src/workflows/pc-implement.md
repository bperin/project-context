# Workflow: Task Implementation

## CLI discovery

The CLI is at `./tools/project-context`. Always use the full path and
pass the workspace name with `-w`:

```bash
./tools/project-context <command> -w <workspace> -t .
```

If `./tools/project-context` doesn't exist, check the root `AGENTS.md`
for the workspace name and CLI path. Do not guess. Do not search the
filesystem.

## When

When one or more ready tasks move from `draft` to `in_progress`.

## Implementation waves

Run up to five tasks in one background wave. A task is eligible only when:

- every declared task dependency is `done`;
- its declared files and symbols do not overlap another task in the wave; and
- its acceptance criteria can be verified independently.

If ownership overlaps or is unclear, run those tasks sequentially. Background
implementers share the working tree; they are not isolated branches.

```text
select ≤5 ready tasks → start statuses → background implementers (self-review)
→ collect all → integrated verification → one commit
→ when all tasks in plan done → plan review
```

## Steps

1. Ask the scheduler for a wave of at most five eligible tasks:
   ```bash
   ./tools/project-context ready --limit 5 -w <workspace> -t .
   ```
   It subtracts active tasks from the five-task budget, checks dependencies,
   rejects overlapping write sets, and preserves JSONL order for equal candidates.
   Never launch a task listed under `waiting`.
2. Build a separate context packet for each task:
   ```bash
   ./tools/project-context context TASK-NNN -w <workspace> -t . -o .context-TASK-NNN.json
   ```
3. Append each `in_progress` status serially before dispatch. Do not let subagents
   edit manager state.
4. Dispatch one pinned `implementer` (`swe-2-high`) per task with
   `is_background: true`. Each implementer has its own clean context —
   no conversation history. The `task:` prompt must contain everything:

   ```
   run_subagent(
     title: "Implement TASK-NNN",
     task: "Read AGENTS.md at <path> for project conventions.
   Read the context packet at <path> for skillLayers, parent plan, spec.
   Read the task file at <path> for goal, files, symbols, criteria, tests.
   Load ONLY the skills listed in the context packet's allSkills field.
   Do not load any other skill. Do not browse for skills.
   Implement TASK-NNN. Stay within these files only: <exclusive list>.
   Do not touch: <do-not-touch list>. Load pc-optimize before verification.
   Write the tests defined in the task file.
   Run <verification commands>. Self-review: dispatch a reviewer with
   your diff and the task's acceptance criteria. Fix MUST-FIX issues.
   do not commit or change task status.",
     profile: "implementer",
     is_background: true
   )
   ```

   Each implementer writes code, writes tests, and self-reviews by
   dispatching its own reviewer. The orchestrator does not review —
   the implementer handles it.
5. Wait for completion notifications and collect every result. Background agents
   cannot request new permissions; if one is denied, resume only that agent in the
   foreground. If an agent fails, keep the wave tasks `in_progress` and stop before
   commit.
   If no task is ready while agents are active, block on `read_subagent` for an
   active agent. Do not sleep or repeatedly poll. After completion, update state
   and run `./tools/project-context ready` again to backfill the open slot.
6. Check the combined diff against declared ownership, then run applicable
   project-level mechanical verification once over the integrated wave.
7. Commit the verified wave once, then append each `done` status serially and
   rebuild the graph:
   ```bash
   ./tools/project-context status TASK-NNN done -w <workspace> -t .
   ./tools/project-context graph -w <workspace> -t .
   rm -f .context-TASK-NNN.json
   ```

## Plan review

When all tasks in a plan are `done`, dispatch one `reviewer` with the
plan file, spec file, and the full diff. The reviewer checks:
- Every spec behavior was implemented
- Every plan workstream is complete
- No regressions introduced
- All checks pass

This replaces per-wave reviews and PR reviews. One review at plan
completion. If MUST-FIX issues remain, re-dispatch the implementer(s)
for the affected tasks. One correction pass. Then commit and open the
PR.

## Constraints

- Maximum five simultaneous implementation agents.
- Never parallelize tasks with overlapping or unknown write sets.
- No per-agent commits and no concurrent JSONL or Markdown state writes.
- One integrated commit per wave.
- Implementers self-review — the orchestrator does not dispatch a
  separate reviewer per wave.
- One plan review when all tasks in the plan are done.
