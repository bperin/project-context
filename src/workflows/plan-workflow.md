# Workflow: Plan

## When

When a user describes what they want built. This is the full planning
sequence — spec through plan — in one continuous context. The
orchestrator never re-reads context between spec and plan because it
never lost it.

## Pattern

Think-write-review. The orchestrator loads `adhd` once, thinks about the
problem from multiple angles, writes the spec, dispatches the reviewer,
revises, writes the plan, dispatches the reviewer, revises. All linear,
all in one context.

```
Orchestrator loads adhd (divergent ideation on the original input)
    → Orchestrator writes the spec (what, why, scope)
    → Orchestrator dispatches reviewer → reviewer checks spec
    → Orchestrator revises the spec
    → STOP: wait for user to approve the spec
    → Orchestrator writes the plan (same context, no re-read)
    → Orchestrator dispatches reviewer → reviewer checks plan
    → Orchestrator revises the plan
    → STOP: wait for user to approve the plan
    → Done — ready for the task workflow
```

The orchestrator has intent and context from the user. It uses `adhd`
to think about the problem from multiple angles before writing anything.
The reviewer is a separate subagent with fresh context — it checks the
artifact, not the intent.

## Steps

### Phase 1: Spec (steps 1-5)

1. **Load the `adhd` skill.** Use it to explore the problem space before
   writing anything. Spawn divergent branches under different cognitive
   frames, score and prune, then write from the survivors. Do not lock
   onto the first approach before alternatives are considered.

2. **Write the spec.** Use `SPEC-NNN.template.md`. The spec describes
   WHAT the system does and WHY, not HOW. Include scope, desired
   behaviors, success criteria, and out-of-scope. The spec is
   high-level — it should not read like an implementation plan.

3. **Dispatch the reviewer** (foreground, `reviewer` profile, `is_background: false`). Give it:
   - The spec file path
   - `AGENTS.md` path
   - A 1-2 sentence context summary (what this spec is for, key user
     constraints)
   - The reviewer checks:
     - **Correctness**: are cited standards real? Are claims accurate?
     - **Problem fit**: does this spec solve the actual problem? Is the
       scope right — not too narrow, not too broad?
     - **Requirements coverage**: does every desired behavior map to a
       measurable success criterion? Any orphans in either direction?
     - **Testability**: is every desired behavior testable? Are success
       criteria objective (pass/fail, not subjective)?
     - **Scope discipline**: is the Out of Scope section honest? Any
       features sneaking in that belong in a future spec?
     - **Rule compliance**: does the spec respect AGENTS.md conventions?
     - **Template compliance**: are all required sections present?
     - **Internal consistency**: does the spec contradict itself?

4. **Apply reviewer findings.** Revise the spec. If the reviewer found
   a fundamental problem (wrong problem, wrong scope), stop and discuss
   with the user before rewriting.

5. **STOP. Present the reviewed spec to the user and yield control.**
   Do NOT proceed to step 6. Do NOT write the plan. Do NOT register a
   plan. Summarize what the spec covers and ask the user if they want
   to proceed to the plan. **This is a hard stop.** The workflow ends
   here until the user explicitly says to continue. If the user says
   "continue", "proceed", "write the plan", or similar, go to step 6.
   If the user requests changes, revise the spec and re-dispatch the
   reviewer. If the user says nothing, do nothing — wait.

### Phase 2: Plan (steps 6-10) — only after user approval

6. **Write the plan.** Use `PLAN-NNN.template.md`. Same context — do
   not re-read the spec, do not start a new session, do not reload
   `adhd`. The plan is the implementation blueprint:
   - List workstreams ordered so no workstream depends on a later one.
   - For each workstream: name specific file paths to create/modify,
     skills needed, dependencies, and test vectors.
   - Include completion criteria that are objectively verifiable.
   - Include an honest Out of Scope section.

7. **Dispatch the reviewer** again (foreground, `reviewer` profile, `is_background: false`).
   Give it the plan file, the spec file, `AGENTS.md`, and a context
   summary. The reviewer checks:
   - **Spec coverage**: does every spec desired behavior have a
     workstream? Any orphans in either direction?
   - **Workstream ordering**: are workstreams ordered so no
     workstream depends on a later one?
   - **Scope vs. spec**: is the plan doing more or less than the spec
     asks?
   - **Completion criteria**: are they objectively verifiable?
   - **Dependency compliance**: would any workstream require a
     forbidden import?
   - **Rule compliance**: does the plan respect AGENTS.md conventions?
   - **Template compliance**: are all required sections present?
   - **Internal consistency**: does the plan contradict itself?

8. **Apply reviewer findings.** Revise the plan. If MUST-FIX issues
   remain after one revision, escalate to the user.

9. **STOP. Present the reviewed plan to the user and yield control.**
   Do NOT proceed to step 10. Do NOT commit. Do NOT create tasks.
   Summarize what the plan covers and ask the user if they want to
   commit and proceed to task creation. **This is a hard stop.** The
   workflow ends here until the user explicitly says to continue. If
   the user says "commit", "proceed", "create tasks", or similar, go
   to step 10. If the user requests changes, revise the plan and
   re-dispatch the reviewer. If the user says nothing, do nothing — wait.

10. **Commit.** Commit the spec and plan together with a message
    summarizing what was built. Tell the user to run `/pc-create-tasks
    PLAN-NNN` to start task creation. **The workflow is now complete.
    Do NOT write another spec. Do NOT write another plan. Do NOT loop
    back to step 1. Do NOT start `/pc-create-tasks` yourself — that is
    a separate workflow invoked by the user. Yield control and stop.**

    If the user wants to build something else, they will invoke
    `/pc-plan` again with a new request. This invocation is done.

## Expected output

- A spec that states WHAT and WHY, with objectively verifiable success
  criteria and an honest Out of Scope section.
- A plan that traces every workstream to a spec behavior, names
  specific files and skills, has verifiable completion criteria, and
  respects the project's dependency rules.
- Both reviewed by the reviewer and revised by the orchestrator.

## Inputs

- The user's original description of what they want built
- `AGENTS.md` (project conventions and rules)
- `SPEC-NNN.template.md` and `PLAN-NNN.template.md` (for format
  reference)

## Outputs

- A reviewed, revised spec ready to commit
- A reviewed, revised plan ready to commit
- Both committed together

## Constraints

- `adhd` is loaded once, before the spec. Not before the plan, not
  by the reviewer, not at any other point.
- No optimizer subagent. The orchestrator writes; the reviewer checks.
- No research subagent. The orchestrator has the context.
- No 3-round loop. One review pass per artifact. If MUST-FIX issues
  remain after one revision, escalate to the user.
- The orchestrator writes both spec and plan in the same session. Do
  not start a new session between them. Context is not re-read.
- The reviewer is read-only. It reports findings; the orchestrator
  revises.
- **Hard gates: two hard stops.** After spec review (step 5) and after
  plan review (step 9), present the artifact, yield control to the
  user, and do not proceed until the user explicitly says to. Do NOT
  auto-progress. Do NOT write the plan until the user approves the
  spec. Do NOT commit until the user approves the plan. If you find
  yourself writing step 6 without the user saying "continue" or
  "proceed", STOP — you skipped the gate.
