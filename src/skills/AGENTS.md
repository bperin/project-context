# Shared Instructions for Generated Skills

Every generated skill reads this file before acting. `pc-plan` is the only
generated project-context workflow skill.

## User surface

```text
/pc-plan start <goal>
/pc-plan continue [PLAN-NNN]
/pc-plan status [PLAN-NNN]
/pc-plan run [PLAN-NNN]
```

Do not advertise low-level lifecycle operations as skills or slash commands.
Task registration, context generation, readiness, status, graph, sync, UUID,
inspection, review, and archive commands are internal mechanics.

## Persistence and recovery

The durable hierarchy is `PLAN-NNN → TASK-NNN`. Restore state from the plan
Markdown and append-only task JSONL. Conversation history is never required for
resumption.

Each action first enforces one non-terminal active plan. With an omitted ID,
resolve the sole non-terminal plan; never guess among zero or multiple plans.
Continue and run always start at the first incomplete persisted gate.
Explicit user acceptance sets plan status to `committed`; the Planning Gate
separately records `User accepted: yes`.

## Authority

The root planning agent owns repository discovery, the compact plan,
self-challenge, user questions, revisions, acceptance, task decomposition,
integration, and all manager-state mutations.

Subagents may gather independent evidence, implement a narrow ready packet, or
challenge one completed packet. They do not own dependent planning or user
interaction.

## Planning methods

`grilling` is executable and planning-only; `grill-me` is its wrapper. `adhd` is
planning-only and reserved for genuinely open-ended design. Blocking questions
halt task creation. Advisory questions and current assumptions remain in the
plan without blocking.

The plan's Human Summary is the canonical human-readable output. It explains
what changes, why, the user-visible outcome, and the main tradeoff before the
technical contract; do not create a second summary document.

## Project-scoped memory

MemoryLake is supplemental durable context. Read its project binding from
`data/identity.json`, and include the exact `memoryLake.projectId` in every
search or write. Never run an unfiltered workspace search. The root agent owns
memory writes; subagents return evidence-backed memory candidates only. Store
accepted decisions, durable constraints, and verified outcomes—not credentials,
raw reasoning, transient output, or speculation. Local plan and task state is
authoritative.

## Packet and concurrency rules

Each task packet declares exact files and symbols, boundaries, dependencies,
do-not-touch constraints, tests, verification commands, proof obligations, and
planning-gap conditions.

At most three implementation agents may run simultaneously. All active packets
must be dependency-ready and have disjoint exact write sets. Unknown or shared
ownership forces sequential execution. Many agents may run across successive
waves.

Implementers load only packet-selected implementation skills. They never ask
the user, load planning skills, expand scope, commit, or mutate manager state.
Missing or contradictory planning returns `needs_planning` with evidence. One
challenger reviews each completed packet; bounded defects receive one correction
pass, while planning gaps return directly to the root workflow.

## State safety

- JSONL is append-only; never rewrite prior events.
- Plan/task Markdown may be revised by the root workflow.
- Commits, checks over combined changes, and manager-state writes are serial.
- Persist a gate before advancing to the next one.
- A material plan revision clears acceptance.
- PR readiness requires all tasks done, proof evidence present, clean scope, and
  no unresolved `needs_planning` state.

Read `workflows/pc-plan.md` for the full algorithm.
