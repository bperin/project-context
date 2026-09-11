# Workflow: Task Implementation

## When

When a task moves from `draft` to `in_progress`. This is the task
execution pipeline — from implementation through testing to done.

One task at a time. No parallel lanes.

## Pipeline

```
Read the task file and context packet
    → Implementer (foreground, write access)
        → Implements code + initial tests
        → Runs verification (build, vet, test, lint)
    → Code-optimizer (foreground, read-only)
        → Reports inefficiencies, OOM, concurrency, style
    → Reviewer (foreground, read-only)
        → Reports correctness, rule compliance findings
    If optimizer or reviewer finds MUST-FIX → re-dispatch implementer with findings
    When review passes → Testing agent (foreground, write access)
        → Writes full test suite
        → Runs verification
    If tests fail → test-failure workflow (triage, fix, re-run, max 3 rounds, escalate)
    When all tests pass → commit → append done event to JSONL → update graph → task done
```

No `adhd`. The task file already specifies the approach. No parallel
lanes — each agent runs sequentially, one at a time. One task at a
time — the next task does not start until this one is done.

## Roles

### Role 1: Orchestrator (you)

- Reads the task file and context packet. Coordinates the pipeline.
- **Does not implement.** Dispatches subagents, collects results,
  decides next steps.
- Builds a context packet with the CLI for each subagent.
- If any agent calls back with findings, re-dispatches the implementer
  with specific guidance to address them.
- When the task is done, commits, appends the `done` event to
  `data/tasks.jsonl` and `plans/PLAN-NNN.timeline.jsonl`.

### Role 2: Implementer (subagent, foreground, write access, `agent: implementer`)

- Receives the context packet: task file, skills, parent plan, spec,
  modules, components.
- Loads the task's **primary skill** before implementing.
- Implements code + initial tests (just enough to get green: known-answer
  vectors and a round-trip where applicable). The full test suite is
  written by the testing agent after review.
- Runs verification: the project's build, vet, test, and lint commands.
- Reports what was implemented and any issues found.
- If re-dispatched with optimizer or reviewer findings, fixes them
  directly.

### Role 3: Code-optimizer (subagent, foreground, read-only)

- Receives `AGENTS.md`, the task file, the source files, and the diff.
- Loads the project's language skills.
- Optimizes the **code** for inefficiencies, OOM risks, concurrency
  bugs, error handling gaps, and style violations. Does not check
  correctness or rule compliance — that is the reviewer's job.
- Reports findings as MUST-FIX / SHOULD-FIX / NIT. Does not fix — the
  implementer fixes.

### Role 4: Reviewer (subagent, foreground, read-only)

- Receives `AGENTS.md`, the task file, and the diff.
- Loads the project's code-review skill.
- Judges the **code** against project rules (documentation, security,
  architecture, correctness, rule compliance). Does not review tests —
  the full test suite hasn't been written yet.
- Reports findings as MUST-FIX / SHOULD-FIX / NIT. Does not fix — the
  implementer fixes.

### Role 5: Testing agent (subagent, foreground, write access)

- Receives the source files under test, the task file, `AGENTS.md`
  (testing rules), and the project's testing skill.
- Writes the full test suite: known vectors, fuzz targets, examples,
  negative tests, boundary tests — per the tier rules in `AGENTS.md`.
- **Has write access — writes test files directly.**
- Runs verification after writing.
- Reports what was written and any issues found.

## Steps

1. **Build a context packet** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

2. **Dispatch the implementer** (foreground, write access, `agent:
   implementer`). Give it:
   - The context packet file path
   - The task file path (for goal, files, symbols, constraints,
     acceptance criteria)
   - The primary skill path
   - `AGENTS.md` path
   The implementer:
   - Loads the primary skill, reads its guidance.
   - Implements the code.
   - Writes initial tests (just enough to get green).
   - Runs verification: build, vet, test, lint. All must pass.
   - Reports what was implemented and any issues found.

3. **Reconcile implementer output.** If it reports issues it couldn't
   fix, dispatch it again with specific guidance.

