# Workflow: PR Review

## When

After all tasks in a plan are done and before opening a PR. Code was
already reviewed per-wave during implementation. This is NOT a second
code review — it's a PR readiness check.

## Steps

1. **Run project checks.** Read manifests and run configured commands
   (`go test ./...`, `go vet ./...`, `npm test`, `pytest`, `cargo test`).
   Run security tooling only if installed/configured or risk warrants it.
2. **Verify all tasks are done.** Run `project-context inspect -t .` and
   confirm every task in the plan is `done`. If any are not, stop.
3. **Check the diff is clean.** No debug code, no leftover context packets
   (`.context-*.json`), no accidental commits to manager state.
4. **Open the PR** with the plan name and completed task list.

## Do NOT

- Do not re-review code. That happened per-wave during implementation.
- Do not dispatch a reviewer. Code review is done.
- Do not start correction loops. If checks fail, the implementation
  workflow handles that.

## Blocking

A PR is blocked only if: checks fail, tasks are not all done, or the
diff contains leftover artifacts. Style, speculative optimization, and
pre-existing issues do not block.
