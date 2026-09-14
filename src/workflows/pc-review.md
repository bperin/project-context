# Workflow: PR Review

## When

After the plan review passes and all tasks are done. The plan review
already checked the implementation against the spec and plan. This is
just opening the PR.

## Steps

1. **Run project checks.** Read manifests and run configured commands
   (`go test ./...`, `go vet ./...`, `npm test`, `pytest`, `cargo test`).
2. **Verify all tasks are done.** Run `./tools/project-context inspect -t .` and
   confirm every task in the plan is `done`. If any are not, stop.
3. **Check the diff is clean.** No debug code, no leftover context packets
   (`.context-*.json`), no accidental commits to manager state.
4. **Open the PR** with the plan name and completed task list.

## Do NOT

- Do not re-review code. The implementer self-reviewed each task.
- Do not re-review the plan. The plan review already happened.
- Do not dispatch a reviewer.
- Do not start correction loops.

## Blocking

A PR is blocked only if: checks fail, tasks are not all done, or the
diff contains leftover artifacts. Style, speculative optimization, and
pre-existing issues do not block.
