# Workflow: Test Failure

## When

When tests fail during implementation or verification.

## Loop

```
Tests fail → Triage → Fix → Re-run full suite → (max 3 rounds) → Escalate
```

## Steps

1. **Capture the failure.** Run the test command, capture full output.

2. **Triage each failure:**
   - **Code bug** → re-dispatch the implementer to fix the code.
   - **Test bug** → re-dispatch the test-agent to fix the test.
   - **Design issue** → escalate to the user. Do not patch around it.
   - **Environment issue** → fix the environment, not the code or test.

3. **Fix.** Re-dispatch the implementer (code bugs) or test-agent
   (test bugs). Do not fix code or tests yourself.

4. **Re-run the full suite.** Not just the failing test.

5. **Round counter.** Max 3 rounds. If the same fix fails twice, the
   diagnosis is wrong — re-triage from scratch.

6. **Escalate.** If still failing after round 3, present the failures,
   what was tried, and your assessment to the user.

7. **When all tests pass.** Commit with a message noting the failure
   loop. Update task status to `done`.

## Constraints

- Max 3 rounds. Escalate if unresolved.
- Never skip a failing test. Never weaken a test to make it pass.
- Re-run the full suite after every fix.
- Design issues are escalated, not patched.
- The orchestrator coordinates. It does not fix code or tests directly.
