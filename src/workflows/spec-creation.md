# Workflow: Spec

## When

When a spec is written or substantially revised, before it's committed.

## Pattern

Writer-critic-blind review. Three perspectives, escalating objectivity:

```
Writer writes the spec (with full context — knows the goal, the user's intent)
    → Critic reviews (with context — can challenge scope, push back on decisions)
    → Blind reviewer reviews (no context — judges only against AGENTS.md + architecture)
If any reviewer finds issues → writer revises → re-review
Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The writer has intent. The critic has context. The blind reviewer has
neither — only the rules and the mission. This catches gaps the writer
rationalized away and biases the critic shares.

## Roles

### Role 1: Writer (you)

- Has full conversation context — knows the user's goal, what was
  discussed, what was rejected.
- Loads the `adhd` skill before writing. Uses it to explore the design
  space — spawn divergent branches under different cognitive frames
  (regulator, biology, speedrunner, 10-year-old, $0 budget), score and
  prune them, then write the spec from the survivors. This prevents
  locking onto the first approach before alternatives are considered.
- Writes the spec from the `SPEC-NNN.template.md` template.
- Revises after each review round.

### Role 2: Critic (subagent, read-only, with context)

- Sees the spec file **and** a brief context summary from the writer
  (1-2 sentences: what this spec is for, what constraints the user
  emphasized).
- Reviews with knowledge of intent — can challenge whether the spec
  solves the right problem, not just whether it's well-formed.
- Reports findings. Does not fix — the writer revises.

### Role 3: Blind reviewer (subagent, read-only, no context)

- Sees only the spec file, `AGENTS.md`, and the architecture document.
- No conversation context, no user messages, no writer rationale.
- Judges the spec against the mission and rules, not the intent.
- Reports findings. Does not fix — the writer revises.

## Steps

1. **Load the `adhd` skill.** Use it to explore the design space before
   writing. Spawn divergent branches under different cognitive frames,
   score and prune, then write the spec from the survivors. Do not
   lock onto the first approach before alternatives are considered.

2. **Write the spec.** Use `SPEC-NNN.template.md`. The spec describes
   WHAT and WHY, not HOW. Do not turn it into an implementation plan.

3. **Spawn the critic** (foreground, `subagent_explore` profile). Give it:
   - The spec file path
   - A 1-2 sentence context summary (what this spec is for, key user
     constraints)
   - `AGENTS.md` path
   - The architecture document path
   - The critic checks:
     - **Problem fit**: does this spec solve the actual problem? Is
       the scope right — not too narrow, not too broad?
     - **Completeness**: does it cover everything the architecture asks
       for in this module? Are there missing behaviors?
     - **Dependency compliance**: does it respect `auth → trust ← chain`?
     - **Testability**: is every desired behavior testable? Are success
       criteria objective (pass/fail, not subjective)?
     - **Scope discipline**: is the Out of Scope section honest? Are
       there features sneaking in that belong in a future spec?

4. **Apply critic findings.** Revise the spec. If the critic found a
   fundamental problem (wrong problem, wrong scope), stop and discuss
   with the user before rewriting.

5. **Spawn the blind reviewer** (foreground, `subagent_explore`
   profile). Give it:
   - The spec file path
   - `AGENTS.md` path
   - The architecture document path
   - `trust/algorithms.json` (for crypto specs — every algorithm must
     be in the registry)
   - No context summary, no conversation history.
   - The blind reviewer checks:
     - **Crypto/security rigor**: are algorithms correctly distinguished
       (SHA-3 vs Keccak-256)? Are nonce management, canonicalization,
       domain separation, and constant-time requirements present? Are
       known attacks documented?
     - **Dependency compliance**: would any desired behavior require a
       forbidden import?
     - **Completeness**: are there spec behaviors with no success
       criterion? Success criteria with no corresponding behavior?
     - **Internal consistency**: does the spec contradict itself? Do
       the constraints align with the desired behaviors?
     - **Rule compliance**: does the spec respect AGENTS.md conventions?

6. **Apply blind reviewer findings.** Revise the spec.

7. **Round counter.** This is round 1. If either reviewer found MUST-FIX
   or SHOULD-FIX issues, go back to step 3 (re-spawn both reviewers on
   the revised spec). Max 3 rounds. If still unresolved after round 3,
   escalate to the user with a summary of the disagreement.

8. **Commit.** When both reviewers pass (only NITs or clean), commit the
   spec with a message summarizing what the review changed.

## Expected output

A spec that:

- States WHAT the system does and WHY, not HOW.
- Lists every desired behavior as observable, testable statements.
- Has success criteria that are objectively verifiable (a command to
   run, a grep to check, a test to pass) — not subjective ("clean code",
   "well-documented").
- Has an honest Out of Scope section that keeps scope creep out.
- Respects the `auth → trust ← chain` dependency rule.
- Names every algorithm by its ID in `trust/algorithms.json` (for crypto
  specs) — no algorithm appears in the spec that isn't in the registry.
- Has constraints that align with the desired behaviors (no
  contradictions).
- Has been stress-tested from three angles: intent (writer), context
  (critic), and rules (blind reviewer).

## Subagent prompt templates

### Critic

```
You are a spec critic for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core with zero deps on the
other two. Read AGENTS.md for full project conventions and rules.

Context: <1-2 sentence summary of what this spec is for>

Read the spec at <path>.
Also read the architecture document at <path>.

Check:
- Problem fit: does this spec solve the actual problem? Is the scope
  right?
- Completeness: are there missing behaviors the architecture asks for?
- Dependency compliance: does it respect auth → trust ← chain?
- Testability: is every desired behavior testable? Are success criteria
  objective?
- Scope discipline: is Out of Scope honest? Any scope creep?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
exact text. Be specific.
```

### Blind reviewer

```
You are a spec reviewer for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core with zero deps on the
other two. Read AGENTS.md for full project conventions and rules.

Read the spec at <path>.
Also read the architecture document at <path> and trust/algorithms.json.

Check:
- Crypto/security rigor: algorithms correctly distinguished? Nonce
  management, canonicalization, constant-time requirements present?
  Known attacks documented?
- Dependency compliance: would any behavior require a forbidden import?
- Completeness: behaviors with no success criterion? Criteria with no
  behavior?
- Internal consistency: does the spec contradict itself?
- Rule compliance: does it respect AGENTS.md conventions?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
exact text. Do not suggest changes you cannot justify from the
reference files.
```

## Inputs

- The spec file (`specs/SPEC-NNN.md`)
- The architecture document
- `trust/algorithms.json` (for crypto specs)
- `AGENTS.md` (project conventions and rules)
- `SPEC-NNN.template.md` (for format reference)

## Outputs

- A reviewed, revised spec ready to commit
- A summary of what the review changed (in the commit message)

## Constraints

- No spec is committed without passing both the critic and blind reviewer.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds a fundamental architecture problem, stop and
  discuss with the user before rewriting.
- The critic has context (a brief summary). The blind reviewer has
  none. This is intentional — the blind reviewer's lack of context is
  what makes it objective.
- Reviewers are read-only. They report findings; the writer revises.
