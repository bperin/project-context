# Workflow: Task Creation

## When

After a task file (`tasks/TASK-NNN.md`) is written or revised, before
implementation starts. This is the gate between task creation and the
implement workflow — it catches spec errors in the task file before
code is written, which is cheaper than catching them during
implementation.

## Pattern

Writer-optimizer-review. Same pattern as spec and plan creation. The
orchestrator is the big brain — it has full context, loads `adhd` for
divergent ideation, writes the task file, then dispatches an optimizer
subagent to tighten the task, then a reviewer subagent to check
correctness.

```
Orchestrator loads primary skill + adhd (divergent ideation on the task design space)
    → Orchestrator writes the task file (with full context)
    → Orchestrator dispatches optimizer subagent (task-optimizer, with context)
    → Orchestrator applies optimizer findings
    → Orchestrator dispatches reviewer subagent (reviewer, with context)
    → Orchestrator applies reviewer findings
    → Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The task file is the implementation contract — it tells the implementer
exactly what to build. A vague task file forces the implementer to
guess. The optimizer keeps it tight and on track; the reviewer catches
correctness and rule issues before code is written.

## Context packets

The optimizer and reviewer each receive a structured context packet —
only what they need, no more. This keeps context lean and ensures each
role has the right information for its job.

### Optimizer and reviewer context packet

- The task file path
- The parent plan path
- The primary skill path(s)
- The project's algorithm registry (if applicable)
- `AGENTS.md`
- A sibling task file path
- A 1-2 sentence context summary (what this task covers, key constraints)

## Roles

### Role 1: Orchestrator (you)

- Has full conversation context — knows the plan, the algorithm, the
  user's priorities.
- Loads the **primary skill** for the task's algorithm(s) BEFORE
  writing. The skill's guidance shapes the Required Change and
  Constraints sections — do not write the task spec blind.
- Loads the `adhd` skill before writing. Uses it to explore the task
  design space — spawn divergent branches under different cognitive
  frames, score and prune, then write the task file from the
  survivors. This catches bad task specs that seem clear but have
  hidden flaws (wrong API cited, missing constraint, skill guidance
  not reflected).
- Writes the task file following the `TASK-NNN.template.md`.
- Dispatches the optimizer and reviewer subagents.
- Revises the task file after each round.

### Role 2: Optimizer (task-optimizer subagent, read-only, with context)

- Sees the task file **and** a brief context summary from the
  orchestrator (1-2 sentences: what this task covers, key constraints).
- Optimizes with knowledge of intent — challenges whether the task
  spec is the right way to implement the plan's workstream, trims scope
  creep, checks approach soundness.
- Reports findings. Does not fix — the orchestrator revises.
- Runs BEFORE the reviewer.

### Role 3: Reviewer (reviewer subagent, read-only, with context)

- Sees the task file, the parent plan, the algorithm registry, `AGENTS.md`,
  and a brief context summary.
- Checks correctness, rule compliance, template compliance, dependency
  compliance, and internal consistency.
- Reports findings. Does not fix — the orchestrator revises.
- Runs AFTER the optimizer.

## Steps

1. **Load the primary skill** for the task's algorithm(s). Read its
   guidance — it shapes the Required Change and Constraints.

2. **Load the `adhd` skill.** Use it to explore the task design space
   before writing. Spawn divergent branches under different cognitive
   frames (regulator, biology, speedrunner, 10-year-old, $0 budget),
   score and prune, then write the task file from the survivors. Do
   not lock onto the first task spec before alternatives are
   considered.

3. **Write the task file.** Use `TASK-NNN.template.md`. Follow the
   skill's guidance for the Required Change and Constraints.

4. **Dispatch the optimizer** (foreground, `task-optimizer` profile).
   Give it the context packet. The optimizer checks:
   - **Approach soundness**: is this the right way to implement the
     plan's workstream? Are there simpler approaches the writer
     dismissed?
   - **Plan alignment**: does this task implement the plan's
     workstream? Are all workstream deliverables covered?
   - **Technical accuracy**: does the Required Change match what the
     primary skill actually says? Are the cited APIs real? Is the
     skill's guidance reflected in the constraints? (e.g., if the
     skill says "this algorithm hashes internally, do not pre-hash,"
     the task must not pre-hash.)
   - **Scope vs. plan**: is the task trying to do more or less than
     the plan's workstream asks? Trim scope creep.
   - **Optimization opportunities**: are there simpler approaches,
     better abstractions, or clearer ways to express the same intent?

5. **Apply optimizer findings.** Revise the task file.

6. **Dispatch the reviewer** (foreground, `reviewer` profile). Give
   it the context packet. The reviewer checks:
   - **Correctness**: are cited standards real? Are algorithm IDs in
     the registry? Are the cited APIs real?
   - **Skill alignment**: is the primary skill in the task's Algorithm
     block the same one listed in the project's algorithm registry for
     that algorithm ID? Are the secondary skills correct? Does the
     task instruct consulting a skill that doesn't actually cover
     the needed guidance?
   - **Standards consistency**: does the standard citation in the
     task match the algorithm's standard citation in the project's
     algorithm registry? Does the standard cited match the plan's
     workstream table?
   - **Format consistency**: does the task follow the
     `TASK-NNN.template.md`? Are all required sections present
     (Parent, Status, Goal, Algorithm, Repositories, Relevant Files,
     Relevant Symbols, Required Change, Constraints, Acceptance
     Criteria, Verification, Do-Not-Touch, Commit Log)? Does it
     match the sibling task's level of detail?
   - **Rule compliance**: does the task respect AGENTS.md constraints
     — no interface inflation, no skipped tests, documentation on
     all exports, the project's dependency rules (see AGENTS.md)?
   - **Dependency compliance**: would any task require a forbidden
     import? Does it respect the project's dependency rules?
   - **Internal consistency**: does the task contradict itself?

7. **Apply reviewer findings.** Revise the task file.

8. **Round counter.** This is round 1. If the optimizer or reviewer
   found MUST-FIX or SHOULD-FIX issues, go back to step 4 (re-dispatch
   the optimizer on the revised task file, then the reviewer). Max 3
   rounds. If still unresolved after round 3, escalate to the user
   with a summary of the disagreement.

9. **Commit.** When both the optimizer and reviewer pass (only NITs
   or clean), commit the task file. The task is now ready for the
   implement workflow.

## Expected output

A task file that:

- Implements the plan's workstream — every workstream deliverable is
  covered, no more, no less.
- Cites the correct primary and secondary skills from the project's
  algorithm registry — no skill that doesn't cover the needed
  guidance.
- Has a standard citation matching the algorithm's standard citation
  in the project's algorithm registry.
- Follows the `TASK-NNN.template.md` — all required sections present,
  matching the sibling task's level of detail.
- Respects AGENTS.md constraints — no interface inflation, no
  skipped tests, documentation on all exports, the project's
  dependency rules.
- Has a Required Change that matches what the primary skill actually
  says — cited APIs are real, skill guidance is reflected in
  constraints.
- Has been stress-tested from two angles: intent (orchestrator +
  adhd + primary skill) and context (reviewer with context).

## Subagent prompt templates

### Reviewer (task-optimizer)

```
You are a task-optimizer for this project. Read AGENTS.md for full
project conventions and rules.

