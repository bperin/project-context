# AGENTS.md — project-context

> **Source of truth for this repository.** This package generates
> `.{reponame}-manager` workspaces in other repositories. It is not itself a
> generated manager workspace.

## Product contract

The canonical hierarchy is `PLAN-NNN → TASK-NNN`. There are no epic or separate
specification artifacts. A generated workspace exposes one user-facing workflow
skill:

```text
/pc-plan start <goal>
/pc-plan continue [PLAN-NNN]
/pc-plan status [PLAN-NNN]
/pc-plan run [PLAN-NNN]
```

All lower-level commands are internal mechanics of this workflow.

Only one plan may be non-terminal. The plan and append-only task JSONL are the
recovery state; `continue` and `run` resume at the first incomplete persisted
gate without requiring conversation history.

Plan states use `committed` after explicit user acceptance. The Planning Gate
still records `User accepted: yes`.

## Source layout

```text
project-context/
├── bin/cli.js
├── src/
│   ├── agents/                  # Narrow writer and challenger profiles
│   ├── commands/                # Internal CLI mechanics
│   ├── skills/
│   │   ├── AGENTS.md
│   │   └── pc-plan/SKILL.md     # Sole generated workflow skill
│   ├── templates/               # PLAN, TASK, and generated AGENTS assets
│   └── workflows/
│       ├── pc-plan.md           # Full persisted lifecycle
│       └── overview.md          # Compact lifecycle map
├── scripts/task-done-hook.js
└── test/
```

## Generated model

```text
.<repository>-manager/
├── AGENTS.md
├── .agents/
│   ├── AGENTS.md
│   ├── agents/
│   └── skills/pc-plan/SKILL.md
├── workflows/{pc-plan.md,overview.md}
├── templates/{PLAN-NNN.template.md,TASK-NNN.template.md}
├── plans/PLAN-NNN.md
├── tasks/TASK-NNN.md
├── data/tasks.jsonl
├── graph/
└── tools/project-context
```

Plan and task Markdown are living artifacts. Task and timeline JSONL are
append-only; never rewrite prior events.

## Planning ownership

The root planning agent owns repository discovery, the compact draft,
self-challenge, user questions, revision, acceptance, task decomposition,
integration, and manager-state writes.

The gate order is:

```text
discover → draft → self-challenge → questions → revise
→ explicit acceptance → decompose → implement → verify → complete
```

Planning uses executable `grilling`; `grill-me` is its wrapper. `adhd` is used
only for genuinely open-ended design. Blocking questions halt acceptance and
task creation. Advisory questions remain in the plan with a current assumption.

Material revisions clear acceptance. Persist each gate before advancing.

## Project memory

Generated repositories configure the MemoryLake MCP endpoint in their local
`.codex/config.toml`. The manager's `data/identity.json` carries the logical
workspace/project binding and optional non-secret IDs. Every MemoryLake search
or write must use the exact project ID; never mix project memories through an
unfiltered workspace search.

The root planning agent owns durable memory writes. Subagents return candidate
facts with evidence. Store accepted decisions, durable constraints, and verified
outcomes only—never credentials, raw reasoning, transient output, or speculation.
Local plan/task state remains authoritative.

## Implementation contract

Every task packet has exact files and symbols, boundaries, dependencies,
do-not-touch constraints, tests, verification commands, proof obligations, and
planning-gap conditions.

Many writers may run over the lifetime of a plan, but at most three may run
simultaneously. They must be dependency-ready and have disjoint exact write
sets. Unknown ownership is sequential.

Writers never ask the user, load planning skills, expand scope, commit, or
mutate manager state. Missing or contradictory planning returns
`needs_planning` with evidence to the root planning agent. Exactly one
challenger reviews each completed packet. Commits and state mutations are
serial.

## Engineering conventions

- No Python for core tooling. Do not modify dead Python scripts.
- No shell scripts for core logic; shell is acceptable for CI.
- Use append-only events for task history.
- Preserve unrelated work in dirty worktrees.
- Use `apply_patch` for manual source edits.
- Use conventional commits with imperative subjects under 72 characters.
- Never add AI attribution or co-authorship trailers.
- Generated Markdown is marked as generated and updated through `upgrade`.
- The framework carries workflow structure, not project-specific content.

## Testing

```bash
npm test
```

Run focused checks while iterating and the full suite before handoff when code or
tests change. Documentation-only work still requires `git diff --check` and a
stale-reference scan.
