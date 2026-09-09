# Workflow: Plan

## When

When a plan is written, before implementation starts and before the
plan is committed.

## Pattern

Writer-critic-blind review. Same three-pass pattern as the spec workflow:

```
Writer writes the plan (with full context — knows the spec, the user's goals)
    → Critic reviews (with context — can challenge the approach, skill choices)
    → Blind reviewer reviews (no context — judges against AGENTS.md + the spec)
If any reviewer finds issues → writer revises → re-review
Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The plan is the implementation blueprint. It calls out actual files,
skills, dependencies, test vectors — everything needed to execute.
A plan that leaves these vague forces the implementer to guess.

## Roles

### Role 1: Writer (you)

- Has full conversation context — knows the spec, the user's
  priorities, what was discussed.
- Loads the `adhd` skill before writing. Uses it to explore the
  implementation design space — spawn divergent branches under
  different cognitive frames (regulator, biology, speedrunner,
  10-year-old, $0 budget), score and prune, then write the plan from
  the survivors. This prevents locking onto the first architecture
  before alternatives are considered.
- Writes the plan from `PLAN-NNN.template.md`.
- For each workstream that implements an algorithm, consults
  `trust/algorithms.json` for the `skill` field (primary + secondary
  skills) and the `godoc_citation` field.
- Revises after each review round.

### Role 2: Critic (subagent, read-only, with context)

- Sees the plan file, the source spec, `algorithms.json`, and a brief
  context summary from the writer.
- Reviews with knowledge of intent — can challenge whether the plan
  is the right approach to implement the spec.
- Reports findings. Does not fix — the writer revises.

### Role 3: Blind reviewer (subagent, read-only, no context)

- Sees only the plan file, the source spec, `AGENTS.md`,
  `algorithms.json`, and the architecture document.
- No conversation context, no user messages, no writer rationale.
- Judges the plan against the spec and the rules, not the intent.
- Reports findings. Does not fix — the writer revises.

## Steps

1. **Load the `adhd` skill.** Use it to explore the implementation design
   space before writing. Spawn divergent branches under different
   cognitive frames, score and prune, then write the plan from the
   survivors. Do not lock onto the first architecture before
   alternatives are considered.

2. **Read the source spec.** Every workstream in the plan must trace to
   a spec desired behavior. Flag any spec behavior with no corresponding
   workstream, and any workstream with no corresponding spec behavior.

3. **Write the plan.** Use `PLAN-NNN.template.md`. For each workstream:
   - List the algorithm IDs from `trust/algorithms.json`.
   - List the primary and secondary skills (from the algorithm's `skill`
     field).
   - Confirm the skills are installed (`.agents/skills/` or user-level).
     If a skill is missing, flag it — it must be installed before the
     workstream starts.
   - Name specific test vectors from the governing standard (not "known
     test vector" — cite the exact source: RFC number, section, test
     case ID).
   - List negative tests (wrong key, tampered input, etc.).
   - List external packages to add (`go get` targets) and stdlib
     packages used.
   - Call out actual file paths to create/modify.

4. **Spawn the critic** (foreground, `subagent_explore` profile). Give it:
   - The plan file path
   - The source spec path
   - `trust/algorithms.json` path
   - `AGENTS.md` path
   - A 1-2 sentence context summary (what this plan covers, key user
     priorities)
   - The critic checks:
     - **Spec coverage**: does every spec desired behavior have a
       workstream? Does every workstream trace to a spec behavior?
     - **Approach soundness**: is this the right way to implement the
       spec? Are there simpler approaches the writer dismissed?
     - **Skill alignment**: are the primary/secondary skills correct
       per `algorithms.json`? Are they installed?
     - **Dependency ordering**: are workstreams ordered so no
       workstream depends on a later one?
     - **Scope vs. spec**: is the plan trying to do more than the spec
       asks? Less?

5. **Apply critic findings.** Revise the plan.

6. **Spawn the blind reviewer** (foreground, `subagent_explore`
   profile). Give it:
   - The plan file path
   - The source spec path
   - `trust/algorithms.json` path
   - `AGENTS.md` path
   - The architecture document path
   - No context summary, no conversation history.
   - The blind reviewer checks:
     - **Algorithm-to-skill matrix**: for every workstream implementing
       an algorithm, is the algorithm ID in `algorithms.json`? Is the
       primary skill listed? Is it installed? Are secondary skills
       listed where applicable?
     - **Test vectors**: every algorithm must name a specific test
       vector from its governing standard. "Known test vector" is not
       specific enough.
     - **Negative tests**: every algorithm must have at least one
       negative test.
     - **Completion criteria**: every criterion must be objectively
       verifiable (a command to run, a grep to check, a test to pass).
     - **Dependency compliance**: does the plan respect
       `auth → trust ← chain`? Would any workstream require a
       forbidden import?
     - **Spec constraints**: does the plan violate any constraint from
       the spec or AGENTS.md?

7. **Apply blind reviewer findings.** Revise the plan.

8. **Round counter.** This is round 1. If either reviewer found
   MUST-FIX or SHOULD-FIX issues, go back to step 4 (re-spawn both
   reviewers on the revised plan). Max 3 rounds. If still unresolved
   after round 3, escalate to the user.

9. **Commit.** When both reviewers pass, commit the plan with a
   message summarizing what the review changed.

## Expected output

A plan that:

- Traces every workstream to a spec desired behavior — no orphans in
  either direction.
- Lists actual file paths to create/modify (not "a file for hashing" —
  `trust/crypto/hash/sha256.go`).
- Lists the algorithm ID, primary skill, and secondary skills for each
  workstream, matching `algorithms.json`.
- Confirms skills are installed before the workstream starts.
- Names specific test vectors (RFC number, section, test case ID) —
  not "known test vector."
- Lists negative tests for every algorithm.
- Has completion criteria that are objectively verifiable (commands,
  greps, test runs) — not subjective.
- Has workstreams ordered so no workstream depends on a later one.
- Respects the `auth → trust ← chain` dependency rule.
- Lists external packages to add and stdlib packages used.
- Has been stress-tested from three angles: intent (writer), context
  (critic), and rules (blind reviewer).

## Subagent prompt templates

### Critic

```
You are a plan critic for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Read AGENTS.md for project conventions, skill-gated
implementation rules, and testing rules.

