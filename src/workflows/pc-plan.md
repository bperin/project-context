# Workflow: pc-plan

`pc-plan` is the single user-facing workflow. It persists work in one compact
`PLAN-NNN.md` plus append-only task JSONL and resumes from those artifacts
without relying on conversation history.

## Actions

### `start <goal>`

1. Inspect persisted plans, task state, and `data/identity.json`. If
   `memoryLake.projectId` is present, load only relevant memory from that
   project before repository discovery.
2. Enforce the single-active-plan invariant. If any plan is non-terminal, do
   not create another; identify it and continue or finish it first.
3. Create one `PLAN-NNN.md`, record the goal, and set its first incomplete gate
   to repository discovery.
4. Run the planning gates in order until blocked by a user decision or explicit
   acceptance.

### `continue [PLAN-NNN]`

1. Resolve the supplied plan, or the sole non-terminal plan when no ID is given.
2. Read the plan file and task JSONL. Treat them as the authoritative recovery
   state. If configured, supplement them with MemoryLake results filtered to
   the exact `memoryLake.projectId`; never search across the workspace without
   that project filter.
3. Reconcile stale derived status from append-only task events.
4. Continue at the first incomplete gate. Do not repeat completed discovery,
   questions, acceptance, task creation, or verified packets.
5. Persist each completed gate before advancing.

### `status [PLAN-NNN]`

Read only. Report:

- plan ID, goal, status, revision, and current gate;
- explicit acceptance state;
- unresolved blocking questions;
- advisory questions and current assumptions;
- task counts by state, dependencies, and readiness;
- active implementation packets and declared write sets;
- proof obligations completed or outstanding;
- planning gaps, failed checks, and the exact next action.

### `run [PLAN-NNN]`

Resume exactly like `continue`, then keep executing gates and dependency-ready
task waves. Stop only when:

- the user must answer a blocking planning question;
- the revised plan needs explicit user acceptance;
- an implementer or challenger returns `needs_planning`;
- a required check still fails after its bounded correction pass;
- no safe dependency-ready packet exists; or
- the plan is complete.

`run` is persistent execution, not permission to invent missing scope.

## Single-active-plan invariant

At most one plan may have a non-terminal state. Terminal states are `done`,
`superseded`, and `archived`. `draft`, `committed`, `in_progress`, and
`needs_planning` are non-terminal. All actions enforce this invariant before
creating or mutating work.

If persisted state contains multiple non-terminal plans, stop and report the
conflict. Do not choose one silently.

## Ordered gates

The first incomplete gate is authoritative:

1. **Repository discovery** — read root instructions, relevant code, tests,
   interfaces, dependency edges, and current manager state.
2. **Compact draft** — capture goal, non-goals, repository evidence, approach,
   boundaries, acceptance probes, proof obligations, and likely decomposition.
3. **Self-challenge** — test assumptions, failure modes, scope, ownership,
   reversibility, and whether every acceptance claim is falsifiable.
4. **Questions** — use executable `grilling` and classify each question:
   - **Blocking:** persist it and halt before acceptance or task creation.
   - **Advisory:** persist the question and current assumption; continue.
5. **Revision** — update the same compact plan from evidence, challenges, and
   answers. Use `adhd` only for genuinely open-ended design.
6. **Explicit acceptance** — present the revised plan and wait for the user to
   accept it. Persist who accepted which revision, set the plan status to
   `committed`, and keep `User accepted: yes` in the Planning Gate. Any material
   later revision clears acceptance and returns here.
7. **Task decomposition** — create narrow, dependency-ordered packets.
8. **Implementation waves** — run ready packets with bounded concurrency.
9. **PR readiness** — verify state, evidence, checks, and scope cleanliness.
10. **Completion** — mark the plan terminal and archive only when requested or
    when the configured lifecycle calls for it.

The same root planning agent owns gates 1-7 and integrates all evidence.
Subagents may investigate independent questions or challenge a draft, but they
do not author the plan, ask the user, or mutate manager state.

## Project-scoped MemoryLake

