# PLAN-NNN: <short title>

**UUID**: {{UUID}}
**Status**: draft
**Parent**: {{PARENT}}
**Dependencies**: {{DEPENDENCIES}}
**Skills**: {{SKILLS}}
**Triggers**: {{TRIGGERS}}
**Commit**: {{COMMIT}}

<!-- Template hierarchy: SPEC-NNN → plans/PLAN-NNN.md → tasks/TASK-NNN.md -->
<!-- Copy to plans/PLAN-NNN.md. Replace NNN with the real ID. -->
<!-- The PLAN describes HOW the system is built — architecture, not what/why. -->
<!-- The SPEC (in specs/SPEC-NNN.md) describes what/why. Do not duplicate it here. -->

## Supersedes

<!-- If this plan replaces an earlier one, list it here with a reason. -->
<!-- Delete this section if this is the first plan for this SPEC. -->
<!-- When a newer plan supersedes THIS one, add "Superseded by: PLAN-NNN" below. -->

- Supersedes: <!-- PLAN-NNN, or "none" -->
- Reason: <!-- why the old plan is no longer accurate — architecture changed, features removed, etc. -->
- Superseded by: <!-- filled in when a newer plan replaces this one, or "none" -->

## Status

<!-- Lifecycle: draft → review → committed → in_progress → done → superseded -->
<!-- draft: being written (adhd + writer) -->
<!-- review: reviewer running -->
<!-- committed: passed review, committed to dev -->
<!-- in_progress: tasks under this plan are being implemented -->
<!-- done: all tasks under this plan are done, PR merged to master -->
<!-- superseded: replaced by a newer plan -->

- **Progress**: 0% (0 of N tasks done)
- **Tasks**: <!-- list tasks created from this plan, or "none yet" -->

## Source Specification

<!-- Which SPEC this plan implements. -->

SPEC-NNN — <short title> (`specs/SPEC-NNN.md`)

## Requirements

<!-- The requirements from the source spec that this plan implements. -->
<!-- Each workstream below must trace to one or more of these. -->

1. 

## Objective

<!-- One-paragraph summary of what this plan achieves. -->

## System Map

<!-- ASCII diagram of the major components and their relationships. -->
<!-- Show every process boundary, transport, and data flow. -->

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

<!-- List every repository involved and its role. -->
<!-- Not every repository in the project is necessarily relevant. -->

| Path | Role | Description |
|---|---|---|
| `<repo>/` | | |

## Architecture

### New package: `<name>/`

```
<package>/
├── __init__.py
├── <module>.py          # <one-line responsibility>
└── ...
```

### Key design decisions

<!-- Numbered list of architectural decisions. -->
<!-- Record durable decisions in DECISIONS.md as ADR-NNN. -->

1. **<decision>** — <rationale>
2. **<decision>** — <rationale>

## Communication Topology

<!-- Every inter-component communication path and its transport. -->
<!-- Do not assume HTTP. Consider WebSocket, gRPC, SSE, queues, Pub/Sub, etc. -->

| Path | Transport | Purpose |
|---|---|---|
| <A → B> | | |

## Data / Ownership

<!-- Who owns each piece of data. Where it's stored. Ephemeral vs durable. -->

- **<data category>**: <owner / location>

## Workstreams

<!-- Group tasks into workstreams by concern. -->
<!-- Task IDs are monotonically increasing across all files in tasks/. -->
<!-- Each task here links to its task file in tasks/TASK-NNN.md. -->
<!-- For each workstream that implements an algorithm, list: -->
<!--   - algorithm IDs from the project's algorithm registry -->
<!--   - primary and secondary skills (from the algorithm's skill field) -->
<!--   - exact test vector sources (RFC section, NIST case ID) -->
<!--   - negative tests -->
<!--   - file paths to create/modify -->

| ID | Workstream | Tasks |
|---|---|---|
| W1 | | TASK-NNN |

### Workstream details

<!-- One subsection per workstream with algorithm IDs, skills, vectors, -->
<!-- negative tests, and file paths. -->

#### W1 — <name>
- Algorithms: 
- Primary skill: 
- Secondary skills: 
- Test vectors: 
- Negative tests: 
- Files: 

## Out of Scope

<!-- Explicitly list what this plan does NOT implement. Be honest. -->
<!-- Features here belong in a future plan or spec. -->

- 

## Dependencies

### External packages (to add)
<!-- Third-party packages that must be added as dependencies. -->

### Existing code dependencies (read-only, not modified)
<!-- Existing modules/functions that new code depends on but must not modify. -->

## Constraints

<!-- Hard constraints the implementation must respect. Non-negotiable. -->

- 

## Current Focus

<!-- The single task that should be executed next, with a one-line rationale. -->

**TASK-NNN: <title>** — <why this is next>

## Completion Criteria

<!-- Observable, testable conditions that mean the plan is fully delivered. -->

1. 
2. 

## Acceptance Criteria

<!-- Concrete, verifiable conditions that must hold for this plan to be -->
<!-- considered done. Each maps to a requirement and is objectively -->
<!-- checkable (command, grep, test run). Include verification commands: -->
<!--   go test ./... ; go vet ./... ; go test -race ./... ; govulncheck ./... -->

1. 

## Research Findings

<!-- Populated from the research agent (decisions/PLAN-NNN-research.md). -->
<!-- Cite governing standards, test vector sources, and known attack -->
<!-- vectors from primary sources. Do not invent citations. -->

- See `decisions/PLAN-NNN-research.md`

## Security Considerations

<!-- Only if this plan touches crypto, auth, or security primitives. -->
<!-- List algorithms (by registry ID), required skills, attack surfaces, -->
<!-- and the verification commands that must pass before merge. -->

- Algorithms: 
- Required skills: 
- Attack surfaces: 
- Verification: `govulncheck ./...`, `go test -race ./...`

## Linked Tasks

<!-- Every task file created from this plan. -->
<!-- The Architect copies TASK-NNN.template.md → tasks/TASK-NNN.md for each. -->

- `tasks/TASK-NNN.md` — <one-line summary>

## Review Findings

<!-- Filled in during the planning workflow. One row per finding. -->

| Round | Reviewer | Type | Finding | Resolution |
|---|---|---|---|---|
| | | | | |
