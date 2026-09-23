# Agent Protocol

> **Generated workspace.** Update framework files through the project-context
> upgrade path. Plans and tasks are living Markdown. Task history is append-only
> JSONL and changes only through internal project-context mechanics.

Read the repository root `AGENTS.md` first. It is the source of truth for
project structure, commands, conventions, and boundaries.

## One user-facing workflow

Use only `/pc-plan`:

```text
/pc-plan start <goal>
/pc-plan continue [PLAN-NNN]
/pc-plan status [PLAN-NNN]
/pc-plan run [PLAN-NNN]
```

- `start` creates a plan only when no non-terminal plan exists.
- `continue` restores persisted state and resumes at the first incomplete gate.
- `status` reports persisted state without mutation.
- `run` resumes and executes safe work until a user gate, planning gap, hard
  failure, or completion.

Do not expose separate slash commands for context, task creation,
implementation, review, inspection, UUIDs, archive, epics, or specifications.
Those operations are internal mechanics of `pc-plan`.

## Canonical state

The only artifact hierarchy is:

```text
plans/PLAN-NNN.md
└── tasks/TASK-NNN.md
```

`data/tasks.jsonl` is append-only task history.
`plans/PLAN-NNN.timeline.jsonl` is append-only plan execution history.
The plan file records goal, evidence, decisions, questions, acceptance, current
gate, and planning-gap returns.

At most one plan may be non-terminal. `done`, `superseded`, and `archived` are
terminal. `draft`, `committed`, `in_progress`, and `needs_planning` are
non-terminal. Explicit acceptance sets status to `committed` while the Planning
Gate records `User accepted: yes`. If multiple non-terminal plans exist, stop
and report the conflict.

## Planning

The root planning agent owns this loop:

```text
repository discovery → compact draft → self-challenge
→ blocking/advisory questions → revision → explicit user acceptance
→ narrow task decomposition
```

Every plan starts with a **Human Summary** in plain language: what changes, why
it matters, the user-visible outcome, and the main tradeoff. The technical
contract follows in the same file so the two views cannot drift.

Every plan records a grilling decision tree before acceptance. Use executable
`grilling`; `grill-me` is only its wrapper. Record settled decisions, remaining
frontier, and every blocking or advisory question in the plan.

Run `adhd` for open-ended product, architecture, workflow, API, or integration
decisions. Record its pre-flight result, divergent frames, shortlisted
alternatives, rejected traps, and selected direction. A closed factual or
mechanical change may skip the full ADHD run only with a specific rationale in
the plan. Blocking questions halt acceptance and task creation.

Persist every completed gate in the plan before advancing. Resume from the plan
file and task JSONL, not conversation memory. Material plan revisions clear
acceptance and require explicit re-acceptance.

## Project memory

Read `data/identity.json` before using MemoryLake. Every search or write must be
scoped to the exact `memoryLake.projectId`; never search the whole workspace
without that filter. MemoryLake supplements the plan and task log—it does not
replace their authoritative workflow state.

The root agent may store concise accepted decisions, durable constraints, and
verified outcomes. Subagents only return proposed memory facts with evidence.
Never persist credentials, secrets, raw chain-of-thought, transient tool output,
or unverified speculation. Codex OAuth storage or process environment variables
hold credentials; repository files contain only non-secret endpoint and project
metadata.

## Task packets and implementation

Every packet names exact files and symbols, boundaries, dependencies,
do-not-touch constraints, tests, verification commands, proof obligations, and
planning-gap conditions.

## Repository integration and branches

The manager is the shared planning authority and remains on `dev`. Each code
repository uses a short-lived `codex/plan-NNN-<workstream>` branch from its own
`dev` for one dependency-ready wave, then merges the verified workstream back
independently. Use worktrees only for concurrent code checkouts; never create a
cross-repository or manager worktree.

Many implementation subagents may run over a plan's lifetime. At most three run
simultaneously, only on dependency-ready packets with disjoint exact write sets.
Workers never commit, mutate manager state, ask the user, load planning skills,
or expand scope.

If a packet is incomplete or contradictory, the worker stops and returns
`needs_planning` with evidence. The root agent revises the existing plan and
affected packets. Exactly one challenger reviews each completed packet.

Commits, integrated checks, and manager-state transitions remain serial.

## Skill discovery

The generated manager exposes only `.agents/skills/pc-plan/SKILL.md` as its
project-context workflow skill. Shared user skills live under
`~/.agents/skills/skills/`. Clients that do not discover the project-root
`.agents` symlink must receive the explicit manager skill/profile paths and the
shared user-skills path.

See `workflows/pc-plan.md` for the complete persisted lifecycle and
`workflows/overview.md` for its compact map.
