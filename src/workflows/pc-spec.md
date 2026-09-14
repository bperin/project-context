# Workflow: pc-spec

## Model separation

The top-level `/pc-spec` skill is a lightweight orchestrator. It dispatches
the `planning-brain` (`deepseek-4.1-flash-high`), which loads `adhd` for
divergent ideation, then writes the spec and plan directly. No separate
writer subagents — the planning-brain thinks and writes in one
continuous context.

| Work | Who | Model |
|---|---|---|
| ADHD ideation + write spec | `planning-brain` subagent (loads `adhd`) | `deepseek-4.1-flash-high` |
| ADHD ideation + write plan | `planning-brain` subagent (loads `adhd`) | `deepseek-4.1-flash-high` |
| Review spec | `reviewer` subagent (spec criteria) | `swe-2-high` |
| Review plan | `reviewer` subagent (plan criteria) | `swe-2-high` |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. Dispatch pinned `planning-brain` in the foreground with:
   - **Phase: SPEC** — tell it this is the spec phase
   - The request and repository context
   - **If refining an epic item:** the epic file and the specific item

   The planning-brain loads `adhd` for divergent ideation about the
   problem, then writes the spec directly. Register via CLI, edit the
   generated file.

2. Dispatch pinned `reviewer` with **spec review criteria**:
   - Is the problem clear? What we're building and why?
   - Are the users identified?
   - Is the scope honest? Is out-of-scope present?
   - Are there contradictions?
   - Are success criteria measurable?
   - Is anything obviously missing that a 10-year-old would notice?
   - All template sections present?
   Nothing else. No AGENTS.md, no codebase access.

3. **Reviewer fixes directly.** The reviewer has write access and
   fixes issues in the spec file itself. No re-dispatch.

4. **Hard stop:** present the specification and wait for approval.

   **If refining an epic item:** after approval, update the epic MD:
   set the item's `Status` to `specced` and `Spec` to the new SPEC-NNN ID.

## Phase 2: Implementation plan

5. Re-dispatch `planning-brain` (foreground) with:
   - **Phase: PLAN** — tell it this is the plan phase
   - The full spec content in the task prompt (fresh subagent, no memory)
   - The architecture brief from phase 1 if available

   The planning-brain loads `adhd` again for divergent ideation about
   the implementation approach, then writes the plan directly.
   Register via CLI, edit the generated file.

6. Dispatch pinned `reviewer` with **plan review criteria**:
   - Every spec behavior maps to a workstream
   - Workstreams ordered so none depends on a later one
   - Completion criteria are objectively verifiable
   - No forbidden dependencies
   - Risks identified
   - Verification strategy present
   - All template sections present?
   Nothing else.

7. **Reviewer fixes directly.** The reviewer has write access and
   fixes issues in the plan file itself. No re-dispatch.

8. **Hard stop:** present the plan and wait for approval.

9. After approval, mark and commit the spec and plan. Task creation is a
   separate `/pc-create-tasks` invocation.

## Constraints

- `adhd` is loaded by `planning-brain` in both spec and plan phases.
  Not loaded during task writing — tasks are concrete.
- `planning-brain` writes specs and plans directly — no separate writer subagents.
- Reviewer gets different criteria per artifact type — spec review is
  high-level, plan review verifies spec coverage.
- Subagents run sequentially and in the foreground.
- One correction pass per artifact.
- No implementation or task creation during planning.
