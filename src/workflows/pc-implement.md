# Workflow: Task Implementation

## When

When a task moves from `draft` to `in_progress`. One task at a time.

## Default pipeline

```text
Implement + complete tests → mechanical verification → focused review → commit
```

The default path uses two subagent calls: one implementer and one reviewer.
Dispatch the optional optimizer only when the task or measured evidence identifies
performance, memory, or concurrency risk.

## Steps

1. **Build a context packet:**
   ```bash
   project-context context TASK-NNN -t . -o .context-packet.json
   ```
2. **Dispatch the implementer** (foreground, write access). It loads applicable
   skills, implements the change, writes the complete task-level test suite, and
   runs the task's verification commands.
3. **Run mechanical verification.** Run only commands supported by detected
   manifests or named by the task. Failures go directly back to the implementer
   and count as the correction pass.
4. **Optionally dispatch the code-optimizer** only when the task concerns
   performance, memory, or concurrency; measured evidence identifies such a risk;
   or the user requests optimization review. Do not dispatch it for routine work.
5. **Dispatch one focused reviewer** (foreground, read-only). Give it the task,
   acceptance criteria, AGENTS.md, diff, verification output, and any optimizer
   findings. It reviews only changed lines and directly affected behavior.
6. **Apply at most one correction pass.** Re-dispatch the implementer once with
   the complete, deduplicated `MUST-FIX` list. A blocker must demonstrate an
   acceptance-criteria failure, regression, security defect, data-loss risk, or
   failing required check. Suggestions do not block completion.
7. **Re-run verification and a confirmation review.** The confirmation checks
   only the original blockers and obvious regressions introduced by the correction;
   it must not expand scope. If a blocker remains, stop and ask the user.
8. **Commit, then update state:**
   ```bash
   project-context status TASK-NNN done -t .
   project-context graph -t .
   ```

## Test failure routing

- A test-only correction returns to mechanical verification.
- An implementation correction returns to verification and the focused
  confirmation review before commit.
- Environment failures do not consume the correction pass unless repository files
  change.

## Constraints

- One task at a time. Agents run sequentially.
- One correction pass maximum per task.
- Review changed scope, not the entire repository.
- The orchestrator may make trivial metadata or formatting corrections, but code
  changes return to the implementer.
