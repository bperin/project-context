# Workflow: Task

## When

After the plan is reviewed and committed. The pc-spec workflow exits here.
The orchestrator dispatches the `planning-brain` again — it has the spec
and plan in context from the planning phases. It writes the tasks and
JSONL directly.

## Pattern

Only the planning-brain writes task state.

```
Orchestrator loads grill-me → interrogates the plan
    → Orchestrator dispatches planning-brain (with spec + plan + grill findings)
    → Planning-brain loads ADHD for divergent ideation on task decomposition
    → Planning-brain registers all tasks via CLI in build order
    → Planning-brain edits each TASK-NNN.md with details
    → Planning-brain writes the build order into data/tasks.jsonl
    → Planning-brain writes the per-plan timeline into plans/PLAN-NNN.timeline.jsonl
    → Planning-brain returns its report
    → Done — ready for task implementation
```

The planning-brain is the same agent that wrote the spec and plan. It
has full context — no re-reading, no context transfer.

## Steps

1. **Load `grill-me` skill.** Interrogate the plan:
   - What are the workstreams?
   - What does each workstream deliver?
   - What are the dependencies between workstreams?
   - What are the risks?
   Grill until the task decomposition approach is clear.

2. **Build a context packet** for the plan:

   ```bash
   ./tools/project-context context PLAN-NNN -t . -o .context-PLAN-NNN.json
   ```

3. **Dispatch the planning-brain** (foreground, `planning-brain` profile,
   `is_background: false`). **Pass the spec content, plan content,
   architecture brief, and grill-me findings in the task prompt** — the
   planning-brain wrote them but this is a fresh dispatch. Tell it
   **Phase: TASKS**. Also pass the context packet path, `AGENTS.md` path,
   and the instruction to write and register tasks. The planning-brain:
   - Has the spec, plan, architecture brief, and grill-me findings in its
     task prompt
   - **Loads `adhd` for divergent ideation on task decomposition.** Think
     from multiple cognitive frames about how to split the plan into
     granular, independently verifiable tasks. Maximize parallelism.
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

## Constraints

- `grill-me` is loaded first to interrogate the plan — reduces the need
  for reviewer handoffs
- `adhd` is loaded by planning-brain during task writing for divergent
  ideation on task decomposition — no separate reviewer subagents
- The orchestrator does not write tasks — the planning-brain subagent does.
  The orchestrator dispatches the planning-brain, collects results.
- No skill loading. The planning-brain records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them.
- No reviewer — grill-me + ADHD serve as quality gates
- The planning-brain is a subagent. It does not have conversation history.
  The orchestrator passes the spec content, plan content, architecture
  brief, and grill-me findings in the task prompt.
- Only the planning-brain may call `./tools/project-context add` to
  create tasks.
- One task file per workstream. If a workstream is large, split it into
  multiple tasks — but each task must be independently verifiable.
- The build order in JSONL is the queue. Tasks are built one at a time
  in this order.
