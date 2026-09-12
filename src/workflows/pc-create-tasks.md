# Workflow: Task

## When

After the plan is reviewed and committed. The pc-plan workflow exits here.
The orchestrator dispatches a different agent — the task-writer
subagent (`task-writer` profile, `glm-5.2-high`) — to pick up with the
agreed spec and plan in hand. It has full context of the plan (it reads
the spec and plan files) but is not the orchestrator that wrote them.

## Pattern

Analyze in parallel, then serialize writes. The orchestrator may dispatch one
read-only `workstream-analyst` per independent workstream in the background.
After collecting every report, one foreground task-writer registers and edits all
tasks in build order. Only the task-writer writes task state.

```
Orchestrator dispatches bounded workstream analysts in parallel (optional)
    → Orchestrator collects all analyst reports
    → Orchestrator dispatches one foreground task-writer
    → Task-writer reads agreed spec + plan + analyst reports
    → Task-writer writes TASK-NNN.md files (one per workstream)
    → Task-writer writes the build order into data/tasks.jsonl
    → Task-writer writes the per-plan timeline into plans/PLAN-NNN.timeline.jsonl
    → Task-writer returns its report
    → Orchestrator dispatches reviewer → reviewer checks task files
    → Orchestrator re-dispatches task-writer with findings → it revises
    → Done — ready for task implementation
```

The task-writer is not the orchestrator. The orchestrator is expensive
and already did the hard thinking (spec + plan). The task-writer is a
cheaper subagent (`glm-5.2-high`) that takes the agreed plan and turns
it into concrete, executable tasks with a build order.

## Steps

1. **Build a context packet** for the plan:
   ```bash
   project-context context PLAN-NNN -t . -o .context-packet.json
   ```

2. **Optional parallel analysis.** For plans with multiple independent
   workstreams, dispatch up to four `workstream-analyst` profiles with
   `is_background: true`, one bounded workstream each. Every analyst is pinned to
   `glm-5.2-high` and read-only. Collect all results before continuing. Skip this
   fan-out for small plans or tightly coupled workstreams.

3. **Dispatch the task-writer** (foreground, `task-writer` profile,
   `is_background: false`). Give it the context packet path, the spec
   MD path, the plan MD path, `AGENTS.md` path, and the instruction to
   write and register tasks. The task-writer:
   - Reads the agreed spec and plan
   - Thinks through 2-3 implementation approaches per workstream, picks
     one (no `adhd` — the plan already decided the high-level approach)
   - Consults `graph/nodes/` and `graph/edges/` for file placement
   - Builds a dependency DAG that minimizes the critical path and exposes up to
     three safe implementation tasks per wave. It does not add dependencies merely
     to force a serial ID order.
   - **Registers each task via the CLI in topological order FIRST.** The CLI
     `add` command creates the MD file from the template AND appends
     the JSONL `created` event + plan timeline `queued` event in one
     step:
     ```bash
     project-context add --type task --title "<title>" --parent PLAN-NNN --dependencies "<TASK-NNN,... or none>" --status draft --skills "<skills>" --triggers "<triggers>" -t .
     ```
     The `skills` and `triggers` are stored in the JSONL record so the
     implementer knows what to load later. The task-writer does not
     load them. Register ALL tasks before editing any files — the CLI
     auto-assigns sequential IDs and the JSONL order IS the build order.
   - **Then edits the generated MD files** to fill in the detailed
     content — goal, relevant files, relevant symbols, required change,
     constraints, acceptance criteria, verification, do-not-touch. The
     CLI created each file from `TASK-NNN.template.md`; the task-writer
     uses `edit` to replace the template body with real content. Never
     `write` a TASK-NNN.md directly — the CLI `add` is the only thing
     that creates task files and JSONL records.
   Block on `read_subagent` to collect its report.

4. **Dispatch the reviewer** (foreground, `reviewer` profile,
   `is_background: false`). Give it:
   - The task file paths
   - The parent plan path
   - The spec path
   - `AGENTS.md` path
   - A 1-2 sentence context summary
   - The reviewer checks:
     - **Plan alignment**: does each task implement its workstream? All
       deliverables covered?
     - **Build order**: does the JSONL build order match the plan's
       workstream ordering?
     - **File placement**: do the cited file paths respect the project
       graph and dependency rules?
     - **Technical accuracy**: are cited APIs real? Are constraints
       correct?
     - **Format consistency**: does each task follow
       `TASK-NNN.template.md`? All required sections present?
     - **Rule compliance**: respects AGENTS.md constraints — no
       interface inflation, no skipped tests, documentation on exports,
       dependency rules?
     - **Internal consistency**: does the task contradict itself?
   Block on `read_subagent` to collect results.

5. **Apply reviewer findings.** If MUST-FIX issues remain, re-dispatch
   the task-writer (foreground, `is_background: false`) with the
   findings — it revises the task files and JSONL records. If MUST-FIX
   issues remain after one revision, escalate to the user.

6. **Commit.** Commit the task files and JSONL together. Tell the user
   to run `/pc-implement TASK-NNN` to start implementation (one at a
   time).

## Expected output

- Task files (`TASK-NNN.md`) — one per workstream, with exact file
  paths, symbols, constraints, and acceptance criteria.
- `data/tasks.jsonl` — the build order, one `created` event per task.
- `plans/PLAN-NNN.timeline.jsonl` — the per-plan timeline, one `queued`
  event per task.
- All reviewed by the reviewer and revised by the task-writer.

## Inputs

- The agreed spec (`specs/SPEC-NNN.md`)
- The agreed plan (`plans/PLAN-NNN.md`)
- The project graph (`graph/nodes/`, `graph/edges/`)
- `AGENTS.md` (project conventions and rules)
- `TASK-NNN.template.md` (for format reference)

## Outputs

- Task files (`tasks/TASK-NNN.md`) — one per workstream
- `data/tasks.jsonl` — the build order
- `plans/PLAN-NNN.timeline.jsonl` — the per-plan timeline
- All reviewed and committed

## Constraints

- No `adhd`. The plan already decided the approach. The task-writer
  thinks through concrete implementation details, not divergent ideation.
- Background analysts are optional, read-only, explicitly pinned, and limited to
  four. Never use a general/unpinned background subagent.
- The orchestrator does not write tasks — the task-writer subagent does.
  The orchestrator dispatches, collects results, and re-dispatches.
- No optimizer subagent. The task-writer writes; the reviewer checks.
- No skill loading. The task-writer records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them.
- No 3-round loop. One review pass. If MUST-FIX issues remain after one
  revision, escalate to the user.
- The task-writer is a subagent. It does not have conversation history.
  It reads the spec and plan files for context.
- The reviewer is read-only. It reports findings; the task-writer
  revises.
- Only one foreground task-writer may call `project-context add` or edit task
  files. Parallel analysts never mutate JSONL, timelines, or Markdown.
- One task file per workstream. If a workstream is large, split it into
  multiple tasks — but each task must be independently verifiable.
- The build order in JSONL is the queue. Tasks are built one at a time
  in this order.
