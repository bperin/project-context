# Workflow: Plan

## Model separation

The top-level `/pc-plan` skill is a lightweight orchestrator. It loads `adhd`
once for divergent ideation on the original user input, then dispatches the
custom `planning-brain`, pinned to `gpt-5.6-sol-medium`, for problem framing,
scope, tradeoffs, and architecture. This avoids relying on or inheriting the root
session model.

| Work | Who | Model |
|---|---|---|
| Divergent ideation on original input | orchestrator loads `adhd` skill | top-level |
| Scope and architecture decisions | `planning-brain` subagent | `gpt-5.6-sol-medium` |
| Write specification | `spec-writer` subagent | `glm-5.2-high` |
| Write implementation plan | `plan-writer` subagent | `glm-5.2-high` |
| Review either artifact | `reviewer` subagent | `swe-1.7-medium` |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. **Load `adhd` once** (`skill invoke adhd`). Use it to think about the original
   user input from multiple cognitive frames (regulator, speedrunner, $0 budget,
   10-year-old, biology). This is the only time `adhd` runs in the entire
   workflow. Do not run it again for the plan, tasks, or implementation.
2. Dispatch pinned `planning-brain` in the foreground with the request, repository
   context, and the ADHD ideation output. Ask for a concise specification
   decision brief.
3. Collect its problem, users, behavior, boundaries, constraints, chosen scope,
   rejected alternatives, criteria, and open questions.
4. Dispatch pinned `spec-writer` in the foreground with the brief, root
   `AGENTS.md`, and template. It registers and writes the specification.
5. Dispatch pinned `reviewer` once. Give it only the spec file and this
   exact criteria list:
   - Every desired behavior maps to a measurable success criterion
   - Out of Scope is present and honest
   - No internal contradictions
   - All template sections present
   Nothing else. No AGENTS.md, no codebase access.
6. If objectively blocked, re-dispatch `spec-writer` once, then confirm only the
   original findings. If one remains, ask the user instead of looping.
7. **Hard stop:** present the specification and wait for approval.

## Phase 2: Implementation plan

8. Dispatch pinned `planning-brain` again with the approved spec and graph. Ask
   for a concise architecture brief covering approach, boundaries, dependencies,
   dependency DAG, critical path, candidate parallel waves of at most three,
   risks, migration, and verification strategy.
9. Dispatch pinned `plan-writer` in the foreground with the approved spec,
   architecture brief, graph, root `AGENTS.md`, and template.
10. Dispatch pinned `reviewer` once. Give it only the plan file and spec
   file and this exact criteria list:
   - Every spec behavior has a workstream
   - Workstreams ordered so none depends on a later one
   - Completion criteria are objectively verifiable
   - No forbidden dependencies
   Nothing else.
11. If objectively blocked, re-dispatch `plan-writer` once, then confirm only the
    original findings. If one remains, ask the user.
12. **Hard stop:** present the plan and wait for approval.
13. After approval, mark and commit the spec and plan. Task creation is a separate
    `/pc-create-tasks` invocation.

## Constraints

- `adhd` runs ONCE, by the orchestrator, before the spec. Never again.
- Pinned SOL makes decisions; pinned GLM writers create Markdown artifacts.
- Pinned SWE reviews without expanding scope.
- Subagents run sequentially and in the foreground.
- One correction pass per artifact.
- No implementation or task creation during planning.
