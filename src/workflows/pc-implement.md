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
select ≤5 ready tasks → grill-me interrogates plan → writer implements → challenger collaborates → integrated verification → one commit
```

## Steps

1. Ask the scheduler for a wave of at most five eligible tasks:
   ```bash
   ./tools/project-context ready --limit 5 -w <workspace> -t .
   ```
   It subtracts active tasks from the five-task budget, checks dependencies,
   rejects overlapping write sets, and preserves JSONL order for equal candidates.
   Never launch a task listed under `waiting`.

2. For each task in the wave:
   - **Load `grill-me` skill.** Interrogate the plan and task:
     - What is the goal?
     - What are the acceptance criteria?
     - What are the edge cases?
     Grill until the implementation approach is clear.

3. Append each `in_progress` status serially before dispatch. Do not let subagents
   edit manager state.

4. Dispatch one pinned `writer` (`openai-terra-5.6-high`) per task with
   `is_background: true`. Each writer has its own clean context —
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
   Run <verification commands>. do not commit or change task status.",
     profile: "writer",
     is_background: true
   )
   ```

5. After each writer completes, dispatch one pinned `challenger`
   (`5.6-luna-medium`) with `is_background: true` to challenge parts
   of the implementation and collaborate:

   ```
   run_subagent(
     title: "Challenge TASK-NNN implementation",
     task: "Read the task file and the diff. Challenge the implementation:
   - Does the diff satisfy acceptance criteria?
   - Are the tests comprehensive (success, failure, boundary)?
   - Are there edge cases missed?
   - Is the code clean and efficient?
   Collaborate with the writer — suggest improvements, identify gaps.
   Return a concise report of issues found or 'pass'.",
     profile: "challenger",
     is_background: true
   )
   ```

6. Wait for completion notifications and collect every result. Background agents
   cannot request new permissions; if one is denied, resume only that agent in the
   foreground. If an agent fails, keep the wave tasks `in_progress` and stop before
   commit.
   If no task is ready while agents are active, block on `read_subagent` for an
   active agent. Do not sleep or repeatedly poll. After completion, update state
   and run `./tools/project-context ready` again to backfill the open slot.

7. Check the combined diff against declared ownership, then run applicable
   project-level mechanical verification once over the integrated wave.

8. Commit the verified wave once, then append each `done` status serially and
   rebuild the graph:
   ```bash
   ./tools/project-context status TASK-NNN done -w <workspace> -t .
   ./tools/project-context graph -w <workspace> -t .
   rm -f .context-TASK-NNN.json
   ```

## Plan review

When all tasks in a plan are `done`, skip the plan review — the
challenger already validated each implementation during the wave.
Commit and open the PR.

## Constraints

- Maximum five simultaneous implementation agents.
- Never parallelize tasks with overlapping or unknown write sets.
- No per-agent commits and no concurrent JSONL or Markdown state writes.
- One integrated commit per wave.
- grill-me interrogates the plan before implementation — no handoffs
- writer implements, challenger collaborates — no separate reviewer per wave
- No plan review after wave completion — challenger already validated
