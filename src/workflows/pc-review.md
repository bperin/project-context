# Workflow: PR Review

## When

After all tasks in a plan are done and before opening a PR. This is the sole
cumulative review; per-task reviews stay focused on task diffs.

## Steps

1. **Detect project checks.** Read manifests and repository instructions. Run only
   configured or applicable commands—for example `npm test` for Node, `go test
   ./...` and `go vet ./...` for Go, `pytest` for Python, or `cargo test` for Rust.
   Run security tooling only when installed/configured or when risk warrants it.
2. **Generate the cumulative diff** against the actual protected base branch.
3. **Dispatch one reviewer** (foreground, read-only) with the plan, completed task
   list, AGENTS.md, cumulative diff, and verification output. Load the detected
   language review skill. Add security review only for security-sensitive changes.
4. **Apply one bounded correction pass** for deduplicated `MUST-FIX` findings.
   `SHOULD-FIX` items are non-blocking follow-up candidates. Re-run applicable
   verification and confirm only the original blockers.
5. If an original blocker remains, return the plan to `in_progress` and ask the
   user. Do not start another review loop.
6. Open the PR with the plan name and completed tasks.

## Blocking standard

A finding blocks the PR only when it demonstrates a regression, unmet plan
criterion, security defect, data-loss risk, forbidden dependency, or failing
required check. Style preferences, speculative optimization, and unrelated
pre-existing issues do not block the PR.
