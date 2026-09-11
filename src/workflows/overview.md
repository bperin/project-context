# Workflow Overview

<!-- Mermaid diagrams render inline in GitHub and most IDEs. -->

## Full Lifecycle

```mermaid
flowchart TD
    INPUT["User describes what they want built"] --> PLANW["plan-workflow<br/>orchestrator loads adhd once<br/>writes spec → reviewer → writes plan → reviewer<br/>one continuous context"]
    PLANW -->|committed| TASKW["task-workflow<br/>task-writer reads spec + plan<br/>thinks through implementations<br/>writes task MDs + JSONL build order → reviewer"]
    TASKW -->|committed| IMPL["task-implementation<br/>implementer → code-optimizer → reviewer → tester<br/>one task at a time, sequential"]
    IMPL -->|tests fail| TF["test-failure workflow<br/>triage - fix - re-run<br/>max 3 rounds"]
    TF -->|fixed| IMPL
    TF -->|unresolved| ESC["Escalate to user"]
    IMPL -->|all tasks done| PR["PR review workflow"]
    PR -->|checks pass| MERGE["squash-merge"]

    PLANW -->|MUST-FIX after revision| ESC
    TASKW -->|MUST-FIX after revision| ESC

    style PLANW fill:#BDD7EE,stroke:#1F4E79
    style TASKW fill:#BDD7EE,stroke:#1F4E79
    style IMPL fill:#C6EFCE,stroke:#006100
    style TF fill:#FFC7CE,stroke:#9C0006
    style ESC fill:#FFC7CE,stroke:#9C0006
    style PR fill:#FFEB9C,stroke:#9C5700
    style MERGE fill:#C6EFCE,stroke:#006100
```

## Plan Workflow (spec + plan in one context)

```mermaid
flowchart TD
    START["Orchestrator loads adhd"] --> THINK["Think about problem<br/>from multiple angles"]
    THINK --> WRITESPEC["Write spec<br/>what, why, scope"]
    WRITESPEC --> REV1["Dispatch reviewer<br/>checks spec"]
    REV1 --> FIX1{"MUST-FIX?"}
    FIX1 -->|yes| REVISE1["Revise spec"]
    REVISE1 --> REV1
    FIX1 -->|no| GATE1["User approves spec"]
    GATE1 --> WRITEPLAN["Write plan<br/>same context, no re-read"]
    WRITEPLAN --> REV2["Dispatch reviewer<br/>checks plan"]
    REV2 --> FIX2{"MUST-FIX?"}
    FIX2 -->|yes| REVISE2["Revise plan"]
    REVISE2 --> REV2
    FIX2 -->|no| GATE2["User approves plan"]
    GATE2 --> COMMIT["Commit spec + plan"]
    FIX1 -->|yes after revision| ESC["Escalate to user"]
    FIX2 -->|yes after revision| ESC

    style START fill:#C6EFCE,stroke:#006100
    style COMMIT fill:#C6EFCE,stroke:#006100
    style ESC fill:#FFC7CE,stroke:#9C0006
    style GATE1 fill:#FFEB9C,stroke:#9C5700
    style GATE2 fill:#FFEB9C,stroke:#9C5700
    style REV1 fill:#D9D9D9,stroke:#595959
    style REV2 fill:#D9D9D9,stroke:#595959
```

## Task Workflow (task-writer, not orchestrator)

```mermaid
flowchart TD
    START["Task-writer reads spec + plan"] --> THINK["Think through implementations<br/>for each workstream"]
    THINK --> GRAPH["Consult project graph<br/>for file placement"]
    GRAPH --> WRITE["Write TASK-NNN.md files"]
    WRITE --> JSONL["Write build order to JSONL<br/>data/tasks.jsonl + plan timeline"]
    JSONL --> REV["Dispatch reviewer<br/>checks task files"]
    REV --> FIX{"MUST-FIX?"}
    FIX -->|yes| REVISE["Revise tasks + JSONL"]
    REVISE --> REV
    FIX -->|no| COMMIT["Commit"]
    FIX -->|yes after revision| ESC["Escalate to user"]

    style START fill:#BDD7EE,stroke:#1F4E79
    style COMMIT fill:#C6EFCE,stroke:#006100
    style ESC fill:#FFC7CE,stroke:#9C0006
    style REV fill:#D9D9D9,stroke:#595959
```

## Task Implementation (one task at a time, sequential)

