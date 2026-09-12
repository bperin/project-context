---
name: pc-plan
description: "Run the planning workflow — adhd once on original input, write spec, review, write plan, review (one context)"
argument-hint: "<description of what to build>"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
  - run_subagent
  - read_subagent
  - skill
  - todo_write
  - ask_user_question
permissions:
  allow:
    - Read(**)
    - Write(specs/**)
    - Write(plans/**)
    - Edit(specs/**)
    - Edit(plans/**)
    - Exec(node **)
    - Exec(npm **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **planning workflow** for this project. Read
`workflows/plan-workflow.md` before starting and follow it exactly.

## What you are doing

Taking a user's request and producing an approved spec + plan in one
continuous high-context process. The orchestrator (you) is the
expensive model — use it only for this planning stage. You dispatch a
reviewer subagent (cheaper model) to check each artifact.

## Steps

### Phase 1: Spec (steps 1-7)

1. **Load the `adhd` skill once** for divergent ideation on the original
   user input. Explore the problem space from multiple angles. Score and
   prune alternatives. This is the only time `adhd` runs.

2. **Write the spec** using `templates/SPEC-NNN.template.md`. The spec
   describes WHAT and WHY, not HOW. Pull from the adhd survivors.

3. **Register the spec via the CLI.** Record what skills the spec's
   tasks will need (for later implementation), but do not load them now:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type spec --title "<title>" --status draft --skills "<skills>" --triggers "<triggers>" -t .
   ```

4. **Build a context packet** for the reviewer:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context SPEC-NNN -t . -o .context-packet.json
   ```

5. **Dispatch the reviewer** (foreground, `reviewer` profile, read-only,
   `is_background: false`). Give it the spec file path, `AGENTS.md` path,
   and a 1-2 sentence context summary. It checks correctness, rule
   compliance, template compliance, dependency compliance. One pass —
   if MUST-FIX issues remain after one revision, escalate to the user.
   Block on `read_subagent` to collect results.

6. **Revise the spec** based on reviewer findings.

7. **STOP. Present the reviewed spec to the user and yield control.**
   Do NOT proceed to step 8. Do NOT write the plan. Do NOT register a
   plan. Do NOT pass go. The spec is done for now. Summarize what the
   spec covers and ask the user if they want to proceed to the plan.

   **This is a hard stop.** The workflow ends here until the user
   explicitly says to continue. If the user says "continue", "proceed",
   "write the plan", or similar, go to step 8. If the user requests
   changes, revise the spec and re-dispatch the reviewer. If the user
   says nothing, do nothing — wait.

### Phase 2: Plan (steps 8-15) — only after user approval

8. **Write the plan** using `templates/PLAN-NNN.template.md` — same
   context, do not restart or re-read. The plan describes HOW
   (architecture, workstreams, build order), not what/why.

9. **Register the plan via the CLI:**
   ```bash
   node /Users/brian/code/project-context/bin/cli.js add --type plan --title "<title>" --parent SPEC-NNN --status draft --skills "<skills>" -t .
   ```

10. **Build a context packet** for the plan reviewer:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js context PLAN-NNN -t . -o .context-packet.json
    ```

11. **Dispatch the reviewer** again (foreground, `reviewer` profile,
    `is_background: false`). Give it the plan file, the spec file,
    `AGENTS.md`, and a context summary. One pass — if MUST-FIX issues
    remain after one revision, escalate to the user. Block on
    `read_subagent` to collect results.

12. **Revise the plan** based on findings.

13. **STOP. Present the reviewed plan to the user and yield control.**
    Do NOT proceed to step 14. Do NOT commit. Do NOT create tasks. The
    plan is done for now. Summarize what the plan covers and ask the
    user if they want to commit and proceed to task creation.

    **This is a hard stop.** The workflow ends here until the user
    explicitly says to continue. If the user says "commit", "proceed",
    "create tasks", or similar, go to step 14. If the user requests
    changes, revise the plan and re-dispatch the reviewer. If the user
    says nothing, do nothing — wait.

14. **Commit.** Commit spec + plan together. Update statuses to
    `committed`:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js status SPEC-NNN committed -t .
    node /Users/brian/code/project-context/bin/cli.js status PLAN-NNN committed -t .
    ```

15. **Report and END.** Summarize the spec and plan. Tell the user to
    run `/pc-create-tasks PLAN-NNN` to have the task-writer generate
    tasks. **The workflow is now complete. Do NOT write another spec.
    Do NOT write another plan. Do NOT loop back to step 1. Do NOT
    start `/pc-create-tasks` yourself — that is a separate workflow
    invoked by the user. Yield control and stop.**

    If the user wants to build something else, they will invoke
    `/pc-plan` again with a new request. This invocation is done.

## Constraints

- **One context.** Do not spawn a new session between spec and plan.
- **No research subagents.** The orchestrator does its own research.
- **No optimizer subagents.** The reviewer is the only subagent.
- **adhd once.** Only on the original input, not during plan writing.
- **No skill loading during planning.** Skills are recorded in the
  spec/plan metadata for later use during implementation. The planner
  does not invoke or load any skills except `adhd` (once).
- **Hard gates.** Two hard stops: after spec review (step 7) and after
  plan review (step 13). At each stop, present the artifact, yield
  control to the user, and do not proceed until the user explicitly
  says to. Do NOT auto-progress. Do NOT write the plan until the user
  approves the spec. Do NOT commit until the user approves the plan.
  If you find yourself writing step 8 without the user saying
  "continue" or "proceed", STOP — you skipped the gate.
