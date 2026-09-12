# Workflow: Task

## When

After the plan is reviewed and committed. The plan-workflow exits here.
The orchestrator dispatches a different agent — the task-writer
subagent (`task-writer` profile, `glm-5.2-high`) — to pick up with the
agreed spec and plan in hand. It has full context of the plan (it reads
the spec and plan files) but is not the orchestrator that wrote them.

## Pattern

Dispatch-write-review. The orchestrator dispatches the task-writer
subagent, which reads the agreed spec and plan, thinks through a few
implementation approaches for each workstream, consults the project
graph to decide where code goes, writes the task files, then writes the
build order into JSONL. Then the orchestrator dispatches the reviewer
and re-dispatches the task-writer for revisions. All linear.

```
Orchestrator dispatches task-writer subagent
    → Task-writer reads agreed spec + plan
    → Task-writer thinks through implementation approaches for each workstream
    → Task-writer consults the project graph (graph/nodes, graph/edges) for file placement
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
   node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
   ```

2. **Dispatch the task-writer** (foreground, `task-writer` profile,
   `is_background: false`). Give it the context packet path, the spec
   MD path, the plan MD path, `AGENTS.md` path, and the instruction to
   write and register tasks. The task-writer:
   - Reads the agreed spec and plan
   - Thinks through 2-3 implementation approaches per workstream, picks
     one (no `adhd` — the plan already decided the high-level approach)
   - Consults `graph/nodes/` and `graph/edges/` for file placement
   - Writes one `TASK-NNN.md` per workstream following
     `TASK-NNN.template.md` — each task specifies parent plan ID, goal,
     relevant files, relevant symbols, required change, constraints,
     acceptance criteria, verification, do-not-touch
   - Registers each task via the CLI in build order:
     ```bash
     node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --parent PLAN-NNN --status draft --skills "<skills>" --triggers "<triggers>" -t .
     ```
     The `skills` and `triggers` are stored in the JSONL record so the
     implementer knows what to load later. The task-writer does not
     load them.
   Block on `read_subagent` to collect its report.

3. **Dispatch the reviewer** (foreground, `reviewer` profile,
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

4. **Apply reviewer findings.** If MUST-FIX issues remain, re-dispatch
   the task-writer (foreground, `is_background: false`) with the
   findings — it revises the task files and JSONL records. If MUST-FIX
   issues remain after one revision, escalate to the user.

5. **Commit.** Commit the task files and JSONL together. Tell the user
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
- One task file per workstream. If a workstream is large, split it into
  multiple tasks — but each task must be independently verifiable.
- The build order in JSONL is the queue. Tasks are built one at a time
  in this order.
