# Workflow: Task Implementation

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
   project-context ready --limit 3 -t .
   ```
   It subtracts active tasks from the three-task budget, checks dependencies,
   rejects overlapping write sets, and preserves JSONL order for equal candidates.
   Never launch a task listed under `waiting`.
2. Build a separate context packet for each task:
   ```bash
   project-context context TASK-NNN -t . -o .context-TASK-NNN.json
   ```
3. Append each `in_progress` status serially before dispatch. Do not let subagents
   edit manager state.
4. Dispatch one pinned `implementer` (`swe-2-high`) per task with
   `is_background: true`. Give each an explicit exclusive file/symbol boundary.
   Implementers write code and complete task-level tests but do not commit, change
   task status, or spawn subagents. The orchestrator must not edit source files
   while the wave is running.
5. Wait for completion notifications and collect every result. Background agents
   cannot request new permissions; if one is denied, resume only that agent in the
   foreground. If an agent fails, keep the wave tasks `in_progress` and stop before
   commit.
   If no task is ready while agents are active, block on `read_subagent` for an
   active agent. Do not sleep or repeatedly poll. After completion, update state
   and run `project-context ready` again to backfill the open slot.
6. Check the combined diff against declared ownership, then run applicable
   project-level mechanical verification once over the integrated wave.
7. Optionally dispatch one pinned `code-optimizer` only for explicit or measured
   performance, memory, or concurrency risk.
8. Dispatch one pinned `reviewer` over the combined wave diff. Review changed
   behavior against each task's acceptance criteria.
9. Apply at most one correction pass. Independent corrections may return to their
   original pinned implementers in parallel, again capped at three. Confirmation
   checks only the original blockers and obvious correction regressions; it cannot
   expand scope. If a blocker remains, stop and ask the user.
10. Commit the verified wave once, then append each `done` status serially and
    rebuild the graph:
    ```bash
    project-context status TASK-NNN done -t .
    project-context graph -t .
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