4. **Dispatch the code-optimizer** (foreground, read-only). Give it:
   `AGENTS.md`, the task file, the source files, and the diff. It
   loads the project's language skills and checks the code for
   inefficiencies, OOM risks, concurrency bugs, error handling gaps,
   and style violations.

5. **Dispatch the reviewer** (foreground, read-only). Give it:
   `AGENTS.md`, the task file, and the diff. It checks the code
   against project rules.

6. **Apply findings.** If the code-optimizer or reviewer reports
   MUST-FIX findings, re-dispatch the implementer with the findings.
   Do not fix code yourself — re-dispatch the subagent. Do not start
   the next task — wait for this one to finish.

7. **When review passes → dispatch the testing agent** (foreground,
   write access). Give it:
   - The source file path(s) under test
   - The task file path (for acceptance criteria)
   - `AGENTS.md` path (testing rules section)
   - The project's testing skill path
   The testing agent writes the full test suite and runs verification.

8. **Reconcile testing agent output.** If the testing agent reports a
   code bug (a test fails against the approved code), re-dispatch the
   implementer to fix the code. If it reports test design questions,
   answer them. Do not fix code or tests yourself.

9. **If tests fail → run the test-failure workflow**
   (`workflows/test-failure.md`). Max 3 rounds, escalate to the user if
   unresolved.

10. **Task done.** When all tests pass:
    - Humanize the commit message with the `content-humanizer` skill.
    - Commit.
    - Append the `done` event to `data/tasks.jsonl`:
      ```jsonl
      {"id":"TASK-NNN","event":"done","ts":"2026-09-11T..."}
      ```
    - Append the `done` event to `plans/PLAN-NNN.timeline.jsonl`:
      ```jsonl
      {"task":"TASK-NNN","event":"done","ts":"2026-09-11T..."}
      ```
    - **Update the project graph.** Rebuild graph nodes and edges to
      reflect the new/changed files:
      ```bash
      node /Users/brian/code/project-context/bin/cli.js graph -t .
      ```
      This can be dispatched as a background subagent — it's a utility
      task that doesn't need the orchestrator's context.
    - The hook will detect the done event and tell the orchestrator
      what to do next.

## Code-optimizer checks

- **Inefficiencies**: allocation hot paths, unnecessary copies, slice
  pre-allocation missing, string/[]byte conversions in loops.
- **OOM risks**: key material lifetime, memory leaks, unbounded buffers.
- **Concurrency**: goroutine leaks, race conditions, mutex scope,
  channel ownership, context cancellation.
- **Error handling**: sentinel errors checked with `errors.Is`,
  wrapping with `%w` at boundaries, no swallowed errors.
- **Style**: idiomatic code, naming, package layout, receiver
  consistency.

## Reviewer checks

- **Documentation**: every exported declaration has a comment citing its
  standard where required.
- **Security**: no `math/rand`, no `==` on secrets, no `bytes.Equal` on
  hashes/signatures, no logged secrets. Constant-time comparisons where
  required.
- **Architecture**: no forbidden imports. No forbidden dependency
  direction.
- **Style**: concrete structs not interfaces (unless consumer-side).
  Explicit constructors. No interface inflation.
- **Initial tests**: known-answer vectors cite their source.

## Review format

```
MUST-FIX: sha3.go:31 — Write error discarded, use sha3.Sum256 one-shot
SHOULD-FIX: test vector length not validated
NIT: comment could be clearer
```

No preamble. No "overall this is good." Just the findings.

## Constraints

- No `adhd`. The task file specifies the approach.
- One task at a time. No parallel lanes. The next task does not start
  until this one is done.
- Agents run sequentially. Implementer → code-optimizer → reviewer →
  testing agent. Each step depends on the previous one's output. No
  agent starts until the previous one finishes.
- The orchestrator coordinates. It does not implement, optimize, or
  test. It dispatches subagents and collects results.
- The implementer is the only agent with write access during
  implementation. The testing agent has write access for test files only.
- If the same fix attempt fails twice, the diagnosis is wrong —
  re-triage from scratch.
