# Workflow: Task Implementation

## When

When a task moves from `draft` to `in_progress`. One task at a time.
No parallel lanes.

## Pipeline

```
Implementer → Code-optimizer → Reviewer → Test-agent → Commit
```

Each step runs sequentially. No step starts until the previous one
finishes. If any step finds MUST-FIX issues, re-dispatch the
implementer with the findings, then re-run from that point.

## Steps

1. **Build a context packet:**
   ```bash
   node bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

2. **Dispatch the implementer** (foreground, write access, `is_background: false`). Give it
   the context packet (JSON), task file path, and AGENTS.md path. It
   reads `skillLayers` from the packet to discover and load skills,
   implements code + initial tests, runs verification. Re-dispatch
   if it reports issues.

3. **Dispatch the code-optimizer** (foreground, read-only, `is_background: false`). Give it
   the context packet, AGENTS.md, the task file, source files, and the
   diff. It reads `skillLayers` to load language-specific performance
   skills, then checks for inefficiencies, OOM risks, concurrency bugs,
   error handling gaps, style.

4. **Dispatch the reviewer** (foreground, read-only, `is_background: false`). Give it
   the context packet, AGENTS.md, the task file, and the diff. It reads
   `skillLayers` to load language-specific review skills, then checks
   correctness and rule compliance.

5. **Apply findings.** If code-optimizer or reviewer report MUST-FIX,
   re-dispatch the implementer with the findings. Do not fix code
   yourself.

6. **Dispatch the test-agent** (foreground, write access, `is_background: false`). Give it
   the context packet, source files, task file, AGENTS.md. It reads
   `skillLayers` to load language-specific testing skills, writes the
   full test suite and runs verification.

7. **If tests fail → test-failure workflow.** Max 3 rounds, escalate
   to the user if unresolved.

8. **Commit.** Humanize the commit message. Commit.

9. **Update status:**
   ```bash
   node bin/cli.js status TASK-NNN done -t .
   ```

10. **Update graph:**
    ```bash
    node bin/cli.js graph -t .
    ```

## Constraints

- No `adhd`. The task file specifies the approach.
- One task at a time. No parallel lanes.
- Agents run sequentially. Each finishes before the next starts.
- The orchestrator coordinates. It does not implement, optimize, or
  test — it dispatches subagents and collects results.
- If the same fix fails twice, the diagnosis is wrong — re-triage.
