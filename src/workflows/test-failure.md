# Workflow: Test Failure

## When

When the test suite fails during task implementation (after the testing
agent writes tests, or during verification), or when a previously green
suite goes red after a code change. This workflow is the structured
retry loop — not a free-form "go back and fix."

## Trigger

```
Testing agent reports: "test failed against approved code"
    OR
Primary runs verification: npm test / go test / cargo test → failures
    OR
Code review or PR review finds test failures
```

## Loop

```
Tests fail
    → Triage (primary, with context) — classify each failure
        → Is it a code bug or a test bug?
            → Code bug → Primary fixes the code
            → Test bug → Testing agent fixes the test
            → Design issue → Escalate to user
    → Fix
    → Re-run full suite
    → If still failing → loop again (max 3 rounds)
    → If still failing after round 3 → escalate to user
```

## Roles

### Role 1: Orchestrator (you, with context)

- Has full conversation context — knows what was implemented and why.
- Triages failures: reads each failing test, classifies the cause.
- Fixes code bugs directly.
- Spawns the testing agent to fix test bugs (the testing agent has
  write access to test files).
- Escalates to the user if the failure reveals a design issue.

### Role 2: Testing agent (subagent, write access)

- Sees the source files, the failing test files, `AGENTS.md`
  (testing rules), and a failure summary from the orchestrator.
- Fixes test bugs directly — wrong assertions, missing setup,
  flaky timing, incorrect mocks.
- Does NOT fix code bugs — reports them to the orchestrator.
- Runs verification after fixing.

## Steps

1. **Capture the failure.** Run the test command, capture the full
   output. Do not skip this — you need the exact failure messages.

2. **Triage each failure.** For each failing test:
   - Read the test.
   - Read the code under test.
   - Classify:
     - **Code bug**: the code does the wrong thing. The test is
       correct. Primary fixes the code.
     - **Test bug**: the test expects the wrong thing, has a setup
       error, or tests an implementation detail that changed. Testing
       agent fixes the test.
     - **Design issue**: the failure reveals that the spec or plan
       was wrong — the code works as designed but the design itself
       is flawed. Escalate to the user. Do not fix blindly.
     - **Environment issue**: missing dependency, wrong Node/Go/Rust
       version, missing testdata. Fix the environment, not the code
       or test.

3. **Fix.**
   - Code bugs: orchestrator fixes the code. Re-run the specific failing
     test first for fast feedback, then the full suite.
   - Test bugs: spawn the testing agent with the failing test path,
     the failure output, and a one-line classification ("test bug:
     assertion expects wrong status code"). The testing agent fixes
     the test file directly and re-runs verification.
   - Design issues: stop. Use `ask_user_question` to present the
     failure and the design conflict. Do not patch around it.

4. **Re-run the full suite.** Not just the failing test — the full
   suite. A fix for one test can break another.

5. **Round counter.** This is round 1. If tests still fail, go back
   to step 1. Max 3 rounds. Each round, the orchestrator should try a
   different approach — if the same fix attempt fails twice, the
   diagnosis is wrong.

6. **Escalate.** If still failing after round 3, use
   `ask_user_question` to present:
   - The failing tests and their output.
   - What was tried in each round.
   - The orchestrator's assessment of the root cause.
   - Suggested options (fix the code, fix the test, change the spec,
     drop the feature).

7. **When all tests pass.** Commit with a message noting the
   failure loop: "fix <X> — test failure round N: <root cause>".
   Update the task status to `done`.

## Subagent prompt template

### Testing agent (test bug fix)

```
You are a testing agent fixing a test bug. Read AGENTS.md for the
project's testing rules.

The following test is failing due to a test bug (not a code bug):

Test file: <path>
Failure output:
<output>

Orchestrator's classification: <one-line explanation of why this is a
test bug, e.g. "assertion expects 200 but the API returns 201 for
POST create — the test is wrong, not the code">

Read the source under test at <path> to confirm the expected
behavior.

Fix the test file directly — you have write access. Run verification
after fixing using the project's test command.

Report what you fixed and why, briefly.
```

## Inputs

- The failing test output (full, not truncated)
- The test file(s)
- The source file(s) under test
- `AGENTS.md` (testing rules)
- The task file (for acceptance criteria)

## Outputs

- All tests passing
- A commit noting the failure loop and root cause
- Task status updated to `done`

## Constraints

- Max 3 rounds. Escalate to the user if unresolved.
- Never skip a failing test. Never `t.Skip`, `it.skip`, `#[ignore]`,
  or comment out a test to go green.
- Never weaken a test to make it pass. If the assertion is too
  strict, fix the assertion — but document why. If the assertion is
  correct, fix the code.
- Re-run the full suite after every fix, not just the failing test.
- If the same fix attempt fails twice, the diagnosis is wrong —
  re-triage from scratch.
- Design issues are escalated, not patched. If the code works as
  designed but the design is wrong, the spec or plan needs to change,
  not the code.
