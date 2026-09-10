# Workflow Overview

<!-- Mermaid diagrams render inline in GitHub and most IDEs. -->

## Full Lifecycle

```mermaid
flowchart TD
    SPEC["SPEC written"] --> SPECW["spec-creation workflow<br/>orchestrator + adhd - research - reviewer<br/>max 3 rounds"]
    SPECW -->|committed| PLAN["PLAN written"]
    PLAN --> PLANW["plan-creation workflow<br/>orchestrator + adhd - research - reviewer<br/>max 3 rounds"]
    PLANW -->|committed| TASK["TASK written"]
    TASK --> TASKW["task-creation workflow<br/>orchestrator + adhd - reviewer<br/>max 3 rounds"]
    TASKW -->|committed| IMPL["task-implementation workflow"]
    IMPL -->|tests fail| TF["test-failure workflow<br/>triage - fix - re-run<br/>max 3 rounds"]
    TF -->|fixed| IMPL
    TF -->|unresolved| ESC["Escalate to user"]
    IMPL -->|all tasks done| PR["PR review workflow"]
    PR -->|checks pass| MERGE["squash-merge"]

    SPECW -->|issues found| SPEC
    PLANW -->|issues found| PLAN
    TASKW -->|issues found| TASK

    style SPECW fill:#BDD7EE,stroke:#1F4E79
    style PLANW fill:#BDD7EE,stroke:#1F4E79
    style TASKW fill:#BDD7EE,stroke:#1F4E79
    style IMPL fill:#C6EFCE,stroke:#006100
    style TF fill:#FFC7CE,stroke:#9C0006
    style ESC fill:#FFC7CE,stroke:#9C0006
    style PR fill:#FFEB9C,stroke:#9C5700
    style MERGE fill:#C6EFCE,stroke:#006100
```

## Spec / Plan / Task Creation (shared pattern)

```mermaid
flowchart TD
    START["Orchestrator loads adhd + primary skill"] --> R1["Round 1"]
    R1 --> WRITER["Orchestrator writes draft"]
    WRITER --> OPT["Reviewer reviews<br/>read-only, has context<br/>can challenge approach"]
    OPT --> CHECK{"Issues found?"}
    CHECK -->|no| DONE["Committed"]
    CHECK -->|yes| ROUND{"Round < 3?"}
    ROUND -->|yes| WRITER
    ROUND -->|no| ESCALATE["Escalate to user"]

    style DONE fill:#C6EFCE,stroke:#006100
    style ESCALATE fill:#FFC7CE,stroke:#9C0006
    style OPT fill:#BDD7EE,stroke:#1F4E79
```

## Task Implementation (assembly line)

```mermaid
flowchart TD
    O["Orchestrator loads adhd"] --> CTX["Build context packet"]
    CTX --> P["Implementer<br/>foreground, write access<br/>loads primary skill"]
    P --> CODE["Implements code + initial tests"]
    CODE --> V1["build, vet, test, lint"]
    V1 --> CR["Reviewer<br/>background, read-only<br/>loads code-review skill"]
    CR --> CRC{"Findings?"}
    CRC -->|MUST-FIX| BACK1["Implementer fixes"]
    BACK1 --> V2["build, vet, test, lint"]
    V2 --> CR
    CRC -->|pass| TA["Testing agent<br/>background, write access<br/>loads testing skill"]
    TA --> TAC{"All tests pass?"}
    TAC -->|fail| TF["test-failure workflow<br/>triage: code bug / test bug / design issue<br/>max 3 rounds, escalate"]
    TF -->|fixed| TA
    TF -->|unresolved| ESC["Escalate to user"]
    TAC -->|pass| COM["Commit"]
    COM --> DONE["Task done"]

    CR -.->|orchestrator moves to next task<br/>while review runs| NEXT["Start TASK-N+1"]

    style O fill:#C6EFCE,stroke:#006100
    style P fill:#C6EFCE,stroke:#006100
    style CR fill:#D9D9D9,stroke:#595959
    style TA fill:#FFEB9C,stroke:#9C5700
    style TF fill:#FFC7CE,stroke:#9C0006
    style DONE fill:#C6EFCE,stroke:#006100
    style NEXT fill:#E2EFDA,stroke:#006100
```

## PR Review

```mermaid
flowchart TD
    START["All tasks in plan done"] --> MECH["Mechanical checks<br/>lint, vet, test, vulncheck"]
    MECH --> CHK{"All pass?"}
    CHK -->|no| FIX["Fix failures"]
    FIX --> MECH
    CHK -->|yes| DIFF["git diff base...head"]
    DIFF --> AGENT["Reviewer subagent<br/>full project context"]
    AGENT --> FIND["Collect findings<br/>MUST-FIX / SHOULD-FIX / NIT"]
    FIND --> APPLY["Apply MUST-FIX + SHOULD-FIX"]
    APPLY --> REV["Re-run verification"]
    REV --> RC{"All pass?"}
    RC -->|no| APPLY
    RC -->|yes| OPENPR["Open PR"]
    OPENPR --> MERGE["Squash-merge after CI passes"]

    style START fill:#C6EFCE,stroke:#006100
    style AGENT fill:#D9D9D9,stroke:#595959
    style MERGE fill:#C6EFCE,stroke:#006100
    style OPENPR fill:#FFEB9C,stroke:#9C5700
```

