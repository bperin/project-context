# Workflow: PR Review

## When

Before any PR from `dev` to `master`. This is the final gate before
code ships to the protected branch. Per-task code review happens in
the task-implementation workflow (`task-implementation.md`) — this
workflow reviews the **cumulative diff** of all tasks in the plan.

## Reviewer model

Reviews are done by a fast subagent with **no conversation context**
but **full project context**. The subagent gets:

- **Mission context** (from files it reads): `AGENTS.md` (project
  structure, dependency rules, conventions, Godoc rules, testing
  rules), the architecture document
- **The artifact**: the full diff (`git diff master...dev`)
- **Reference**: `trust/algorithms.json` (for Godoc citation
  verification)
- **The plan**: the PLAN-NNN.md being shipped, for completion criteria

It never sees the implementation conversations, the user's requests,
or the agent's reasoning. It reviews the cumulative diff against the
project rules and the plan's completion criteria.

## Steps

1. Load the `go-code-review` skill (on-demand, not always-on).
2. Run the mechanical checks:
   ```
   gofmt -l .          # must output nothing
   go vet ./...        # must be clean
   go test -race -count=1 -shuffle=on ./...  # must pass, no skips
   govulncheck ./...   # no known vulnerabilities
   ```
3. Generate the diff: `git diff master...dev`.
4. Launch a review subagent with the diff, the plan file, and
   `algorithms.json` as input. No conversation context. The subagent
   checks:
   - **Godoc**: every exported declaration has a comment citing its
     standard. Citation matches `godoc_citation` in `algorithms.json`.
   - **Security**: no `math/rand`, no `==` on secrets, no `bytes.Equal`
     on hashes/signatures, no private key
     `String()`/`Format()`/`GoString()`, no logged secrets.
     Constant-time comparisons where required.
   - **Architecture**: no `auth` or `chain` imports in `trust`. No
     forbidden dependency direction.
   - **Testing**: known-answer tests cite their source. Negative tests
     present. Boundary tests present. No `t.Skip`. Wycheproof tests
     where applicable. Fuzz targets for parser surfaces. Example
     functions for the public API.
   - **Style**: concrete structs not interfaces (unless consumer-side
     with multiple implementations). Explicit constructors. No
     reflection DI. No interface inflation.
   - **Plan completion**: every task in the plan is `done`. Every
     completion criterion in the plan is met.
5. Collect findings. Categorize as must-fix, should-fix, nit.
6. Apply must-fix and should-fix changes.
7. Re-run verification commands. All must pass.
8. Check branch protection:
   - Branch protection is intact on `master` (no direct push, no force
     push, PR required).
   - The PR description summarizes what changed and why.
   - All CI checks pass.
9. If all checks pass, the PR is ready to merge (squash or rebase per
   AGENTS.md branching rules).

## Subagent prompt template

```
You are a PR reviewer for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core and must never import
auth or chain. Read AGENTS.md for full conventions, Godoc rules, testing
rules, and security requirements.

Here is the full diff (dev → master):

<diff>

Read the plan at <path> for completion criteria.
Read trust/algorithms.json for Godoc citation verification.

Check:
- Godoc: every exported declaration cites its standard. Citation matches
  algorithms.json godoc_citation field.
- Security: no math/rand, no == on secrets, no bytes.Equal on hashes,
  no private key String()/Format()/GoString(), no logged secrets.
  Constant-time comparisons where required.
- Architecture: no auth or chain imports in trust. No forbidden deps.
- Testing: known-answer tests cite source. Negative tests present.
  No t.Skip. Wycheproof where applicable. Fuzz targets for parser
  surfaces. Example functions for the public API.
- Style: concrete structs, explicit constructors, no reflection DI.
- Plan completion: every task done. Every completion criterion met.

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite file and line.
```

## Inputs

- The full diff (`git diff master...dev`)
- The plan file (`plans/PLAN-NNN.md`) being shipped
- `trust/algorithms.json` (for Godoc citation verification)
- `AGENTS.md` (for conventions)

## Outputs

- Review findings (must-fix, should-fix, nit)
- Applied fixes with re-verification
- PR ready to merge (or back to `in_progress` if must-fix issues found)

## Constraints

- No code is merged to master without passing this review.
- No `t.Skip` is ever acceptable in a review-passing test suite.
- If the review finds a fundamental design problem, set the plan back
  to `in_progress` and flag it to the user.
- The reviewer has project context (mission, architecture, rules from
  files) but no conversation context (no implementation rationale, no
  user messages). It judges the diff against the rules and the plan,
  not the intent.
- `govulncheck ./...` must pass. Any known vulnerability in a
  dependency blocks the merge.
