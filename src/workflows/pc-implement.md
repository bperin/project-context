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

Run up to three tasks in one background wave. A task is eligible only when:

- every declared task dependency is `done`;
- its declared files and symbols do not overlap another task in the wave; and
- its acceptance criteria can be verified independently.

If ownership overlaps or is unclear, run those tasks sequentially. Background
implementers share the working tree; they are not isolated branches.

```text
select ≤3 ready tasks → start statuses → background implementers
→ collect all → integrated verification → focused review → one commit
```

## Steps

1. Ask the scheduler for a wave of at most three eligible tasks:
   ```bash
   ./tools/project-context ready --limit 3 -w <workspace> -t .
   ```
   It subtracts active tasks from the three-task budget, checks dependencies,
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
   no conversation history, no prior session state. The `task:` prompt
   must contain everything the implementer needs:

   ```
   run_subagent(
     title: "Implement TASK-NNN",
     task: "Read AGENTS.md at <path> for project conventions.
   Read the context packet at <path> for skillLayers, parent plan, spec.
   Read the task file at <path> for goal, files, symbols, criteria.
   Implement TASK-NNN. Stay within these files only: <exclusive list>.
   Do not touch: <do-not-touch list>. Load pc-optimize before verification.
   Run <verification commands>. Do not commit or change task status.",
     profile: "implementer",
     is_background: true
   )
   ```

   Implementers write code and complete task-level tests but do not
   commit, change task status, or spawn subagents. The orchestrator
   must not edit source files while the wave is running.
5. Wait for completion notifications and collect every result. Background agents
   cannot request new permissions; if one is denied, resume only that agent in the
   foreground. If an agent fails, keep the wave tasks `in_progress` and stop before
   commit.
   If no task is ready while agents are active, block on `read_subagent` for an
   active agent. Do not sleep or repeatedly poll. After completion, update state
   and run `./tools/project-context ready` again to backfill the open slot.
6. Check the combined diff against declared ownership, then run applicable
   project-level mechanical verification once over the integrated wave.
7. Dispatch one pinned `reviewer`. Give it only the combined diff and
   each task's acceptance criteria. The reviewer checks only:
   - Does the diff satisfy each task's acceptance criteria?
   - Any security defects, data-loss risks, or forbidden imports?
   Nothing else.
8. Apply at most one correction pass. Independent corrections may return to their
   original pinned implementers in parallel, again capped at three. Confirmation
   checks only the original blockers and obvious correction regressions; it cannot
   expand scope. If a blocker remains, stop and ask the user.
9. Commit the verified wave once, then append each `done` status serially and
    rebuild the graph:
    ```bash
    ./tools/project-context status TASK-NNN done -w <workspace> -t .
    ./tools/project-context graph -w <workspace> -t .
    rm -f .context-TASK-NNN.json
    ```

## Blocking standard

A finding blocks only for an acceptance-criteria failure, regression, security
defect, data-loss risk, ownership violation, or failing required check. Suggestions
do not start a correction pass.

## Constraints

- Maximum three simultaneous implementation agents.
- Never parallelize tasks with overlapping or unknown write sets.
- No per-agent commits and no concurrent JSONL or Markdown state writes.
- One integrated commit and one correction pass per wave.
