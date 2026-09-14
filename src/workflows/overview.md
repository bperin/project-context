# Workflow Overview

## Full Lifecycle

```mermaid
flowchart TD
    INPUT["User input"] --> EPIC{"High-level vision?<br/>Multiple features?"}
    EPIC -->|yes| ROADW["pc-epic<br/>planning-brain(adhd) → write epic → review → [approve]"]
    EPIC -->|no| PLANW["pc-spec<br/>planning-brain(adhd) → write spec → review → [approve]<br/>planning-brain(adhd) → write plan → review → [approve]"]
    ROADW -->|item ready| PLANW
    PLANW -->|committed| TASKW["pc-create-tasks<br/>planning-brain → task MDs + JSONL → review"]
    TASKW -->|committed| IMPL["pc-implement<br/>implementer writes code + tests → self-review"]
    IMPL -->|all tasks done| PLANREV["Plan review<br/>reviewer checks spec coverage"]
    PLANREV -->|pass| PR["Open PR"]
    PLANREV -->|MUST-FIX| IMPL
    PR -->|checks pass| MERGE["squash-merge"]
    PLANW -->|MUST-FIX after revision| ESC["Escalate to user"]
    TASKW -->|MUST-FIX after revision| ESC
```

## Plan Workflow

```mermaid
flowchart TD
    ADHD1["planning-brain<br/>loads adhd — problem ideation"] --> WRITESPEC["Write spec"]
    WRITESPEC --> REV1["Dispatch reviewer<br/>spec criteria: high-level"]
    REV1 --> FIX1{"MUST-FIX?"}
    FIX1 -->|yes| REVISE1["Revise"] --> REV1
    FIX1 -->|no| GATE1["STOP — user approves spec"]
    GATE1 --> ADHD2["planning-brain<br/>loads adhd — approach ideation"]
    ADHD2 --> WRITEPLAN["Write plan"]
    WRITEPLAN --> REV2["Dispatch reviewer<br/>plan criteria: spec coverage"]
    REV2 --> FIX2{"MUST-FIX?"}
    FIX2 -->|yes| REVISE2["Revise"] --> REV2
    FIX2 -->|no| GATE2["STOP — user approves plan"]
    GATE2 --> COMMIT["Commit + END"]
```

## Task Implementation

```mermaid
flowchart TD
    CTX["Select ≤3 ready, disjoint tasks"] --> P["Background implementer wave<br/>each writes code + tests + self-reviews"]
    P --> V["Integrated mechanical verification"]
    V --> COM["Commit + done"]
    COM --> ALLDONE{"All tasks in plan done?"}
    ALLDONE -->|no| CTX
    ALLDONE -->|yes| PLANREV["Plan review<br/>reviewer checks spec coverage"]
    PLANREV -->|MUST-FIX| P
    PLANREV -->|pass| PR["Open PR"]
```

## Control Plane

### Triggers

| Skill | When |
|-------|------|
| `/pc-epic` | User describes a high-level vision with multiple features |
| `/pc-spec` | User describes what to build, or refining a epic item |
| `/pc-create-tasks` | After plan committed |
| `/pc-implement` | Task moves to `in_progress` |
| `/pc-review` | Plan review passed, PR ready |
| `/pc-inspect-project` | Anytime |
| `/pc-context` | Build a context packet |
| `/pc-uuid` | New spec/plan/task needs UUID |

### State transitions

```
EPIC: draft → committed → in_progress → done → superseded
SPEC:    draft → committed → done → superseded
PLAN:    draft → committed → in_progress → done → superseded
TASK:    draft → in_progress → done → superseded
```

### Concurrency

1. Up to three dependency-ready implementation tasks with disjoint write sets.
2. Task creation may use up to four pinned read-only analysts in parallel; one
   planning-brain serializes every Markdown and JSONL change.
3. Implementers may run as a bounded background wave; each self-reviews.
4. One review pass per artifact. If MUST-FIX after one revision,
   escalate.

### Escalation

1. Plan/task workflow: one revision, then escalate.
2. Implementation: implementer self-reviews, one correction pass, then escalate.
3. Plan review: one correction pass, then escalate.
4. PR readiness: checks fail or tasks not done, stop and escalate.

### Skill loading

1. `adhd` is loaded by `planning-brain` in spec and plan phases. Not
   during task writing — tasks are concrete.
2. Planning-brain does not load any other skills during task writing.
3. Implementer loads only the skills from the context packet's
   `allSkills` field and `pc-optimize`.
4. Reviewer uses phase-specific criteria — no skill loading.
