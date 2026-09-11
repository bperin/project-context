# Workflow: PR Review

## When

Before any PR from the feature branch to the protected branch. This is
the final gate before code ships to the protected branch. Per-task code
review happens in the task-implementation workflow
(`task-implementation.md`) — this workflow reviews the **cumulative
diff** of all tasks in the plan.

## Reviewer model

Reviews are done by a reviewer subagent with full project context. The
subagent gets:

- **Mission context** (from files it reads): `AGENTS.md` (project
  structure, dependency rules, conventions, documentation rules,
  testing rules), the architecture document
- **The artifact**: the full diff (`git diff protected...feature`)
- **Reference**: any project-specific reference files (for
  documentation citation verification)
- **The plan**: the PLAN-NNN.md being shipped, for completion criteria

It reviews the cumulative diff against the project rules and the
plan's completion criteria.

## Steps

1. Load the project's code-review skill (on-demand, not always-on).

2. Run the mechanical checks:
   ```
   <project lint command>        # must output nothing
   <project vet command>         # must be clean
   <project test command>        # must pass, no skips
   <project vuln scan command>    # no known vulnerabilities (if applicable)
   ```

3. Generate the diff: `git diff protected...feature`.

4. **Dispatch the reviewer** (foreground, `agent: reviewer`, read-only).
   Feed it the diff, the plan file, `AGENTS.md`, and any project-specific
   reference files. The reviewer checks:
   - **Documentation**: every exported declaration has a comment citing
     its standard, where the project requires citations. Citation
     matches the project's reference data.
   - **Security**: no `math/rand` for security-sensitive operations,
     no `==` on secrets, no constant-time comparisons missing where
     required, no private key `String()`/`Format()`/`GoString()`
     equivalents, no logged secrets.
   - **Architecture**: no forbidden dependency directions. See
     `AGENTS.md` for the project's dependency rules.
   - **Testing**: known-answer tests cite their source. Negative tests
     present. Boundary tests present. No skipped tests. Fuzz targets
     for parser surfaces where applicable. Example functions for the
     public API where applicable.
   - **Style**: follow the project's style conventions in `AGENTS.md`
     (e.g. concrete structs not interfaces unless consumer-side with
     multiple implementations, explicit constructors, no reflection
     DI, no interface inflation).
   - **Plan completion**: every task in the plan is `done`. Every
     completion criterion in the plan is met.

5. Collect findings. Categorize as must-fix, should-fix, nit.

6. Apply must-fix and should-fix changes.

7. Re-run verification commands. All must pass.

8. Check branch protection:
   - Branch protection is intact on the protected branch (no direct
     push, no force push, PR required).
   - The PR description summarizes what changed and why.
   - All CI checks pass.

9. If all checks pass, the PR is ready to merge (squash or rebase per
   AGENTS.md branching rules).

## Inputs

- The full diff (`git diff protected...feature`)
- The plan file (`plans/PLAN-NNN.md`) being shipped
- Any project-specific reference files (for documentation citation
  verification)
- `AGENTS.md` (for conventions)

## Outputs

- Review findings (must-fix, should-fix, nit)
- Applied fixes with re-verification
- PR ready to merge (or back to `in_progress` if must-fix issues found)

## Constraints

- No code is merged to the protected branch without passing this
  review.
- No skipped tests are ever acceptable in a review-passing test suite.
- If the review finds a fundamental design problem, set the plan back
  to `in_progress` and flag it to the user.
- The reviewer has project context (mission, architecture, rules from
  files). It judges the diff against the rules and the plan.
- The project's vulnerability scanner (if applicable) must pass. Any
  known vulnerability in a dependency blocks the merge.
