# Workflow Overview

## Full Lifecycle

```mermaid
flowchart TD
    INPUT["User input"] --> PLANW["plan-workflow<br/>adhd once → spec → review → plan → review"]
    PLANW -->|committed| TASKW["task-workflow<br/>task-writer → task MDs + JSONL → review"]
    TASKW -->|committed| IMPL["task-implementation<br/>implementer → code-optimizer → reviewer → test-agent"]
    IMPL -->|tests fail| TF["test-failure<br/>max 3 rounds"]
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
    CTX["Context packet"] --> P["Implementer"]
    P --> CO["Code-optimizer"]
    CO --> CR["Reviewer"]
    CR -->|"MUST-FIX"| P
    CR -->|pass| TA["Test-agent"]
    TA -->|"fail"| TF["test-failure workflow"]
    TA -->|pass| COM["Commit + done"]
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

1. One task at a time. No parallel lanes.
2. Subagents run sequentially. Each finishes before the next starts.
3. One review pass per artifact. If MUST-FIX after one revision,
   escalate.

### Escalation

1. Plan/task workflow: one revision, then escalate.
2. Implementation: 3 fix attempts, then escalate.
3. Test failure: 3 rounds, then escalate.
4. PR review: security-critical MUST-FIX, stop and escalate.

### Skill loading

1. `adhd` runs ONCE, by the orchestrator, before the spec.
2. Task-writer does not load `adhd` or any skills.
3. Implementer loads the task's primary skill.
4. Code-optimizer loads the project's language skills.
5. Reviewer loads the project's code-review skill.
6. Test-agent loads the project's testing skill.
