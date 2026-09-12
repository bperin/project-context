# Workflow: Test Failure

## When

When required verification fails during task implementation or final review.

## Steps

1. Capture the failing command and relevant output.
2. Classify the failure as implementation, test, environment, or design.
3. Use the task's single correction pass:
   - **Implementation or test defect:** re-dispatch the implementer with the
     complete failure set. The implementer owns both code and task-level tests.
   - **Environment defect:** repair the environment and retry without changing
     repository behavior.
   - **Design defect:** stop and present the decision to the user.
4. Re-run the required suite once.
5. If implementation code changed, return to the focused confirmation review in
   `pc-implement.md` before committing.
6. If the same required check still fails, stop with the command, output, attempted
   correction, and diagnosis. Do not start another agent loop.

## Constraints

- Never skip or weaken a required test merely to make it pass.
- Do not repeatedly run the full suite while diagnosing one deterministic failure.
- A final full-suite run is required before commit when the project defines one.
