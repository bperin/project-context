---
name: implement
description: "Run the task-implementation workflow — primary implements, secondary fixes, code reviewer checks, testing agent writes tests"
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

1. **Build a context packet** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

2. **Load the task's skill layers.** Read the context packet to find which skills apply. Load `alwaysOn` skills first, then the `primarySkills` for your primary lens:
   ```
   skill invoke --skill <skill-name>
   ```
   Note `secondarySkills` and `userLocal` skills for the secondary implementer in step 5.

3. **Implement code + initial tests.** Write the code and initial tests (known-answer vectors + round-trip where applicable).

4. **Run build, vet, test, lint.** Use the project's commands (see AGENTS.md or package.json).

5. **Spawn secondary implementer** (foreground, write access, different skill lens). Have it load `secondarySkills` and `userLocal` skills from the context packet. It reviews and fixes issues directly.

6. **Spawn code reviewer** (background, read-only, code-review skill). It checks against project rules.

7. **Apply code review findings.** Append MUST-FIX and SHOULD-FIX findings to the task's `## Review Findings` table with reviewer `code-reviewer` and the current date. Fix MUST-FIX issues. Re-run verification. Mark resolved findings as `resolved` in the table.

8. **Spawn testing agent** (background, write access, testing skill). It writes the full test suite.

9. **Run all tests.** Fix failures until all pass.

10. **Commit.** Humanize the commit message (use `content-humanizer` skill if available). Cite the governing standard in the body if applicable.

11. **Update the task status via the CLI.** Do not edit `overview.xlsx` directly. Run:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js status TASK-NNN done -t .
    ```

12. **Report.** Summarize what was implemented, what tests pass, and what the commit is.
