---
name: pc-plan
description: "Single project-context entry point: start, resume, inspect, or run one PLAN-NNN through planning and bounded implementation."
argument-hint: "<start <goal> | continue [PLAN-NNN] | status [PLAN-NNN] | run [PLAN-NNN]>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
  - skill
  - run_subagent
  - read_subagent
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Write(**)
    - Edit(**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(go **)
    - Exec(git **)
---

> **Read the manager root [`AGENTS.md`](../../../AGENTS.md) first.** It defines
> persistence, authority, packet, concurrency, and state-transition rules.

`pc-plan` is the only user-facing project-context workflow skill. Follow
`workflows/pc-plan.md` for every action.

## Actions

- `start <goal>` — refuse if another non-terminal plan exists; otherwise create
  one compact plan and enter the planning loop.
- `continue [PLAN-NNN]` — reconstruct state from the plan file and task JSONL,
  then continue at the first incomplete gate. Ask only the blocking questions
  required by that gate.
- `status [PLAN-NNN]` — print persisted state, current gate, unresolved
  questions, task readiness, active workers, proof progress, and the next action.
  Do not mutate state.
- `run [PLAN-NNN]` — resume at the first incomplete gate and keep progressing
  through ready work. Stop for explicit plan acceptance, a blocking user
  decision, `needs_planning`, a failed hard check, or completion.

`run` selects and dispatches the maximal safe dependency-ready wave, up to
three workers with disjoint write sets. It does not leave a safe slot idle for
coordinator convenience; when fewer than three workers run, it records the
specific dependency, ownership, review, or planning constraint.

After a packet passes challenge, the coordinator—not a worker—runs integrated
checks, commits the repository branch, merges it into that repository's `dev`,
and immediately dispatches the next maximal safe wave. This repeats until no
safe packet remains or a defined stop gate applies.

When `run` dispatches a worker in Codex, it must supervise that worker to a
terminal report with bounded `wait_threads` calls. Reuse each returned cursor
as `afterCursor`; treat a timeout as non-terminal progress. Consume a builder
report before dispatching its challenger, and consume the challenger report
before integration, correction, a planning return, or a user-facing stop.

When an ID is omitted, resolve the sole non-terminal plan. Never guess when
zero or multiple candidates exist.

Before planning or resuming, read `data/identity.json`. When MemoryLake is
configured, use only the exact `memoryLake.projectId`; never perform an
unfiltered workspace search. The root agent owns durable memory writes and may
persist accepted decisions or verified outcomes. Subagents only return memory
candidates. Never store credentials, secrets, raw reasoning, or transient tool
output. Local plan and task state remains authoritative.

Low-level project-context CLI operations are internal mechanics. Do not send the
user to separate context, task, implementation, review, archive, inspect, UUID,
epic, or specification skills.

Planning records a `grilling` decision tree; `grill-me` is only its wrapper.
Use `adhd` only for genuinely open-ended design. Implementers never load
planning skills, question the user, or widen a packet. Missing planning returns
`needs_planning` to this root workflow, which performs the smallest required
in-scope revision before resuming.