```mermaid
flowchart TD
    CTX["Build context packet"] --> P["Implementer<br/>foreground, write access"]
    P --> CODE["Implements code + initial tests"]
    CODE --> V1["build, vet, test, lint"]
    V1 --> CO["Code-optimizer<br/>foreground, read-only"]
    CO --> CR["Reviewer<br/>foreground, read-only"]
    CR --> CRC{"Findings?"}
    CRC -->|MUST-FIX| BACK1["Re-dispatch implementer"]
    BACK1 --> V2["build, vet, test, lint"]
    V2 --> CR
    CRC -->|pass| TA["Testing agent<br/>foreground, write access"]
    TA --> TAC{"All tests pass?"}
    TAC -->|fail| TF["test-failure workflow<br/>max 3 rounds, escalate"]
    TF -->|fixed| TA
    TF -->|unresolved| ESC["Escalate to user"]
    TAC -->|pass| COM["Commit"]
    COM --> JSONL["Append done event to JSONL"]
    JSONL --> DONE["Task done"]

    style P fill:#C6EFCE,stroke:#006100
    style CO fill:#BDD7EE,stroke:#1F4E79
    style CR fill:#D9D9D9,stroke:#595959
    style TA fill:#FFEB9C,stroke:#9C5700
    style TF fill:#FFC7CE,stroke:#9C0006
    style DONE fill:#C6EFCE,stroke:#006100
```

## PR Review

```mermaid
flowchart TD
    START["All tasks in plan done"] --> MECH["Mechanical checks<br/>lint, vet, test, vulncheck"]
    MECH --> CHK{"All pass?"}
    CHK -->|no| FIX["Fix failures"]
    FIX --> MECH
    CHK -->|yes| DIFF["git diff base...head"]
    DIFF --> AGENT["Dispatch reviewer subagent<br/>full project context"]
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

### Trigger conditions

| Skill | Trigger | When to invoke |
|-------|---------|----------------|
| `/pc-plan` | user or model | When a user describes what they want built — runs the full spec→plan sequence |
| `/pc-create-tasks` | user or model | After a plan is committed — task-writer reads spec+plan, writes tasks + JSONL |
| `/pc-implement` | user or model | When a committed task's status is set to `in_progress` |
| `/pc-review` | user or model | When all tasks in a plan are `done` and a PR is ready |
| `/pc-inspect-project` | user or model | Anytime the agent needs a current view of the project state |
| `/pc-context` | model | To build a focused context packet for a spec/plan/task |
| `/pc-uuid` | model | Whenever a new spec/plan/task needs a UUID |

### State transitions

Status values flow through the lifecycle:

```
SPEC:    draft → committed → done → superseded
PLAN:    draft → committed → in_progress → done → superseded
TASK:    draft → in_progress → done → superseded
```

- `draft` — document is being written.
- `committed` — review passed; the document is authoritative.
- `in_progress` — for plans and tasks, implementation has started.
- `done` — all work is complete.
- `superseded` — a later version replaces this one; kept for history.

Events are appended to JSONL **after** the step that produced a state
change, not before. A task is not `done` until all tests pass and the
commit is pushed.

### Concurrency rules

1. **One task at a time.** No parallel lanes. The next task does not
   start until the current one is done.
2. **Within a task, subagents run sequentially.** Implementer →
   code-optimizer → reviewer → testing agent. Each step depends on the
   previous one's output. No agent starts until the previous one
   finishes.
3. **The reviewer runs once per artifact.** No 3-round loop. If MUST-FIX
   issues remain after one revision, escalate to the user.

### Escalation rules

1. **Plan workflow:** if the reviewer finds MUST-FIX issues after one
   revision, escalate to the user with the document path, unresolved
   findings, and a recommendation.
2. **Task workflow:** same — one revision, then escalate.
3. **Implementation:** if the implementer cannot make build/test pass
   after 3 fix attempts, escalate. The testing agent failing triggers
   the test-failure workflow — max 3 rounds, then escalate.
4. **PR review:** if mechanical checks fail repeatedly or the reviewer
   finds security-critical MUST-FIX issues, stop and escalate.

### Skill loading rules

1. `adhd` is loaded ONCE, by the orchestrator, before writing the spec.
   Not before the plan, not by the task-writer, not by the reviewer, not
   during implementation.
2. The task-writer does not load `adhd`. The plan already decided the
   approach.
3. The orchestrator builds a context packet for the target task.
4. The implementer loads the task's primary skill.
5. The code-optimizer loads the project's language skills.
6. The reviewer loads the project's code-review skill.
7. The testing agent loads the project's testing skill.

### Exit and hand-off rules

1. The `/pc-plan` workflow exits when the spec and plan are committed. It
   does not auto-start task creation. Use `/pc-create-tasks` to start the
   task workflow.
2. The `/pc-create-tasks` workflow exits when all task files and JSONL are
   committed. It hands off to `/pc-implement` when a task moves to
   `in_progress`.
3. An `/pc-implement` workflow exits when the task is `done`. The hook
   detects the done event in JSONL and tells the orchestrator what to do
   next.
4. A `/pc-review` workflow exits when the PR is merged or the user aborts.
