---
name: implement
description: "Run the task-implementation workflow — implementer writes code, code-optimizer optimizes, reviewer checks, testing agent writes tests"
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

3. **Dispatch the implementer** (foreground, write access, `agent:
   implementer`, model: `gpt-5.6-sol-medium`). Give it the context
   packet, task file, primary skill path, algorithm registry (if
   applicable), and `AGENTS.md`. It loads the primary skill, implements
   code + initial tests, and runs verification. The implementer is
   pinned to `gpt-5.6-sol-medium` — not the orchestrator's
   `gpt-5.6-sol-high`.

4. **Reconcile implementer output.** If it reports issues it couldn't
   fix, re-dispatch it with specific guidance.

5. **Dispatch the code-optimizer** (background, read-only). Give it
   `AGENTS.md`, the task file, the source files, and the diff. It loads
   the project's Go skills sequentially and checks for inefficiencies,
   OOM risks, concurrency bugs, error handling gaps, and style.

6. **Dispatch the reviewer** (background, read-only). Give it
   `AGENTS.md`, the algorithm registry (if applicable), task file, and
   the diff. It checks the code against project rules.

7. **Apply findings.** Append MUST-FIX and SHOULD-FIX findings to the
   task's `## Review Findings` table with the reviewer name and current
   date. Re-dispatch the implementer to fix MUST-FIX issues. Re-run
   verification. Mark resolved findings as `resolved` in the table.

8. **Dispatch the testing agent** (background, write access) via
   `/test TASK-NNN`. It writes the full test suite — verbose,
   comprehensive, with known vectors, negative tests, boundary tests,
   fuzz, and examples per the AGENTS.md testing rules.

9. **Run all tests.** Fix failures until all pass (use the test-failure
   workflow for structured triage).

10. **Commit.** Humanize the commit message (use `content-humanizer`
    skill if available). Cite the governing standard in the body if
    applicable.

11. **Update the task status via the CLI.** Do not edit `overview.xlsx`
    directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js status TASK-NNN done -t .
    ```

12. **Report.** Summarize what was implemented, what tests pass, and
    what the commit is.
