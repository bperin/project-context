# Workflow: Plan

## Model separation

The top-level `/pc-plan` skill is a lightweight orchestrator. It dispatches the
custom `planning-brain`, pinned to `gpt-5.6-sol-medium`, for problem framing,
scope, tradeoffs, and architecture. This avoids relying on or inheriting the root
session model.

| Work | Profile | Model |
|---|---|---|
| Scope and architecture decisions | `planning-brain` | `gpt-5.6-sol-medium` |
| Write specification | `spec-writer` | `glm-5.2-high` |
| Write implementation plan | `plan-writer` | `glm-5.2-high` |
| Review either artifact | `reviewer` | `swe-1.7-medium` |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. Dispatch pinned `planning-brain` in the foreground with the request and
   repository context. Ask for a concise specification decision brief.
2. Collect its problem, users, behavior, boundaries, constraints, chosen scope,
   rejected alternatives, criteria, and open questions.
3. Dispatch pinned `spec-writer` in the foreground with the brief, root
   `AGENTS.md`, and template. It registers and writes the specification.
4. Dispatch pinned `reviewer` once for fidelity, testability, contradictions, and
   required sections—not prose preferences.
5. If objectively blocked, re-dispatch `spec-writer` once, then confirm only the
   original findings. If one remains, ask the user instead of looping.
6. **Hard stop:** present the specification and wait for approval.

## Phase 2: Implementation plan

7. Dispatch pinned `planning-brain` again with the approved spec and graph. Ask
   for a concise architecture brief covering approach, boundaries, dependencies,
   dependency DAG, critical path, candidate parallel waves of at most three,
   risks, migration, and verification strategy.
8. Dispatch pinned `plan-writer` in the foreground with the approved spec,
   architecture brief, graph, root `AGENTS.md`, and template.
9. Dispatch pinned `reviewer` once for fidelity, feasibility, dependency order,
   coverage, and objective completion criteria.
10. If objectively blocked, re-dispatch `plan-writer` once, then confirm only the
    original findings. If one remains, ask the user.
11. **Hard stop:** present the plan and wait for approval.
12. After approval, mark and commit the spec and plan. Task creation is a separate
    `/pc-create-tasks` invocation.

## Constraints

- Pinned SOL makes decisions; pinned GLM writers create Markdown artifacts.
- Pinned SWE reviews without expanding scope.
- Subagents run sequentially and in the foreground.
- One correction pass per artifact.
- No implementation or task creation during planning.
