---
name: implement
description: "Run the task-implementation workflow — implementer writes code, reviewer checks, testing agent writes tests"
argument-hint: "<TASK-NNN>"
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
permissions:
  allow:
    - Read(**)
    - Write(src/**)
    - Edit(src/**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(git **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are running the **task-implementation workflow** for this project.

Read the full workflow at `workflows/task-implementation.md` before starting. Follow it exactly.

## Steps

1. **Load the `adhd` skill** for divergent ideation on the
   implementation approach. Explore alternatives before dispatching the
   implementer.

2. **Build a context packet** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

3. **Dispatch the implementer** (foreground, write access). Give it the
   context packet, task file, primary skill path, algorithm registry
   (if applicable), and `AGENTS.md`. It loads the primary skill,
   implements code + initial tests, and runs verification.

4. **Reconcile implementer output.** If it reports issues it couldn't
   fix, re-dispatch it with specific guidance.

5. **Dispatch the reviewer** (background, read-only, code-review skill).
   Give it `AGENTS.md`, the algorithm registry (if applicable), task
   file, and the diff. It checks the code against project rules.

6. **Apply reviewer findings.** Append MUST-FIX and SHOULD-FIX findings
   to the task's `## Review Findings` table with reviewer `reviewer`
   and the current date. Re-dispatch the implementer to fix MUST-FIX
   issues. Re-run verification. Mark resolved findings as `resolved`
   in the table.

7. **Dispatch the testing agent** (background, write access) via
   `/test TASK-NNN`. It writes the full test suite.

8. **Run all tests.** Fix failures until all pass (use the test-failure
   workflow for structured triage).

9. **Commit.** Humanize the commit message (use `content-humanizer`
   skill if available). Cite the governing standard in the body if
   applicable.

10. **Update the task status via the CLI.** Do not edit `overview.xlsx`
    directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js status TASK-NNN done -t .
    ```

11. **Report.** Summarize what was implemented, what tests pass, and
    what the commit is.
