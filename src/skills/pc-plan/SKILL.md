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

5. **Dispatch the reviewer** (foreground, `reviewer` profile, read-only).
   Give it the spec file path, `AGENTS.md` path, and a 1-2 sentence
   context summary. It checks correctness, rule compliance, template
   compliance, dependency compliance. One pass — if MUST-FIX issues
   remain after one revision, escalate to the user.

6. **Revise the spec** based on reviewer findings.

7. **Wait for user approval.** Present the reviewed spec to the user.
   Do not proceed to the plan until the user says to. This is a hard
   gate — no automatic progression. Use `ask_user_question` if needed.

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

11. **Dispatch the reviewer** again (foreground, `reviewer` profile).
    Give it the plan file, the spec file, `AGENTS.md`, and a context
    summary. One pass — if MUST-FIX issues remain after one revision,
    escalate to the user.

12. **Revise the plan** based on findings.

13. **Wait for user approval.** Present the reviewed plan to the user.
    Do not proceed to task creation until the user says to. This is a
    hard gate — no automatic progression. Use `ask_user_question` if
    needed.

14. **Commit.** Commit spec + plan together. Update statuses to
    `committed`:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js status SPEC-NNN committed -t .
    node /Users/brian/code/project-context/bin/cli.js status PLAN-NNN committed -t .
    ```

15. **Report.** Summarize the spec and plan. Tell the user to run
    `/pc-create-tasks PLAN-NNN` to have the task-writer generate tasks.

## Constraints

- **One context.** Do not spawn a new session between spec and plan.
- **No research subagents.** The orchestrator does its own research.
- **No optimizer subagents.** The reviewer is the only subagent.
- **adhd once.** Only on the original input, not during plan writing.
- **No skill loading during planning.** Skills are recorded in the
  spec/plan metadata for later use during implementation. The planner
  does not invoke or load any skills except `adhd` (once).
- **Hard gates.** Stop and wait for the user after spec review and
  after plan review. Never auto-progress from spec to plan or from
  plan to task creation.
