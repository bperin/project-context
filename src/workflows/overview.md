# Workflow Overview

## Full Lifecycle

```mermaid
flowchart TD
    INPUT["User input"] --> PLANW["pc-plan<br/>adhd once → spec → review → plan → review"]
    PLANW -->|committed| TASKW["pc-create-tasks<br/>task-writer → task MDs + JSONL → review"]
    TASKW -->|committed| IMPL["pc-implement<br/>implement + tests → verify → focused review"]
    IMPL -->|one correction needed| TF["bounded correction<br/>one pass"]
    TF -->|fixed| IMPL
    TF -->|unresolved| ESC["Escalate to user"]
    IMPL -->|all tasks done| PR["PR review"]
    PR -->|checks pass| MERGE["squash-merge"]
    PLANW -->|MUST-FIX after revision| ESC
    TASKW -->|MUST-FIX after revision| ESC
```

## Plan Workflow

```mermaid
flowchart TD
    ADHD["adhd (once)"] --> WRITESPEC["Write spec"]
    WRITESPEC --> REV1["Dispatch reviewer"]
    REV1 --> FIX1{"MUST-FIX?"}
    FIX1 -->|yes| REVISE1["Revise"] --> REV1
    FIX1 -->|no| GATE1["STOP — user approves spec"]
    GATE1 --> WRITEPLAN["Write plan"]
    WRITEPLAN --> REV2["Dispatch reviewer"]
    REV2 --> FIX2{"MUST-FIX?"}
    FIX2 -->|yes| REVISE2["Revise"] --> REV2
    FIX2 -->|no| GATE2["STOP — user approves plan"]
    GATE2 --> COMMIT["Commit + END"]
```

## Task Implementation

```mermaid
flowchart TD
    CTX["Select ≤3 ready, disjoint tasks"] --> P["Background implementer wave"]
    P --> V["Integrated mechanical verification"]
    V --> CR["Focused reviewer"]
    CR -->|"MUST-FIX: one pass"| P
    CR -->|pass| COM["Commit + done"]
```

## Control Plane

### Triggers

| Skill | When |
|-------|------|
| `/pc-plan` | User describes what to build |
| `/pc-create-tasks` | After plan committed |
| `/pc-implement` | Task moves to `in_progress` |
| `/pc-review` | All tasks done, PR ready |
| `/pc-inspect-project` | Anytime |
| `/pc-context` | Build a context packet |
| `/pc-uuid` | New spec/plan/task needs UUID |

### State transitions

```
SPEC:    draft → committed → done → superseded
PLAN:    draft → committed → in_progress → done → superseded
TASK:    draft → in_progress → done → superseded
```

### Concurrency

1. Up to three dependency-ready implementation tasks with disjoint write sets.
2. Task creation may use up to four pinned read-only analysts in parallel; one
   task-writer serializes every Markdown and JSONL change.
3. Implementers may run as a bounded background wave; reviews and state changes
   remain sequential.
4. One review pass per artifact. If MUST-FIX after one revision,
   escalate.

### Escalation

1. Plan/task workflow: one revision, then escalate.
2. Implementation: one correction pass, then escalate.
3. Test failure: one correction pass, then escalate.
4. PR review: security-critical MUST-FIX, stop and escalate.

### Skill loading

1. `adhd` runs ONCE, by the orchestrator, before the spec.
2. Task-writer does not load `adhd` or any skills.
3. Implementer loads the task's primary skill.
4. Code-optimizer loads performance skills only when conditionally dispatched.
5. Reviewer loads the project's code-review skill.
