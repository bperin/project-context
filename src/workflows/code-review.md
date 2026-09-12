# Workflow: PR Review

## When

Before any PR from the feature branch to the protected branch. This
reviews the cumulative diff of all tasks in the plan.

## Steps

1. **Mechanical checks.** Run lint, vet, test, vulncheck. All must
   pass.

2. **Generate the diff:** `git diff protected...feature`.

3. **Dispatch the reviewer** (foreground, read-only, `is_background: false`). Give it the
   diff, the plan file, AGENTS.md. It checks:
   - Documentation on all exports.
   - Security: no `math/rand`, no logged secrets, constant-time
     comparisons.
   - Architecture: no forbidden dependency directions.
   - Testing: known-answer tests cite source, negative tests present,
     no skipped tests.
   - Plan completion: every task is `done`, every completion criterion
     is met.

4. **Apply MUST-FIX and SHOULD-FIX.** Re-run verification.

5. **Open PR.** Title: `PLAN-NNN: <plan name>`. Body: list completed
   tasks.

## Constraints

- No code merges without passing this review.
- No skipped tests.
- If the review finds a fundamental design problem, set the plan back
  to `in_progress` and flag it to the user.
