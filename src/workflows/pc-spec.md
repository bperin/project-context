# Workflow: pc-spec

## Root-owned planning

The top-level Codex agent is the planning brain. It owns the product decision,
the specification, the implementation plan, and the synthesis of all evidence.
It may load `grill-me` and `adhd` as skills when their methods fit the problem,
but it does not delegate dependent planning or document authorship to another
agent. This avoids lossy context handoffs and keeps one decision-maker
accountable.

| Work | Who | Model |
|---|---|---|
| Grill user | `grill-me` skill | — |
| Write and self-review spec | Root coordinator | current session |
| Write and self-review plan | Root coordinator | current session |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. **Load `grill-me` skill.** Interrogate the user about the problem:
   - What are we building and why?
   - Who is it for?
   - What's the scope?
   - What are the constraints?
   Grill until decision tree is resolved.

2. The root coordinator writes the specification directly from the resolved
   decision tree and repository evidence. A subagent may only perform a bounded
   independent challenge; the root coordinator reconciles its findings.

3. **Hard stop:** present the specification and wait for approval.

   **If refining an epic item:** after approval, update the epic MD:
   set the item's `Status` to `specced` and `Spec` to the new SPEC-NNN ID.

## Phase 2: Implementation plan

4. The root coordinator writes the implementation plan directly from the
   approved specification, assigning exclusive file ownership, dependencies,
   validation, and implementation runtime to every workstream.

5. **Hard stop:** present the plan and wait for approval.

6. After approval, mark and commit the spec and plan. Task creation is a
   separate `/pc-create-tasks` invocation.

## Constraints

- `grill-me` is loaded first to interrogate the user — reduces the
  need for separate reviewer handoffs
- `adhd` is optional and is used by the root coordinator only for genuinely
  open-ended design or architecture decisions
- A subagent may investigate or challenge an independent question, but never
  owns the specification, plan, or their final integration
- No implementation or task creation during planning
