# Workflow: Task

## When

After the plan is reviewed and committed. The pc-spec workflow exits here.
The orchestrator dispatches the `planning-brain` again — it has the spec
and plan in context from the planning phases. It writes the tasks and
JSONL directly.

## Pattern

The planning-brain may dispatch its own workstream-analyst subagents
in parallel, collect their reports, then serialize writes. Only the
planning-brain writes task state.

```
Orchestrator dispatches planning-brain (with spec + plan in task prompt)
    → Planning-brain dispatches workstream analysts in parallel (optional)
    → Planning-brain collects all analyst reports
    → Planning-brain registers all tasks via CLI in build order
    → Planning-brain edits each TASK-NNN.md with details
    → Planning-brain writes the build order into data/tasks.jsonl
    → Planning-brain writes the per-plan timeline into plans/PLAN-NNN.timeline.jsonl
    → Planning-brain returns its report
    → Orchestrator dispatches reviewer → reviewer checks task files
    → Orchestrator re-dispatches planning-brain with findings → it revises
    → Done — ready for task implementation
```

The planning-brain is the same agent that wrote the spec and plan. It
has full context — no re-reading, no context transfer.

## Steps

1. **Build a context packet** for the plan:
   ```bash
   ./tools/project-context context PLAN-NNN -t . -o .context-PLAN-NNN.json
   ```

2. **Dispatch the planning-brain** (foreground, `planning-brain` profile,
   `is_background: false`). **Pass the spec content, plan content, and
   architecture brief in the task prompt** — the planning-brain wrote
   them but this is a fresh dispatch. Tell it **Phase: TASKS**. Also
   pass the context packet path, `AGENTS.md` path, and the
   instruction to write and register tasks. The planning-brain:
   - Has the spec, plan, and architecture brief in its task prompt
   - **May dispatch up to four `workstream-analyst` subagents**
     (`is_background: true`, one per workstream) for parallel
     analysis. Collects all results via `read_subagent` before
     writing. Skips this for small plans or tightly coupled workstreams.
   - Thinks through 2-3 implementation approaches per workstream, picks
     one (no `adhd` here — the plan already decided the high-level approach)
   - Consults `graph/nodes/` and `graph/edges/` for file placement
   - **Maximizes parallelism.** Builds a dependency DAG that minimizes
     the critical path. Tasks should depend on each other only when
     truly necessary — if two tasks can run independently, don't add a
     dependency. The more tasks that can run in parallel, the faster
     implementation goes. Does not add dependencies merely to force a
     serial ID order.
   - **Registers each task via the CLI in topological order FIRST.** The CLI
     `add` command creates the MD file from the template AND appends
     the JSONL `created` event + plan timeline `queued` event in one
     step:
     ```bash
     ./tools/project-context add --type task --title "<title>" --parent PLAN-NNN --dependencies "<TASK-NNN,... or none>" --status draft --skills "<skills>" --triggers "<triggers>" -t .
     ```
     The `skills` and `triggers` are stored in the JSONL record so the
     implementer knows what to load later. The planning-brain does not
     load them. Register ALL tasks before editing any files — the CLI
     auto-assigns sequential IDs and the JSONL order IS the build order.
   - **Then edits the generated MD files** to fill in the detailed
     content — goal, relevant files, relevant symbols, required change,
     constraints, acceptance criteria, verification, do-not-touch. The
     CLI created each file from `TASK-NNN.template.md`; the planning-brain
     uses `edit` to replace the template body with real content. Never
     `write` a TASK-NNN.md directly — the CLI `add` is the only thing
     that creates task files and JSONL records.
   Block on `read_subagent` to collect its report.

3. **Dispatch the reviewer** (foreground, `reviewer` profile,
   `is_background: false`). Give it the task file paths, the plan
   file, and the spec file. The reviewer **fixes issues directly** —
   it has write access and edits the task files itself. No bouncing
   back to the planning-brain. It checks:
   - Each task maps to a plan workstream
   - Each workstream traces back to a spec requirement
   - JSONL build order matches plan workstream order
   - Cited file paths respect dependency rules
   - Each task defines tests (success, failure, boundary)
   - Each task has acceptance criteria and verification commands
   - Do-not-touch list present
   - All template sections present
   Block on `read_subagent` to collect results.

4. **Commit and clean up.** Commit the task files and JSONL together, then delete
   `.context-PLAN-NNN.json`. Tell the user
   to run `/pc-implement TASK-NNN` to start implementation (one at a
   time).

## Expected output

- Task files (`TASK-NNN.md`) — one per workstream, with exact file
  paths, symbols, constraints, and acceptance criteria.
- `data/tasks.jsonl` — the build order, one `created` event per task.
- `plans/PLAN-NNN.timeline.jsonl` — the per-plan timeline, one `queued`
  event per task.
- All reviewed and fixed by the reviewer directly.

## Constraints

- No `adhd` during task writing. The plan already decided the approach.
- Background analysts are optional, read-only, explicitly pinned, and limited to
  four. The planning-brain dispatches them — not the orchestrator. Never
  use a general/unpinned background subagent.
- The orchestrator does not write tasks — the planning-brain subagent does.
  The orchestrator dispatches the planning-brain, collects results, then
  dispatches the reviewer which fixes any issues directly.
- No skill loading. The planning-brain records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them.
- No 3-round loop. The reviewer fixes issues directly. If issues remain
  that the reviewer cannot fix, escalate to the user.
- The planning-brain is a subagent. It does not have conversation history.
  The orchestrator passes the spec content, plan content, and
  architecture brief in the task prompt.
- The reviewer has write access to task files. It fixes issues directly
  — no bouncing back to the planning-brain.
- Only the planning-brain may call `./tools/project-context add` to
  create tasks. The reviewer edits existing task files but does not
  create new ones. Parallel analysts never mutate JSONL, timelines, or
  Markdown.
- One task file per workstream. If a workstream is large, split it into
  multiple tasks — but each task must be independently verifiable.
- The build order in JSONL is the queue. Tasks are built one at a time
  in this order.
