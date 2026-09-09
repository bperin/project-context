# Agent Protocol

> The single source of truth for project conventions, skill-gated implementation,
> testing rules, Godoc rules, and module structure is the root
> [`AGENTS.md`](../AGENTS.md). This file defines the development workflow protocol
> only. Do not duplicate conventions here — update the root `AGENTS.md` instead.

## Session start

1. **Read identity first.** Read the root [`AGENTS.md`](../AGENTS.md) to
   understand what the project is, its modules, and the dependency rule.
2. **Load always-on skills.** `go-systems-programmer`, `go-security-expert`,
   `go-memory-oom-guard` — load in parallel at session start. See the
   Skill-Gated Implementation section in root `AGENTS.md`.
3. **Consult architecture.** Read
   [`Go Trust & Security Platform — Architecture Specification.md`](../Go%20Trust%20%26%20Security%20Platform%20—%20Architecture%20Specification.md)
   for the full architecture.
4. **Inspect state.** Read `.ai-trust/context/state/current.md` and
   `.ai-trust/STATE.md` for the current execution state. Read
   `.ai-trust/DECISIONS.md` for decision history.
5. **Inspect active specs.** Read the specs in `.ai-trust/context/specs/`
   that are not superseded.
6. **Inspect active plans.** Read the plan in `.ai-trust/context/plans/`
   that is not superseded.
7. **Follow workflows.** Every phase has a workflow. Do not skip them.

## Workflows

Workflows are markdown files in `.ai-trust/context/workflows/`. They define
the steps for each phase. The agent reads the workflow and follows it — there
is no automated runner.

| Workflow | File | When |
|----------|------|------|
| Spec creation | `workflows/spec-creation.md` | After a spec is written or revised, before commit |
| Plan creation | `workflows/plan-creation.md` | After a plan is written, before implementation starts |
| Task creation | `workflows/task-creation.md` | After a task file is written, before implementation starts |
| Task implementation | `workflows/task-implementation.md` | When a task moves from `todo` to `in_progress` — full pipeline: primary → secondary → code reviewer → testing agent |
| PR review | `workflows/code-review.md` | Before any PR from `dev` to `master` |

### The lifecycle

```
SPEC written → spec-creation workflow (writer-critic-blind) → spec committed
     ↓
PLAN written → plan-creation workflow (writer-critic-blind) → plan committed
     ↓
TASK written → task-creation workflow (writer-critic-blind) → task committed
     ↓
TASK implemented → task-implementation workflow → task done
  (primary codes → secondary reviews+fixes → code reviewer reviews → testing agent writes full suite)
     ↓
All tasks done → PR dev → master → code-review workflow → merge
```

No phase skips the review step. No spec, plan, task, or code is committed
without passing its creation workflow. Spec, plan, and task creation all
use the writer-critic-blind pattern (max 3 rounds, then escalate to the
user). The implement workflow is an assembly line: primary implements,
secondary reviews with a different skill lens, code reviewer checks
against rules, testing agent writes the full test suite. When all tests
pass, the task is done.

### Where skills attach

Skills attach at the **point of use**, not the point of planning:

- **Task implementation** (`task-implementation.md`): primary loads the
  algorithm's primary skill; secondary loads the secondary skill; code
  reviewer loads `go-code-review`; testing agent loads `golang-testing`
  (+ `wycheproof` if applicable).
- **Task creation** (`task-creation.md`): writer loads the primary
  skill before writing the task file, so the spec is shaped by the
  skill. Writer also loads `adhd` for divergent ideation.
- **Spec creation** (`spec-creation.md`): writer loads `adhd` for
  divergent ideation before writing the spec.
- **Plan creation** (`plan-creation.md`): writer loads `adhd` for
  divergent ideation before writing the plan.
- **PR review** (`code-review.md`): loads `go-code-review`.
- **Always-on** (every workflow): `go-systems-programmer`,
  `go-security-expert`, `go-memory-oom-guard`.

Spec, plan, and task creation workflows do **not** load algorithm
skills (except the task writer loads the primary skill for the task's
algorithm). They reference `algorithms.json` to list which skills each
workstream will use, but the skills load when the workstream's tasks
execute — not when the plan is written. The `adhd` skill loads at the
writer stage to explore the design space before committing to an
approach. This keeps context lean.

## Building a plan

When building a `PLAN-NNN.md`:

1. Read the relevant SPEC(s) that the plan implements.
2. For each workstream that implements an algorithm, consult the
   algorithm-to-skill matrix in `trust/algorithms.json` (the `skill` field
   on each algorithm entry). List the primary and secondary skills the
   workstream will load.
3. Confirm skills are installed (`.agents/skills/` for project-local, or
   user-level). If missing, install before starting the workstream.
4. Do not load all skills at once — load only what the current workstream
   needs. This keeps context lean.
5. Each workstream task cites the governing standard from the algorithm's
   `godoc_citation` field.
6. Run the plan-creation workflow before committing the plan.

## During implementation

Follow the task-implementation workflow (`workflows/task-implementation.md`):

1. Load the algorithm's primary skill (from `algorithms.json`). Follow
   its guidance — do not guess at crypto or auth.
2. Write Godoc comments citing the standard (see Godoc Rules in root
   `AGENTS.md`).
3. Write initial tests — just enough to get green (known-answer vector,
   round-trip). The full test suite comes from the testing agent after
   code review.
4. Run `go build`, `go vet`, `go test -race`, `gofmt -l .` before
   spawning the secondary implementer.
5. Spawn the secondary implementer (foreground, write access, different
   skill lens). It fixes issues directly.
6. Spawn the code reviewer (background, `go-code-review` skill, no
   context). It checks the code against project rules.
7. When code review passes, spawn the testing agent (background, write
   access, `golang-testing` skill). It writes the full test suite —
   known vectors, Wycheproof, fuzz, examples, negative and boundary
   tests per the tier rules. When all tests pass, the task is done.
8. Humanize the commit message with the `content-humanizer` skill before
   committing. Cite the standard in the commit body.
