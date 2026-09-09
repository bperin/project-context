# AGENTS.md — project-context

> **Purpose:** A project context protocol that gives AI coding agents
> structured, machine-readable project understanding — replacing the
> "search files to understand the project" pattern with a compiled
> context packet. Cross-IDE, graph-first, RAG-fallback.

## Quick reference

| Task | Command |
|------|---------|
| Bootstrap a project | `bash scripts/setup-project-context.sh` |
| View templates | `ls templates/` |
| Read the spec | `spec/00-thesis.md` |

## Structure

```
project-context/
├── spec/               — protocol specification
├── templates/          — blank reusable templates
├── scripts/            — setup and tooling scripts
│   └── setup-project-context.sh
└── AGENTS.md
```

## Context hierarchy

```
PROJECT CONTEXT
│
├── Identity          — name, purpose, stack, repo
├── Architecture      — domains, services, boundaries, dependencies
├── Current State     — active work, completed, blocked, known problems
├── Specs             — requirements / invariants
├── Plans             — implementation sequences
├── Tasks             — dependencies, status, affected code
├── Decisions         — ADRs / why things are the way they are
├── Workflows         — how agents are expected to operate
├── Skills            — capabilities agents can invoke
└── Knowledge         — semantic / historical (Qdrant backend)
```

## Conventions

- All context files are markdown.
- Templates use `<placeholder>` for fill-in fields and `<!-- comments -->` for
  instructions. Active instances have no placeholder text.
- IDs are monotonically increasing: SPEC-001, PLAN-001, TASK-001, ADR-001.
  Never reuse or renumber.
- Lifecycle: `todo → in_progress → review → done`. Blocked: `in_progress → blocked`.
- Superseding is explicit: every spec/plan/task/ADR has a Supersedes section.

## Relationship to existing systems

This project consolidates patterns from:
- **GAPS** — PLAN.md + task briefs
- **ghost-protocol ai-workspace** — SPEC→PLAN→TASK + AGENTS.md + DECISIONS.md
- **trakt2 ai-workspace** — same pattern, multi-repo
- **landman .ai-mineral-workflow** — same pattern, multi-repo
- **setup-kilo-project-interactive.sh** — interactive bootstrap script

It formalizes what those projects already do into a reusable protocol.