Context: <1-2 sentence summary of what this task covers>

Read the task file at <path>.
Also read the parent plan at <path>, the primary skill at <path>, and
the project's algorithm registry (if applicable).

Check:
- Plan alignment: does this task implement the plan's workstream? All
  deliverables covered?
- Technical accuracy: does the Required Change match the primary
  skill? Cited APIs real? Skill guidance reflected in constraints?
- Skill alignment: primary skill matches the algorithm registry?
  Secondary skills correct?
- Scope: is the task doing more or less than the plan asks?
- Standards consistency: standard citation matches the algorithm's
  standard citation in the registry? Standard matches the plan's
  workstream table?
- Format consistency: follows TASK-NNN.template.md? All required
  sections present? Matches sibling task's level of detail?
- Rule compliance: respects AGENTS.md constraints — no interface
  inflation, no skipped tests, documentation on all exports, the
  project's dependency rules?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
exact text. Be specific.
```

## Inputs

- The task file(s) under review
- Primary skill file(s) for the task's algorithm(s)
- The project's algorithm registry (if applicable)
- `AGENTS.md`
- Parent plan file
- A sibling task file (for format reference)
- `TASK-NNN.template.md` (for format reference)

## Outputs

- Review findings (MUST-FIX / SHOULD-FIX / NIT) from the reviewer
- A corrected task file (if findings) from the orchestrator
- A clean task file ready for the implement workflow

## Constraints

- No task file enters the implement workflow without passing the
  reviewer.
- Max 3 review rounds. Escalate to the user if unresolved.
- The primary skill MUST be loaded before writing the task file, not
  after. Writing a task spec blind and then reviewing it defeats the
  purpose — the skill should shape the spec from the start.
- The reviewer checks the task file against the skill, not the
  implementation against the task. Implementation review is the
  implement workflow's job.
- The reviewer has context (a brief summary).
- The reviewer is read-only. It reports findings; the orchestrator revises.
- One review per task file. If a workstream has multiple tasks, review
  them in parallel (one reviewer per task) only if they are
  independent. Coupled tasks (shared symbols, ordering dependency) are
  reviewed together in one reviewer.

## Review format

Same as the other workflows — no novels:

```
MUST-FIX: TASK-013 §Required Change step 3 — "consult the ethereum skill
  for the correct dcrd signing API" is misleading; the ethereum skill
  covers Solidity, not the dcrd library. Replace with: consult the
  dcrd v4 package docs / source for the signing API.
SHOULD-FIX: TASK-012 §Symbols — Sign returns ([]byte, error) but this
  signing operation cannot fail for a valid key. Consider returning
  []byte only.
NIT: TASK-013 §Constraints — "nonce-reuse is catastrophic" is repeated
  in both the Goal and Constraints; appears once.
```
