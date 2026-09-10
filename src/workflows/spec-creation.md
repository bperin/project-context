# Workflow: Spec

## When

When a spec is written or substantially revised, before it's committed.

## Pattern

Writer-research-spec-optimizer-security-blind review. Five perspectives,
escalating objectivity:

```
Writer writes the spec (with full context — knows the goal, the user's intent)
    → Research agent gathers primary sources (standards, attack vectors, test vectors)
    → Spec-optimizer reviews (with context — challenges scope, coverage, requirements)
    → Security reviewer checks crypto/auth workstreams (if any)
    → Blind reviewer reviews (no context — judges only against AGENTS.md + architecture)
If any reviewer finds issues → writer revises → re-review
Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The writer has intent. The research agent has primary sources. The
spec-optimizer has context. The security reviewer has the algorithm-to-skill
matrix. The blind reviewer has neither context nor sources — only the
rules and the mission. This catches gaps the writer rationalized away,
biases the spec-optimizer shares, and sources the writer never checked.

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

### Role 2: Research agent (background, read-only)

- Spawned with `mattpocock/skills@research` (or equivalent).
- Investigates each standard, algorithm, and attack surface the spec
  touches against **primary sources** — official specs, RFCs, NIST
  publications, source code — not secondary write-ups.
- Writes findings to a single Markdown file (e.g.
  `decisions/SPEC-NNN-research.md`) with a citation for every claim.
- Does not write the spec. The writer consumes the research file.

### Role 3: Spec-optimizer (subagent, read-only, with context)

- Sees the spec file **and** a brief context summary from the writer
  (1-2 sentences: what this spec is for, what constraints the user
  emphasized) **and** the research findings file.
- Reviews with knowledge of intent — can challenge whether the spec
  solves the right problem, whether requirements coverage is complete,
  and whether scope is honest.
- Reports findings. Does not fix — the writer revises.

### Role 4: Security reviewer (subagent or skill, read-only)

- Only runs when the spec touches crypto, auth, or security primitives.
- Loads the project's security skills (`golang-security`,
  `wycheproof`, `ethereum`, etc.) per the algorithm-to-skill matrix in
  AGENTS.md.
- Checks that every algorithm is in the registry, that known attack
  vectors are documented, and that the required skills are listed and
  installed.
- Reports findings. Does not fix — the writer revises.

### Role 5: Blind reviewer (subagent, read-only, no context)

- Sees only the spec file, `AGENTS.md`, and the architecture document.
- No conversation context, no user messages, no writer rationale, no
  research file.
- Judges the spec against the mission and rules, not the intent.
- Reports findings. Does not fix — the writer revises.

## Steps

1. **Load the `adhd` skill.** Use it to explore the design space before
   writing. Spawn divergent branches under different cognitive frames,
   score and prune, then write the spec from the survivors. Do not
   lock onto the first approach before alternatives are considered.

2. **Spawn the research agent** (background, `mattpocock/skills@research`).
   Give it the spec topic, the algorithms/standards the spec will touch,
   and ask for primary-source citations for: governing standards, known
   test vector sources, and known attack vectors. Save the output to
   `decisions/SPEC-NNN-research.md`. Continue to step 3 while it runs;
   consume its findings before step 4.

3. **Write the spec.** Use `SPEC-NNN.template.md`. The spec describes
   WHAT and WHY, not HOW. Do not turn it into an implementation plan.
   Pull exact standard citations and attack references from the research
   file — do not invent them.

4. **Round 1-2: blind reviewer** (foreground, `blind-reviewer` profile —
   cheap model). The blind reviewer catches structural, template, and
   rule-compliance issues without burning heavy-model credits. Give it:
   - The spec file path
   - `AGENTS.md` path
   - The architecture document path
   - The project's algorithm registry (if applicable)
   - No context summary, no conversation history, no research file.
   - The blind reviewer checks:
     - **Technical rigor**: are algorithms and protocols correctly
       distinguished? Are domain-specific requirements present where
       relevant?
     - **Dependency compliance**: would any desired behavior require a
       forbidden import?
     - **Completeness**: are there spec behaviors with no success
       criterion? Success criteria with no corresponding behavior?
     - **Internal consistency**: does the spec contradict itself?
     - **Rule compliance**: does the spec respect AGENTS.md conventions?
     - **Template compliance**: are all required sections present?

5. **Apply blind reviewer findings.** Revise the spec.

6. **Spawn the security reviewer** (foreground, `subagent_explore`
   profile with security skills loaded in the prompt) **only if the
   spec touches crypto, auth, or security primitives**. This runs in
   parallel with the blind reviewer — both are cheap. Give it:
   - The spec file path
   - `AGENTS.md` path (for the algorithm-to-skill matrix)
   - The project's algorithm registry path (if applicable)
   - The security reviewer checks:
     - **Algorithm registry**: is every algorithm in the spec present
       in `trust/algorithms.json` (or the project's registry)?
     - **Skill gating**: are the primary and secondary skills for each
       algorithm listed? Are they installed?
     - **Attack surface**: are known attacks and failure modes
       documented (from the research file)?
     - **Dependency compliance**: would any behavior require a
       forbidden import?

7. **Apply security reviewer findings.** Revise the spec.

8. **Round counter (rounds 1-2).** If the blind reviewer or security
   reviewer found MUST-FIX or SHOULD-FIX issues, go back to step 4
   (re-spawn blind reviewer on the revised spec). Max 2 cheap rounds.

9. **Round 3 (final): spec-optimizer** (foreground, `spec-optimizer` profile — heavy
   model with `adhd` loaded). The spec-optimizer fires only once, on the
   final round, for deep architecture and coverage review. Load the
   `adhd` skill first — use it to explore alternative architectures
   and challenge the spec's problem fit from divergent angles before
   reviewing. Give it:
   - The spec file path
   - The research findings file path
   - A 1-2 sentence context summary (what this spec is for, key user
     constraints)
   - `AGENTS.md` path
   - The architecture document path
   - Instruction to read `.ai-trust/.agents/agents/spec-optimizer.md` first for
     its role definition and output format
   - The spec-optimizer checks:
     - **Requirements coverage**: does every desired behavior map to a
       measurable success criterion? Any orphans in either direction?
     - **Problem fit**: does this spec solve the actual problem? Is
       the scope right — not too narrow, not too broad?
     - **Completeness**: does it cover everything the architecture asks
       for in this module? Are there missing behaviors?
     - **Dependency compliance**: does it respect the project's
       dependency rules (see AGENTS.md)?
     - **Testability**: is every desired behavior testable? Are success
       criteria objective (pass/fail, not subjective)?
     - **Scope discipline**: is the Out of Scope section honest? Are
       there features sneaking in that belong in a future spec?
     - **Research completeness**: are standards and attack sources
       cited from primary sources, not vague references?

10. **Apply spec-optimizer findings.** Revise the spec. If the spec-optimizer found a
    fundamental problem (wrong problem, wrong scope), stop and discuss
    with the user before rewriting.

11. **Escalation.** If the spec-optimizer found MUST-FIX issues that require
    another round, escalate to the user with a summary of the
    disagreement. Do not loop the heavy model more than once.

12. **Commit.** When all reviewers pass (only NITs or clean), commit the
    spec with a message summarizing what the review changed.

## Expected output

A spec that:

- States WHAT the system does and WHY, not HOW.
- Lists every desired behavior as observable, testable statements.
- Has success criteria that are objectively verifiable (a command to
  run, a grep to check, a test to pass) — not subjective ("clean code",
  "well-documented").
- Has an honest Out of Scope section that keeps scope creep out.
- Respects the project's dependency rules (see AGENTS.md).
- Names every algorithm by its ID in the project's algorithm registry
  (if applicable) — no algorithm appears in the spec that isn't in the
  registry.
- Cites standards and attack sources from primary sources (not "known
  test vector").
- Has constraints that align with the desired behaviors (no
  contradictions).
- Has been stress-tested from five angles: intent (writer + adhd),
  sources (research), rules (blind reviewer, cheap rounds 1-2),
  security (security reviewer), and architecture (spec-optimizer, heavy
  round 3).

## Subagent prompt templates

### Research agent

```
Research the standards, algorithms, and attack surfaces for SPEC-NNN
(<topic>). Investigate against primary sources only — official specs,
RFCs, NIST publications, source code — not secondary write-ups.