The project-local Codex config declares the `memorylake` MCP endpoint. The
manager identity records the logical workspace and project names and may also
record their non-secret IDs. Credentials belong in Codex OAuth storage or the
process environment, never in the repository or manager files.

When `data/identity.json` contains `memoryLake.projectId`:

- every search must include that exact project ID;
- every fact, document, and conversation write must target that project;
- the root agent may read memory during discovery and resumption;
- only the root agent writes durable memory after an accepted decision,
  material revision, verified completion, or explicit user request; and
- subagents return proposed memory facts with evidence instead of writing them.

Store concise durable decisions, constraints, accepted assumptions, and
verified outcomes. Do not store secrets, credentials, raw chain-of-thought,
transient tool output, speculative ideas, or facts already contradicted by the
repository. The plan and task log remain authoritative for workflow state;
MemoryLake is supplemental cross-session context.

If only the project name is present, resolve exactly one matching project in
the configured workspace and persist its non-secret ID before using memory. If
zero or multiple projects match, report the setup gap and continue from local
manager state without a cross-project search.

## Compact plan contract

Keep each section short and decision-bearing:

- goal and non-goals;
- repository evidence;
- chosen approach and material rejected alternatives;
- API, data, state, and ownership boundaries;
- blocking questions and resolution state;
- advisory questions and current assumptions;
- acceptance probes and proof obligations;
- decomposition constraints and dependency order;
- current gate, revision, acceptance receipt, and planning-gap returns.

There are no epic or specification artifacts. Put code-level execution detail in
task packets rather than growing the plan.

## Narrow task packet contract

Every task contains:

- exact files and symbols it may change;
- API/data/state boundaries;
- dependencies and readiness conditions;
- do-not-touch files, symbols, and behaviors;
- success, failure, and boundary tests;
- verification commands;
- falsifiable proof obligations;
- conditions that require `needs_planning`.

Register tasks and state transitions through internal CLI mechanics so JSONL
history remains append-only. The root agent is the only manager-state writer.

## Implementation waves

Many subagents may complete work over the life of a plan. At most three may run
simultaneously, and only when their dependencies are done and their exact write
sets are disjoint. Overlapping, shared, or unknown ownership forces sequential
execution.

For each ready packet:

1. Build a compact context packet containing only project instructions, the
   parent-plan summary, task contract, dependencies, and selected implementation
   skills.
2. Persist `in_progress` serially.
3. Dispatch one pinned Luna-high implementer. It may change only its declared
   files and symbols and must run its specified tests.
4. If work exceeds the packet, contradicts a boundary, changes dependencies, or
   invalidates a proof obligation, the implementer stops and returns
   `needs_planning` with evidence. It never asks the user or expands scope.
5. Dispatch exactly one challenger for the completed packet. It checks scope,
   tests, edge cases, and proof evidence. It returns `pass`, bounded defects, or
   `needs_planning`.
6. Allow one correction pass for bounded implementation defects. Never correct
   a planning gap inside implementation.
7. Verify the integrated wave, commit once, and append completion states
   serially.

When `needs_planning` occurs, halt affected and dependent packets. Persist the
failed obligation, repository evidence, blocked boundary, and smallest required
decision. The root agent revises the same plan, asks the user only if blocking,
clears acceptance for material changes, and regenerates affected packets.

## PR readiness and completion

After all packets are done:

1. Run configured project checks.
2. Confirm every task is `done`, every proof obligation has evidence, and no
   plan or task is `needs_planning`.
3. Reject undeclared file/symbol changes, transient context files, debug
   artifacts, and accidental manager-state edits.
4. Open the PR with the plan goal, completed packets, and verification summary.
   Do not repeat code review; every packet already had one challenger.
5. Persist completion. Keep append-only task history intact.

## Internal mechanics

Context generation, UUID creation, task registration, readiness selection,
status transitions, graph rebuilding, inspection, synchronization, and archive
operations are internal CLI details used by this workflow. They are not separate
user-facing slash commands or skills.
