# Workflow: Task

## When

After the plan is reviewed and committed. The plan-workflow exits here.
A different agent — the task-writer — picks up with the agreed spec and
plan in hand. It has full context of the plan (it reads the spec and
plan files) but is not the orchestrator that wrote them.

## Pattern

Think-write-review. The task-writer reads the agreed spec and plan,
thinks through a few implementation approaches for each workstream,
consults the project graph to decide where code goes, writes the task
files, then writes the build order into JSONL. Then dispatches the
reviewer. All linear.

```
Task-writer reads agreed spec + plan
    → Task-writer thinks through implementation approaches for each workstream
    → Task-writer consults the project graph (graph/nodes, graph/edges) for file placement
    → Task-writer writes TASK-NNN.md files (one per workstream)
    → Task-writer writes the build order into data/tasks.jsonl
    → Task-writer writes the per-plan timeline into plans/PLAN-NNN.timeline.jsonl
    → Task-writer dispatches reviewer → reviewer checks task files
    → Task-writer revises based on findings
    → Done — ready for task implementation
```

The task-writer is not the orchestrator. The orchestrator is expensive
and already did the hard thinking (spec + plan). The task-writer is a
cheaper agent that takes the agreed plan and turns it into concrete,
executable tasks with a build order.

## Steps

1. **Read the agreed spec and plan.** Understand what was decided and
   why. The plan lists workstreams in order — each workstream becomes
   one task.

2. **Think through implementations.** For each workstream, consider 2-3
   implementation approaches. Pick one. Do not load `adhd` — the plan
   already decided the high-level approach. This is about concrete
   implementation details: which files to create, which symbols to
   define, which constraints apply.

3. **Consult the project graph.** Read `graph/nodes/` and `graph/edges/`
   to understand the existing code structure. Decide where new code
   goes — which module, which directory, which file. Respect existing
   module boundaries and dependency rules from `AGENTS.md`.

4. **Write the task files.** One `TASK-NNN.md` per workstream, following
   `TASK-NNN.template.md`. Each task specifies:
   - Parent plan ID
   - Goal (what this task accomplishes)
   - Relevant files (exact paths to create/modify)
   - Relevant symbols (functions, types, methods to define)
   - Required change (step-by-step what to do)
   - Constraints (what NOT to do, edge cases, security notes)
   - Acceptance criteria (objectively verifiable)
   - Verification (commands to run)
   - Do-not-touch (files/symbols that must not change)

5. **Write the build order into JSONL.** Register each task via the CLI
   in build order. This appends to `data/tasks.jsonl` and writes the
   plan timeline:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type task --title "<title>" --parent PLAN-NNN --status draft --skills "<skills>" --triggers "<triggers>" -t .
   ```
   The `skills` and `triggers` are stored in the JSONL record so the
   implementer knows what to load later. The task-writer does not load
   them.

6. **Dispatch the reviewer** (foreground, `reviewer` profile, `is_background: false`). Give it:
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

7. **Apply reviewer findings.** Revise the task files and JSONL. If
   MUST-FIX issues remain after one revision, escalate to the user.

8. **Commit.** Commit the task files and JSONL together. Tell the user
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
- No optimizer subagent. The task-writer writes; the reviewer checks.
- No skill loading. The task-writer records skills and triggers in
  the task MD and JSONL record, but does not load or invoke them.
- No 3-round loop. One review pass. If MUST-FIX issues remain after one
  revision, escalate to the user.
- The task-writer is not the orchestrator. It does not have conversation
  history. It reads the spec and plan files for context.
- The reviewer is read-only. It reports findings; the task-writer
  revises.
- One task file per workstream. If a workstream is large, split it into
  multiple tasks — but each task must be independently verifiable.
- The build order in JSONL is the queue. Tasks are built one at a time
  in this order.