For each standard or algorithm, cite ONLY:
- The governing standard (RFC number + section, or NIST/W3C publication)
- The canonical test vector source (specific test case ID or suite)
- The top 2-3 known attack vectors or failure modes (with source)

Keep it tight. One paragraph per topic. No exhaustive enumeration.
Write the findings to decisions/SPEC-NNN-research.md with a citation
for every claim. Do not write the spec.
```

### Spec-optimizer

```
<role>
You are a spec optimizer for this project. You review specs only — not
plans, not tasks, not code. Your job is to pressure-test the spec as a
blueprint. Read .ai-trust/.agents/agents/spec-optimizer.md first for your
full role definition, output format, and what you do NOT check.
</role>

<context>
<summary><1-2 sentence summary of what this spec is for></summary>
</context>

<instructions>
1. Read AGENTS.md at <path> for project conventions and rules.
2. Read the spec at <path>.
3. Read the research findings at <path>.
4. Read the architecture document at <path>.
5. Check:
   - Requirements coverage: every desired behavior maps to a success
     criterion? Any orphans?
   - Problem fit: does this spec solve the actual problem? Is the scope
     right?
   - Completeness: are there missing behaviors the architecture asks for?
   - Dependency compliance: does it respect the project's dependency
     rules (see AGENTS.md)?
   - Testability: is every desired behavior testable? Are success
     criteria objective?
   - Scope discipline: is Out of Scope honest? Any scope creep?
   - Research completeness: are standards and attack sources cited from
     primary sources?