Context: <1-2 sentence summary of what this plan covers>

Read the plan at <path>.
Also read the source spec at <path> and trust/algorithms.json.

Check:
- Spec coverage: does every spec behavior have a workstream? Any
  orphans?
- Approach soundness: is this the right way to implement the spec?
- Skill alignment: are primary/secondary skills correct per
  algorithms.json? Are they installed?
- Dependency ordering: are workstreams correctly ordered?
- Scope: is the plan doing more or less than the spec asks?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers.
```

### Blind reviewer

```
You are a plan reviewer for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Read AGENTS.md for project conventions, skill-gated
implementation rules, and testing rules.

Read the plan at <path>.
Also read the source spec at <path>, trust/algorithms.json, and the
architecture document at <path>.

Check:
1. Does every spec desired behavior have a corresponding workstream/task?
2. Are algorithm IDs in algorithms.json? Are skills listed and installed?
3. Are test vectors specific (named source, not "known test vector")?
4. Does every workstream have negative tests?
5. Are completion criteria objectively verifiable?
6. Is dependency ordering correct?
7. Are there spec constraints the plan violates?
8. Does the plan respect auth → trust ← chain?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers.
```

## Inputs

- The plan file (`plans/PLAN-NNN.md`)
- The source spec (`specs/SPEC-NNN.md`)
- `trust/algorithms.json`
- `AGENTS.md`
- The architecture document
- `PLAN-NNN.template.md` (for format reference)

## Outputs

- A reviewed, revised plan ready to commit
- A summary of what the review changed (in the commit message)

## Constraints

- No plan is committed without passing both the critic and blind reviewer.
- No implementation starts until the plan is reviewed and committed.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds the spec is wrong (not the plan), stop and go back
  to the spec workflow.
- The critic has context (a brief summary). The blind reviewer has
  none.
- Reviewers are read-only. They report findings; the writer revises.
