# Workflow: pc-spec

## Model separation

The top-level `/pc-spec` skill is a lightweight orchestrator. It dispatches
the `planning-brain` (`gpt-5.6-terra-high`), which loads `adhd` for
divergent ideation, then writes the spec and plan directly. No separate
writer subagents — the planning-brain thinks and writes in one
continuous context.

| Work | Who | Model |
|---|---|---|
| ADHD ideation + write spec | `planning-brain` subagent (loads `adhd`) | `gpt-5.6-terra-high` |
| Architecture brief + write plan | `planning-brain` subagent (same session) | `gpt-5.6-terra-high` |
| Review either artifact | `reviewer` subagent | `swe-2-high` |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. Dispatch pinned `planning-brain` in the foreground with the request and
   repository context. The planning-brain loads `adhd` for divergent ideation,
   then writes the spec directly. It registers via CLI and edits the generated
   file.

   **If refining an epic item:** include the epic file and the specific
   item to refine. The planning-brain uses the epic for context and the
   item as the scope. The resulting spec's `Dependencies` field points to
   the epic ID (e.g. `EPIC-001`).
2. Dispatch pinned `reviewer` once. Give it only the spec file and this
   exact criteria list:
   - Every desired behavior maps to a measurable success criterion
   - Out of Scope is present and honest
   - No internal contradictions
   - All template sections present
   Nothing else. No AGENTS.md, no codebase access.
3. If objectively blocked, re-dispatch `planning-brain` once with the
   findings, then confirm only the original findings. If one remains,
   ask the user instead of looping.
4. **Hard stop:** present the specification and wait for approval.

   **If refining an epic item:** after approval, update the epic MD:
   set the item's `Status` to `specced` and `Spec` to the new SPEC-NNN ID.

## Phase 2: Implementation plan

5. Re-dispatch the same `planning-brain` (foreground) for the architecture
   brief and plan. It has the spec in context from phase 1 — no re-reading
   needed. It **loads `adhd` again** for implementation approach ideation,
   then writes the plan directly. Register via CLI, edit the generated file.
6. Dispatch pinned `reviewer` once. Give it only the plan file and spec
   file and this exact criteria list:
   - Every spec behavior has a workstream
   - Workstreams ordered so none depends on a later one
   - Completion criteria are objectively verifiable
   - No forbidden dependencies
   Nothing else.
7. If objectively blocked, re-dispatch `planning-brain` once with the
   findings, then confirm only the original findings. If one remains,
   ask the user.
8. **Hard stop:** present the plan and wait for approval.
9. After approval, mark and commit the spec and plan. Task creation is a
   separate `/pc-create-tasks` invocation.

## Constraints

- `adhd` is loaded by `planning-brain`, not the orchestrator. Loaded
  in phase 1 (spec ideation) and phase 2 (implementation approach
  ideation). Not loaded during task writing — tasks are concrete.
- `planning-brain` writes specs and plans directly — no separate writer subagents.
- Pinned SWE reviews without expanding scope.
- Subagents run sequentially and in the foreground.
- One correction pass per artifact.
- No implementation or task creation during planning.