6. Return findings in the format specified by spec-optimizer.md.
</instructions>
```

### Security reviewer

```
<role>
You are a security reviewer for this spec. You review crypto, auth, and
security primitives only. Read AGENTS.md for the algorithm-to-skill
matrix and dependency rules.
</role>

<instructions>
1. Read AGENTS.md at <path> for the algorithm-to-skill matrix.
2. Read the spec at <path>.
3. Read the project's algorithm registry at <path> (if applicable).
4. Check:
   - Algorithm registry: is every algorithm in the spec present in the
     registry?
   - Skill gating: are primary and secondary skills listed for each
     algorithm? Are they installed?
   - Attack surface: are known attacks and failure modes documented?
   - Dependency compliance: would any behavior require a forbidden
     import?
5. Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
   exact text.
</instructions>
```

### Blind reviewer

```
You are a spec reviewer for this project. Read AGENTS.md for full
project conventions and rules.

Read the spec at <path>.
Also read the architecture document at <path>. If the project has an
algorithm registry, read that too.

Check:
- Technical rigor: are algorithms and protocols correctly distinguished?
  Are domain-specific requirements (canonicalization, constant-time
  handling, nonce management, etc.) present where relevant? Known
  attacks or failure modes documented?
- Dependency compliance: would any behavior require a forbidden import
  or violate the project's dependency rules?
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
- The project's algorithm registry (if applicable)
- `AGENTS.md` (project conventions and rules)
- `SPEC-NNN.template.md` (for format reference)
- The research findings file (`decisions/SPEC-NNN-research.md`)

## Outputs

- A reviewed, revised spec ready to commit
- A research findings file with primary-source citations
- A summary of what the review changed (in the commit message)

## Constraints

- No spec is committed without passing the spec-optimizer, security reviewer
  (when applicable), and blind reviewer.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds a fundamental architecture problem, stop and
  discuss with the user before rewriting.
- The spec-optimizer has context (a brief summary). The blind reviewer has
  none. This is intentional — the blind reviewer's lack of context is
  what makes it objective.
- The research agent writes findings only. It does not write the spec.
- Reviewers are read-only. They report findings; the writer revises.
