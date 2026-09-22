# Workflow: pc-spec

## Model separation

The top-level `/pc-spec` skill is a lightweight orchestrator. It:
1. Loads `grill-me` to interrogate the user about the problem
2. Dispatches `planning-brain` (`openai-terra-5.6-high`) with `adhd` for
   divergent ideation (which serves as self-review), then writes the spec
3. For plan: same `planning-brain` with `adhd`, writes plan
4. No separate reviewer subagents — ADHD serves as self-review

| Work | Who | Model |
|---|---|---|
| Grill user | `grill-me` skill | — |
| ADHD ideation + write spec | `planning-brain` (loads `adhd`) | `openai-terra-5.6-high` |
| ADHD ideation + write plan | `planning-brain` (loads `adhd`) | `openai-terra-5.6-high` |

Never use an unpinned or general subagent in this workflow.

## Phase 1: Specification

1. **Load `grill-me` skill.** Interrogate the user about the problem:
   - What are we building and why?
   - Who is it for?
   - What's the scope?
   - What are the constraints?
   Grill until decision tree is resolved.

2. Dispatch pinned `planning-brain` (`openai-terra-5.6-high`) in the
   foreground with:
   - **Phase: SPEC**
   - The grill-me findings (the resolved decision tree)
   - Repository context
   - **If refining an epic item:** the epic file and the specific item

   The planning-brain loads `adhd` for divergent ideation (which serves
   as self-review), then writes the spec directly. Register via CLI,
   edit the generated file.

3. **Hard stop:** present the specification and wait for approval.

   **If refining an epic item:** after approval, update the epic MD:
   set the item's `Status` to `specced` and `Spec` to the new SPEC-NNN ID.

## Phase 2: Implementation plan

4. Re-dispatch `planning-brain` (`openai-terra-5.6-high`) in the
   foreground with:
   - **Phase: PLAN**
   - The full spec content in the task prompt (fresh subagent, no memory)
   - The architecture brief from phase 1 if available

   The planning-brain loads `adhd` again for divergent ideation about
   the implementation approach (which serves as self-review), then
   writes the plan directly. Register via CLI, edit the generated file.

5. **Hard stop:** present the plan and wait for approval.

6. After approval, mark and commit the spec and plan. Task creation is a
   separate `/pc-create-tasks` invocation.

## Constraints

- `grill-me` is loaded first to interrogate the user — reduces the
  need for separate reviewer handoffs
- `adhd` is loaded by `planning-brain` in both spec and plan phases.
  ADHD serves as self-review — no separate reviewer subagents
- `planning-brain` writes specs and plans directly — no separate writer
  subagents
- Subagents run sequentially and in the foreground
- No implementation or task creation during planning
