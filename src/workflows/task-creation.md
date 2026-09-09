# Workflow: Task Creation

## When

After a task file (`tasks/TASK-NNN.md`) is written or revised, before
implementation starts. This is the gate between task creation and the
implement workflow — it catches spec errors in the task file before
code is written, which is cheaper than catching them during
implementation.

## Pattern

Writer-critic-blind review. Same three-pass pattern as spec and plan
creation:

```
Writer writes the task file (with primary skill + adhd loaded)
    → Critic reviews (with context — can challenge the task spec against the plan)
    → Blind reviewer reviews (no context — judges against AGENTS.md + algorithms.json)
If any reviewer finds issues → writer revises → re-review
Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The task file is the implementation contract — it tells the implementer
exactly what to build. A vague task file forces the implementer to
guess at crypto. The three-pass pattern catches that before code is
written.

## Context packets

Each agent receives a structured context packet — only what it needs,
no more. This keeps context lean and ensures each agent has the right
information for its role.

### Writer context packet

- The task file path (being written)
- The parent plan path (for the workstream section)
- The primary skill path(s) for the task's algorithm(s)
- `trust/algorithms.json` (for the algorithm entry)
- `AGENTS.md` (project rules)
- A sibling task file path (for format reference)
- Conversation context (full — the writer is you)

### Critic context packet

- The task file path
- The parent plan path
- The primary skill path(s)
- `trust/algorithms.json`
- `AGENTS.md`
- A sibling task file path
- A 1-2 sentence context summary (what this task covers, key constraints)

### Blind reviewer context packet

- The task file path
- The primary skill path(s)
- `trust/algorithms.json`
- `AGENTS.md`
- The parent plan path
- A sibling task file path
- No context summary, no conversation history

## Roles

### Role 1: Writer (you)

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
- Revises after each review round.

### Role 2: Critic (subagent, read-only, with context)

- Sees the task file **and** a brief context summary from the writer
  (1-2 sentences: what this task covers, key constraints).
- Reviews with knowledge of intent — can challenge whether the task
  spec correctly implements the plan's workstream.
- Reports findings. Does not fix — the writer revises.

### Role 3: Blind reviewer (subagent, read-only, no context)

- Sees only the task file, the primary skill, `algorithms.json`,
  `AGENTS.md`, the parent plan, and a sibling task file for format
  reference.
- No conversation context, no user messages, no writer rationale.
- Judges the task file against the rules and the skill, not the
  intent.
- Reports findings. Does not fix — the writer revises.

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

4. **Spawn the critic** (foreground, `subagent_explore` profile). Give
   it the critic context packet. The critic checks:
   - **Plan alignment**: does this task implement the plan's
     workstream? Are all workstream deliverables covered?
   - **Technical accuracy**: does the Required Change match what the
     primary skill actually says? Are the cited APIs real? Is the
     skill's guidance reflected in the constraints? (e.g., if the
     skill says "Ed25519 hashes internally, do not pre-hash," the
     task must not pre-hash.)
   - **Skill alignment**: is the primary skill in the task's Algorithm
     block the same one listed in `algorithms.json` for that
     algorithm ID? Are the secondary skills correct? Does the task
     instruct consulting a skill that doesn't actually cover the
     needed guidance (e.g., a Solidity skill for a Go library API)?
   - **Scope vs. plan**: is the task trying to do more or less than
     the plan's workstream asks?

5. **Apply critic findings.** Revise the task file.

6. **Spawn the blind reviewer** (foreground, `subagent_explore`
   profile). Give it the blind reviewer context packet. The blind
   reviewer checks:
   - **Standards consistency**: does the Godoc citation in the task
     match the `godoc_citation` field in `algorithms.json`? Does the
     standard cited match the plan's workstream table?
   - **Format consistency**: does the task follow the
     `TASK-NNN.template.md`? Are all required sections present
     (Parent, Status, Goal, Algorithm, Repositories, Relevant Files,
     Relevant Symbols, Required Change, Constraints, Acceptance
     Criteria, Verification, Do-Not-Touch, Commit Log)? Does it
     match the sibling task's level of detail?
   - **Rule compliance**: does the task respect AGENTS.md constraints
     — no interface inflation, no math/rand, constant-time
     comparisons, private key redaction, no skipped tests, Godoc on
     all exports, dependency rule (trust imports no auth/chain)?
   - **Technical accuracy**: are the cited APIs real? Is the skill's
     guidance reflected in the constraints?

7. **Apply blind reviewer findings.** Revise the task file.

8. **Round counter.** This is round 1. If either reviewer found
   MUST-FIX or SHOULD-FIX issues, go back to step 4 (re-spawn both
   reviewers on the revised task file). Max 3 rounds. If still
   unresolved after round 3, escalate to the user with a summary of
   the disagreement.

9. **Commit.** When both reviewers pass (only NITs or clean), commit
   the task file. The task is now ready for the implement workflow.

## Expected output

A task file that:

- Implements the plan's workstream — every workstream deliverable is
  covered, no more, no less.
- Cites the correct primary and secondary skills from
  `algorithms.json` — no skill that doesn't cover the needed guidance.
- Has a Godoc citation matching `algorithms.json`'s `godoc_citation`
  field.
- Follows the `TASK-NNN.template.md` — all required sections present,
  matching the sibling task's level of detail.
- Respects AGENTS.md constraints — no interface inflation, no
  math/rand, constant-time comparisons, private key redaction, no
  skipped tests, Godoc on all exports, dependency rule.
- Has a Required Change that matches what the primary skill actually
  says — cited APIs are real, skill guidance is reflected in
  constraints.
- Has been stress-tested from three angles: intent (writer), context
  (critic), and rules (blind reviewer).

## Subagent prompt templates

### Critic

```
You are a task critic for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Read AGENTS.md for full project conventions and
rules.

