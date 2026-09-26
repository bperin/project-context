# Coordinator lifecycle: pc-plan

This is the coordinator-only reference behind the `/pc-plan` skill. Persist
progress in `PLAN-NNN.md` and append-only task JSONL; never rely on
conversation history for recovery.

## Actions

- `start <goal>` — refuse if another plan is non-terminal; otherwise create a
  compact plan and begin discovery.
- `continue [PLAN-NNN]` — resolve the supplied or sole non-terminal plan and
  resume its first incomplete gate.
- `status [PLAN-NNN]` — report persisted status, blockers, readiness, proof,
  and next action without mutation.
- `run [PLAN-NNN]` — continue through safe gates and task waves until a user
  gate, planning gap, failed required check, or completion.

## Gates

Persist each gate before advancing:

1. Discover repository instructions, relevant code, tests, dependencies, and
   manager state.
2. Draft one compact plan: goal, non-goals, evidence, approach, boundaries,
   acceptance probes, proof obligations, and likely task order.
3. Self-challenge with `grilling`; use `adhd` only for genuinely open-ended
   product, architecture, workflow, API, or integration choices. Record the
   decision, alternatives, traps, and remaining questions.
4. Record blocking questions and stop; record advisory questions with their
   current assumptions and continue.
5. Revise from evidence and answers. A material revision clears acceptance.
6. Obtain explicit user acceptance, mark the plan `committed`, and record
   `User accepted: yes`.
7. Create narrow tasks with exact write sets, boundaries, dependencies, tests,
   verification commands, proof obligations, and planning-gap conditions.
8. Dispatch the largest ready disjoint wave, up to three writers. Supervise
   each writer and then exactly one challenger to a terminal report.
9. On challenge pass, run combined checks, serially commit and merge the
   repository workstream, then fill the next safe worker slot.
10. Complete only after every task and proof obligation has evidence.

## Packet and skill rules

Build a deterministic task packet only when its contract is complete. The
packet includes exact source paths, graph nodes, a source fingerprint, compact
parent summary, and selected canonical skill references. It never includes full
task or parent bodies. A missing required contract field or selected skill
returns `needs_planning` before dispatch.

Canonical shared skills live at
`/Users/brian/.agents/skills/<skill-name>/SKILL.md`. `data/skills.json` records
names, layers, triggers, and purpose—not copied skill content. For Next.js,
select `vercel-react-best-practices`; `typescript-magician` is opt-in for
`type-system` work and `code-review-excellence` for `pr-review`.

## Planning-gap and memory rules

When a worker returns `needs_planning`, halt affected work, preserve the
evidence, and revise the smallest affected plan/task boundary from accepted
decisions and repository evidence. Ask the user only for external authority, a
product-scope change, or an irreducible choice.

Read `data/identity.json` before MemoryLake use. Scope every operation to the
exact `memoryLake.projectId`; store only accepted decisions, durable
constraints, and verified outcomes; never search an unfiltered workspace. The
root agent alone writes durable memory.
