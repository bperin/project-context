# PLAN-NNN Instructions

This is the only durable planning artifact. There are no epics or separate
specifications. One root planning agent owns discovery, challenge, user
questions, revision, architecture, and task decomposition.

The plan serves humans and agents in one file. Start with a short plain-language
summary explaining what changes, why it matters, the user-visible outcome, and
the main tradeoff. Then use exact bullets, tables, file paths, symbols, and
commands for the implementation contract. Do not create a second summary
document or repeat repository facts that are not needed to bound implementation.
Keep the Resume Checkpoint current so `/pc-plan continue` can restart from disk
without relying on conversation history.

## Required planning loop

1. Inspect the repository and record evidence.
2. Draft the human summary, goal, boundaries, architecture, data/API ownership,
   and task strategy.
3. Challenge the draft for missing assumptions, unsafe boundaries, write-set
   conflicts, and unverifiable acceptance criteria.
4. Ask the user every blocking question in one round. Record non-blocking
   questions as advisory.
5. Revise the same plan. Do not create another planning layer.
6. Stop until the user accepts the plan and every blocking question is
   resolved. Then set plan status to `committed` and record `User accepted: yes`
   in the Planning Gate.
7. Create narrow tasks from the accepted plan.

Use executable `grilling` for the user-question loop. Use `adhd` only when the
design is genuinely open-ended and multiple materially different architectures
remain viable.

## Dispatch gate

Tasks are not ready unless the plan says self-challenge complete, blocking
questions resolved, and user accepted. A task must name an exact write set,
symbols, dependencies, boundaries, do-not-touch list, tests, verification, and
proof obligations.

If implementation exposes a missing decision, the worker halts. The task moves
to `needs_planning`, and this same planning agent revises the plan and task
before dispatch resumes.

## Anti-patterns

- Another epic, spec, roadmap, or planning document above or below this plan
- Long product prose repeated from the conversation
- Tasks that require an implementer to choose architecture or ask the user
- Unresolved blocking questions disguised as assumptions
- Broad write sets used to increase parallelism