Context: <1-2 sentence summary of what this task covers>

Read the task file at <path>.
Also read the parent plan at <path>, the primary skill at <path>, and
trust/algorithms.json.

Check:
- Plan alignment: does this task implement the plan's workstream? All
  deliverables covered?
- Technical accuracy: does the Required Change match the primary
  skill? Cited APIs real? Skill guidance reflected in constraints?
- Skill alignment: primary skill matches algorithms.json? Secondary
  skills correct?
- Scope: is the task doing more or less than the plan asks?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
exact text. Be specific.
```

### Blind reviewer

```
You are a task reviewer for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Read AGENTS.md for full project conventions and
rules.

Read the task file at <path>.
Also read the primary skill at <path>, trust/algorithms.json, the
parent plan at <path>, and the sibling task at <path>.

Check:
- Standards consistency: Godoc citation matches algorithms.json
  godoc_citation field? Standard matches the plan's workstream table?
- Format consistency: follows TASK-NNN.template.md? All required
  sections present? Matches sibling task's level of detail?
- Rule compliance: respects AGENTS.md constraints — no interface
  inflation, no math/rand, constant-time comparisons, private key
  redaction, no skipped tests, Godoc on all exports, dependency rule?
- Technical accuracy: cited APIs real? Skill guidance reflected in
  constraints?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
exact text. Do not suggest changes you cannot justify from the
reference files.
```

## Inputs

- The task file(s) under review
- Primary skill file(s) for the task's algorithm(s)
- `trust/algorithms.json`
- `AGENTS.md`
- Parent plan file
- A sibling task file (for format reference)
- `TASK-NNN.template.md` (for format reference)

## Outputs

- Review findings (MUST-FIX / SHOULD-FIX / NIT) from the critic and
  blind reviewer
- A corrected task file (if findings) from the writer
- A clean task file ready for the implement workflow

## Constraints

- No task file enters the implement workflow without passing both the
  critic and blind reviewer.
- Max 3 review rounds. Escalate to the user if unresolved.
- The primary skill MUST be loaded before writing the task file, not
  after. Writing a task spec blind and then reviewing it defeats the
  purpose — the skill should shape the spec from the start.
- The reviewer checks the task file against the skill, not the
  implementation against the task. Implementation review is the
  implement workflow's job.
- The critic has context (a brief summary). The blind reviewer has
  none.
- Reviewers are read-only. They report findings; the writer revises.
- One review per task file. If a workstream has multiple tasks, review
  them in parallel (one subagent pair per task) only if they are
  independent. Coupled tasks (shared symbols, ordering dependency) are
  reviewed together in one subagent pair.

## Review format

Same as the other workflows — no novels:

```
MUST-FIX: TASK-013 §Required Change step 3 — "consult the ethereum skill
  for the correct dcrd signing API" is misleading; the ethereum skill
  covers Solidity, not the Go dcrd library. Replace with: consult the
  dcrd v4 package docs / source for the signing API.
SHOULD-FIX: TASK-012 §Symbols — Sign returns ([]byte, error) but Ed25519
  signing cannot fail for a valid key. Consider returning []byte only.
NIT: TASK-013 §Constraints — "nonce-reuse is catastrophic" is repeated
  in both the Goal and Constraints; appears once.
```
