---
name: pc-implement
description: "Run the task-implementation workflow — dispatch implementer, code-optimizer, reviewer, test-agent sequentially"
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
    - Write(**)
    - Edit(**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(go **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the
> shared protocol, CLI commands, context packets, and rules for all
> skills.

You are running the **task-implementation workflow** for this project.

Read the full workflow at `workflows/task-implementation.md` before
starting. Follow it exactly.

## What you are doing

Implementing a single task. You are the orchestrator — you coordinate
the pipeline by dispatching specialized subagents sequentially:
implementer → code-optimizer → reviewer → test-agent. Each runs one
at a time. No `adhd`. One task at a time.

## Steps

1. **Build a context packet** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

2. **Dispatch the implementer** (foreground, write access, `agent:
   implementer`, `is_background: false`). Give it the context packet,
   task file, primary skill path, and `AGENTS.md`. It loads the primary
   skill, implements code + initial tests, runs verification. Re-dispatch
   if it reports issues. Block on `read_subagent` to collect results.

3. **Dispatch the code-optimizer** (foreground, read-only, `agent:
   code-optimizer`, `is_background: false`). Give it `AGENTS.md`, the
   task file, source files, and the diff. It checks for inefficiencies,
   OOM risks, concurrency bugs, error handling gaps, and style. Block
   on `read_subagent` to collect results.

4. **Dispatch the reviewer** (foreground, read-only, `agent: reviewer`,
   `is_background: false`). Give it `AGENTS.md`, the task file, and the
   diff. It checks the code against project rules. Block on
   `read_subagent` to collect results.

5. **Apply findings.** If the code-optimizer or reviewer reports
   MUST-FIX findings, re-dispatch the implementer with the findings.

6. **Dispatch the test-agent** (foreground, write access, `agent:
   test-agent`, `is_background: false`). Give it the source files, task
   file, `AGENTS.md` (testing rules), and the testing skill path. It
   writes the full test suite and runs verification. Block on
   `read_subagent` to collect results.

7. **If tests fail → run the test-failure workflow**
   (`workflows/test-failure.md`). Max 3 rounds, escalate to the user if
   unresolved.

8. **Commit.** Humanize the commit message (use `content-humanizer`
   skill if available). Cite the governing standard in the body if
   applicable.

9. **Update the task status via the CLI.** Do not edit JSONL files
   directly. Run:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js status TASK-NNN done -t .
   ```

10. **Update the project graph.** Rebuild graph nodes and edges to
    reflect the new/changed files. This can be dispatched as a
    background subagent — it's a utility task:
    ```bash
    node /Users/brian/code/project-context/bin/cli.js graph -t .
    ```

11. **Report.** Summarize what was implemented, what tests pass, and
    what the commit is.

## One task at a time

No parallel lanes. The next task does not start until the current one
is done. The build order in the JSONL record determines the sequence.
Subagents run sequentially — each one finishes before the next starts.
