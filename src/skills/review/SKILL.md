---
name: review
description: "Run the code-review workflow — mechanical checks, review subagent, apply findings, open PR"
argument-hint: "[PLAN-NNN]"
triggers:
  - user
  - model
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
  - run_subagent
  - read_subagent
  - skill
permissions:
  allow:
    - Read(**)
    - Edit(src/**)
    - Write(src/**)
    - Exec(node **)
    - Exec(npm **)
    - Exec(git **)
---

> **Read [`.agents/AGENTS.md`](../AGENTS.md) first.** It defines the shared protocol, CLI commands, context packets, and rules for all skills.

You are running the **code-review workflow** for this project.

Read the full workflow at `workflows/code-review.md` before starting. Follow it exactly.

## Steps

1. **Mechanical checks.** Run the project's lint, vet, test, and vulnerability scanner commands.

2. **Diff review.** Run `git diff <protected>...<feature>` to see all changes.

3. **Spawn review subagent** (background, read-only, no conversation context). Feed it:
   - The diff
   - AGENTS.md path
   - The project's code-review skill (if installed)
   - Full project context (file paths, architecture)

4. **Collect findings.** The subagent returns MUST-FIX, SHOULD-FIX, NIT.

5. **Apply MUST-FIX + SHOULD-FIX.** Fix the issues directly.

6. **Re-run verification.** Lint, vet, test must all pass.

7. **Open PR.** If all checks pass, open a PR from the feature branch to the protected branch. Title: `PLAN-NNN: <plan name>`. Body: list completed tasks.

8. **Report.** Summarize findings, fixes applied, and PR link.
