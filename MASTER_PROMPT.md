# MASTER_PROMPT.md — project-context product contract

Build and maintain `project-context`, an npm package that installs a durable,
resumable planning and execution workspace into an existing repository.

## Canonical artifact model

The generated hierarchy has two artifact types:

```text
PLAN-NNN
└── TASK-NNN
```

Do not generate epics or separate specifications. A plan is compact and carries
the goal, repository evidence, decisions, questions, architecture boundaries,
acceptance probes, proof obligations, task strategy, acceptance receipt, and
resume checkpoint. A task is a narrow implementation contract.

Task state is append-only JSONL. Plan execution has an append-only timeline.
Markdown is living state and may be revised by the root workflow.

## Single generated workflow skill

Expose only:

```text
/pc-plan start <goal>
/pc-plan continue [PLAN-NNN]
/pc-plan status [PLAN-NNN]
/pc-plan run [PLAN-NNN]
```

- `start` rejects creation when any non-terminal plan exists.
- `continue` loads the plan and task JSONL and resumes at the first incomplete
  gate.
- `status` reports durable state without mutation.
- `run` resumes and continues safe work until a user gate, planning gap, failed
  hard check, or completion.

Context, UUID, add, update, status, readiness, graph, inspect, sync, review, and
archive operations are internal CLI mechanics. Do not expose them as generated
workflow skills.

## Planning algorithm

One root planning agent owns:

1. repository discovery;
2. a compact draft;
3. self-challenge;
4. blocking and advisory user questions;
5. revision;
6. explicit user acceptance;
7. narrow task decomposition; and
8. integration and manager-state transitions.

Use executable `grilling` for planning questions. `grill-me` is only a wrapper.
Use `adhd` only when design is genuinely open-ended. Blocking questions halt
acceptance and task creation. Advisory questions are recorded with the current
assumption and do not halt.

Persist every completed gate. Material plan revisions clear acceptance. A fresh
session must recover entirely from the plan and task event log.

## Single-active-plan invariant

At most one plan may be non-terminal. Terminal states are `done`, `superseded`,
and `archived`. When multiple non-terminal plans are detected, stop and report
the conflict rather than choosing silently.

Non-terminal plan states are `draft`, `committed`, `in_progress`, and
`needs_planning`. Explicit user acceptance sets status to `committed`; the
Planning Gate separately records `User accepted: yes`.

## Task packet contract

Every task declares:

- exact files and symbols;
- API, data, state, and ownership boundaries;
- dependencies and readiness conditions;
- do-not-touch constraints;
- success, failure, and boundary tests;
- verification commands;
- falsifiable proof obligations; and
- conditions that require `needs_planning`.

An implementer executes the packet. It does not question the user, make a new
product or architecture decision, widen the write set, commit, or mutate manager
state.

If implementation requires undeclared scope, contradicts a boundary, changes a
dependency, or invalidates a proof obligation, stop and return
`needs_planning`. Include the failed obligation, repository evidence, blocked
boundary, and smallest required decision. The root agent revises the same plan
and affected packets before execution resumes.

## Multi-agent execution

The plan may use many writers over time. Run no more than three simultaneously,
and only for dependency-ready packets with exact, disjoint write sets. Shared,
unknown, or overlapping ownership is sequential.

Each completed packet receives exactly one challenger review for scope,
correctness, tests, edge cases, and proof evidence. Permit one bounded correction
pass for implementation defects. Planning gaps bypass correction and return to
the root workflow. Commits, integrated checks, and manager-state writes are
serial.

## Generated assets

The source assets must produce:

```text
.<repository>-manager/
├── AGENTS.md
├── .agents/
│   ├── AGENTS.md
│   └── skills/pc-plan/SKILL.md
├── workflows/
│   ├── pc-plan.md
│   └── overview.md
├── templates/
│   ├── PLAN-NNN.template.md
│   └── TASK-NNN.template.md
├── plans/
├── tasks/
├── data/tasks.jsonl
└── graph/
```

Framework files are updated through the normal upgrade path. Project-specific
content is created in the target repository, not shipped in this package.

## Acceptance requirements

- Only `pc-plan` is generated as a workflow skill.
- The PLAN+TASK hierarchy is used consistently in docs and generated assets.
- Start, continue, status, and run are persisted actions over one state machine.
- One non-terminal active plan is enforced.
- Resume starts at the first incomplete gate.
- Blocking and advisory questions have different behavior.
- Task packets are narrow and machine-checkable.
- At most three disjoint ready writers run concurrently.
- Every packet has one challenger review.
- Planning gaps produce `needs_planning` and return to the root agent.
- Append-only history is never rewritten.
