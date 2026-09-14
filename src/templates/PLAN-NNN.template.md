# PLAN-NNN: <short title>

**UUID**: {{UUID}}
**Status**: {{STATUS}}
**Parent**: {{PARENT}}
**Dependencies**: {{DEPENDENCIES}}
**Skills**: {{SKILLS}}
**Triggers**: {{TRIGGERS}}
**Commit**: {{COMMIT}}

## Supersedes

- Supersedes: <!-- PLAN-NNN, or "none" -->
- Reason:
- Superseded by: <!-- PLAN-NNN, or "none" -->

## Status

- **Progress**: 0% (0 of N tasks done)
- **Tasks**: <!-- TASK-NNN IDs, or "none yet" -->

## Source Specification

SPEC-NNN — <short title> (`specs/SPEC-NNN.md`)

## Requirements

<!-- Requirements from the source spec that this plan implements. -->

1.

## Objective

<!-- What this plan achieves. -->

## System Map

```
┌─────────────────────────────────────┐
│  <Component A>                      │
│  - <responsibility>                 │
└──────────┬──────────────────────────┘
           │  <transport>
     ┌─────▼──────────────────────────┐
     │  <Component B>                  │
     │  - <responsibility>             │
     └────────────────────────────────┘
```

## Repositories

| Path | Role | Description |
|---|---|---|
| `<repo>/` | | |

## Architecture

### New package: `<name>/`

```
<package>/
├── <module>          # <one-line responsibility>
└── ...
```

### Key design decisions

1. **<decision>** — <rationale>

## Communication Topology

| Path | Transport | Purpose |
|---|---|---|
| <A → B> | | |

## Data / Ownership

- **<data category>**: <owner / location>

## Workstreams

| ID | Workstream | Tasks |
|---|---|---|
| W1 | | TASK-NNN |

### Workstream details

#### W1 — <name>
- Algorithms:
- Primary skill:
- Secondary skills:
- Test vectors:
- Negative tests:
- Files:

## Out of Scope

-

## Dependencies

### External packages (to add)

### Existing code dependencies (read-only)

## Constraints

-

## Current Focus

**TASK-NNN: <title>** — <why this is next>

## Completion Criteria

1.
2.

## Acceptance Criteria

1.

## Security Considerations

- Algorithms:
- Required skills:
- Attack surfaces:
- Verification: `govulncheck ./...`, `go test -race ./...`

## Linked Tasks

- `tasks/TASK-NNN.md` — <one-line summary>