## Control Plane

The control plane is the set of rules the orchestrator follows to decide **when to run which skill**, **in what order**, and **how to transition state**. It is not a skill itself — it is the protocol every orchestrator skill implements.

### Trigger conditions

| Skill | Trigger | When to invoke |
|-------|---------|----------------|
| `/spec` | user or model | When a new spec is needed or an existing spec is being revised |
| `/approve-spec` | user or model | After a spec is committed and ready for planning |
| `/plan` | user or model | When an approved spec needs a plan, or a plan needs revision |
| `/approve-plan` | user or model | After a plan is committed and ready for task creation |
| `/create-task` | user or model | When an approved plan needs tasks, or a task needs revision |
| `/implement` | user or model | When a committed task's status is set to `in_progress` |
| `/review` | user or model | When all tasks in a plan are `done` and a PR is ready |
| `/inspect-project` | user or model | Anytime the agent needs a current view of the xlsx |
| `/context` | model | During orchestration to build a packet for a subagent |
| `/uuid` | model | Whenever a new spec/plan/task needs a UUID |
| `/spec-optimizer` | model only | Spawned by `/create-spec` during review |
| `/plan-optimizer` | model only | Spawned by `/create-plan` during review |
| `/task-optimizer` | model only | Spawned by `/create-task` during review rounds |

### State transitions

Status values flow through the lifecycle:

```
SPEC:    draft → review → committed → approved → done → superseded
PLAN:    draft → review → committed → approved → in_progress → done → superseded
TASK:    draft → review → committed → in_progress → done → superseded
```

- `draft` — document is being written or revised.
- `review` — the document is in the reviewer loop.
- `committed` — review passed; the document is authoritative.
- `in_progress` — for plans and tasks, implementation has started.
- `done` — all work is complete (tasks) or the spec/plan has been delivered.
- `superseded` — a later version replaces this one; kept for history.

The orchestrator updates the xlsx **after** the step that produced a state change, not before. A task is not set to `done` until all tests pass and the commit is pushed.

### Concurrency rules

1. **The reviewer runs after the orchestrator writes.** It is read-only and reports findings. The orchestrator revises.
2. **Reviewer and implementer can overlap.** The reviewer runs in the background while the orchestrator moves on to the next task.
3. **Testing agent runs after review passes.** It can run in the background; the orchestrator monitors.
4. **No nested subagents by default.** The optimizers do not spawn their own subagents. Custom profiles can set `max-nesting` if needed, but the default workflow does not use nested subagents.

### Escalation rules

1. **Creation review (spec/plan/task):** max 3 rounds of review. If the document still has MUST-FIX or SHOULD-FIX issues after round 3, the orchestrator stops and escalates to the user with:
   - The document path
   - The unresolved findings
   - A summary of what has changed across the 3 rounds
   - A recommendation of what to do next
2. **Implementation:** if the implementer cannot make build/test pass after 3 fix attempts, escalate. The testing agent failing triggers the test-failure workflow (`workflows/test-failure.md`) — a structured triage loop, not free-form fixing. If the test-failure workflow exhausts its 3 rounds, escalate to the user.
3. **PR review:** if mechanical checks fail repeatedly or the reviewer finds security-critical MUST-FIX issues, stop and escalate.

### Failure and retry rules

1. **Subagent fails to start or returns an error.** Do not treat this as a finding. Retry once. If the subagent fails twice, report the error to the user and stop the workflow.
2. **Subagent findings are empty.** If the reviewer returns no findings, the document passes. Do not invent findings.
3. **Subagent returns only NITs.** NITs do not block the round. The orchestrator may apply them or commit the document as-is. Do not spawn another round for NITs alone.
4. **Tool call denied in a background subagent.** Background subagents cannot ask for new permissions. If a subagent fails because a tool was denied, resume it in the foreground or re-run it with the needed permissions.

### Skill loading rules

1. The orchestrator builds a context packet for the target spec/plan/task.
2. The context packet's `allSkills` field lists every skill that applies (cascaded from target → parent → grandparent, deduplicated).
3. The orchestrator loads the primary skill first using `skill invoke --skill <name>`.
4. Secondary skills are loaded later by the appropriate subagent.
5. The `adhd` skill is loaded during the writer phase for divergent ideation in spec/plan/task creation.

### Exit and hand-off rules

1. A `/create-spec` workflow exits when the spec is committed. It does not auto-start planning. Use `/approve-spec SPEC-NNN` to approve the spec and start `/create-plan`.
2. A `/create-plan` workflow exits when the plan is committed. Use `/approve-plan PLAN-NNN` to approve the plan and start `/create-task` for each task.
3. A `/create-task` workflow exits when all tasks for a plan are committed. It hands off to `/implement` when a task moves to `in_progress`.
4. An `/implement` workflow exits when the task is `done`. It triggers the hook that may spawn the next session.
5. A `/review` workflow exits when the PR is merged or the user aborts.
