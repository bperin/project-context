# Workflow: Plan

## When

When a plan is written, before implementation starts and before the
plan is committed.

## Pattern

Writer-research-planner-security-blind review. Same five-pass pattern
as the spec workflow:

```
Writer writes the plan (with full context — knows the spec, the user's goals)
    → Research agent gathers primary sources (standards, vectors, attack sources)
    → Planner reviews (with context — challenges approach, coverage, ordering)
    → Security reviewer checks crypto/auth workstreams (if any)
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
  the project's algorithm registry (if applicable) for the `skill`
  field (primary + secondary skills) and the algorithm's standard
  citation.
- Revises after each review round.

### Role 2: Research agent (background, read-only)

- Spawned with `mattpocock/skills@research` (or equivalent).
- Investigates each workstream's standards, algorithms, and attack
  surfaces against **primary sources** — official specs, RFCs, NIST
  publications, source code — not secondary write-ups.
- Writes findings to `decisions/PLAN-NNN-research.md` with a citation
  for every claim.
- Does not write the plan. The writer consumes the research file.

### Role 3: Planner (subagent, read-only, with context)

- Sees the plan file, the source spec, the research findings, the
  project's algorithm registry (if applicable), and a brief context
  summary from the writer.
- Reviews with knowledge of intent — can challenge whether the plan
  is the right approach to implement the spec, whether workstreams are
  ordered correctly, and whether scope matches the spec.
- Reports findings. Does not fix — the writer revises.

### Role 4: Security reviewer (subagent or skill, read-only)

- Only runs when the plan touches crypto, auth, or security primitives.
- Loads the project's security skills (`golang-security`,
  `wycheproof`, `ethereum`, etc.) per the algorithm-to-skill matrix in
  AGENTS.md.
- Checks that every algorithm is in the registry, that skills are
  listed and installed, that test vectors are specific, and that
  negative tests are present.
- Reports findings. Does not fix — the writer revises.

### Role 5: Blind reviewer (subagent, read-only, no context)

- Sees only the plan file, the source spec, `AGENTS.md`,
  the project's algorithm registry (if applicable), and the
  architecture document.
- No conversation context, no user messages, no writer rationale, no
  research file.
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

3. **Spawn the research agent** (background, `mattpocock/skills@research`).
   Give it the workstream topics, the algorithms/standards each touches,
   and ask for primary-source citations for: governing standards, exact
   test vector sources, and known attack vectors. Save the output to
   `decisions/PLAN-NNN-research.md`. Continue to step 4 while it runs;
   consume its findings before step 5.

4. **Write the plan.** Use `PLAN-NNN.template.md`. For each workstream:
   - List the algorithm IDs from the project's algorithm registry
     (if applicable).
   - List the primary and secondary skills (from the algorithm's `skill`
     field).
   - Confirm the skills are installed (`.agents/skills/` or user-level).
     If a skill is missing, flag it — it must be installed before the
     workstream starts.
   - Name specific test vectors from the governing standard (not "known
     test vector" — cite the exact source: RFC number, section, test
     case ID) pulled from the research file.
   - List negative tests (wrong key, tampered input, etc.).
   - List external packages to add and the project's standard library
     packages used.
   - Call out actual file paths to create/modify.

5. **Round 1-2: blind reviewer** (foreground, `blind-reviewer` profile —
   cheap model). The blind reviewer catches structural, template, and
   rule-compliance issues without burning heavy-model credits. Give it:
   - The plan file path
   - The source spec path
   - The project's algorithm registry path (if applicable)
   - `AGENTS.md` path
   - The architecture document path
   - No context summary, no conversation history, no research file.
   - The blind reviewer checks:
     - **Algorithm-to-skill matrix**: for every workstream implementing
       an algorithm, is the algorithm ID in the algorithm registry? Is
       the primary skill listed? Is it installed? Are secondary skills
       listed where applicable?
     - **Test vectors**: every algorithm must name a specific test
       vector from its governing standard. "Known test vector" is not
       specific enough.
     - **Negative tests**: every algorithm must have at least one
       negative test.
     - **Completion criteria**: every criterion must be objectively
       verifiable (a command to run, a grep to check, a test to pass).
     - **Dependency compliance**: does the plan respect the project's
       dependency rules (see AGENTS.md)? Would any workstream require a
       forbidden import?
     - **Spec constraints**: does the plan violate any constraint from
       the spec or AGENTS.md?
     - **Template compliance**: are all required sections present
       (Workstreams, Out of Scope, Requirements, Acceptance Criteria,
       Research Findings, Security Considerations)?

6. **Apply blind reviewer findings.** Revise the plan.

7. **Spawn the security reviewer** (foreground, `subagent_explore`
   profile with security skills loaded in the prompt) **only if the
   plan touches crypto, auth, or security primitives**. This runs in
   parallel with the blind reviewer — both are cheap. Give it:
   - The plan file path
   - The research findings file path
   - The project's algorithm registry path (if applicable)
   - `AGENTS.md` path (for the algorithm-to-skill matrix)
   - The security reviewer checks:
     - **Algorithm registry**: is every algorithm in the plan present
       in the registry?
     - **Skill gating**: are primary and secondary skills listed for
       each algorithm? Are they installed?
     - **Test vectors**: every algorithm names a specific test vector
       from its governing standard. "Known test vector" is not specific
       enough.
     - **Negative tests**: every algorithm has at least one negative
       test.
     - **Dependency compliance**: would any workstream require a
       forbidden import?

8. **Apply security reviewer findings.** Revise the plan.

9. **Round counter (rounds 1-2).** If the blind reviewer or security
   reviewer found MUST-FIX or SHOULD-FIX issues, go back to step 5
   (re-spawn blind reviewer on the revised plan). Max 2 cheap rounds.

10. **Round 3 (final): planner** (foreground, `planner` profile — heavy
    model with `adhd` loaded). The planner fires only once, on the
    final round, for deep architecture and coverage review. Load the
    `adhd` skill first — use it to explore alternative implementation
    approaches and challenge the plan's architecture from divergent
    angles before reviewing. Give it:
    - The plan file path
    - The source spec path
    - The research findings file path
    - The project's algorithm registry path (if applicable)
    - `AGENTS.md` path
    - A 1-2 sentence context summary (what this plan covers, key user
      priorities)
    - The planner checks:
      - **Spec coverage**: does every spec desired behavior have a
        workstream? Does every workstream trace to a spec behavior?
      - **Approach soundness**: is this the right way to implement the
        spec? Are there simpler approaches the writer dismissed?
      - **Workstream ordering**: are workstreams ordered so no
        workstream depends on a later one? Are dependency edges explicit?
      - **Scope vs. spec**: is the plan trying to do more than the spec
        asks? Less? Is the Out of Scope section honest?
      - **Research completeness**: are standards and vectors cited from
        primary sources, not vague references?
      - **Completion criteria**: is every criterion objectively
        verifiable (a command to run, a grep to check, a test to pass)?

11. **Apply planner findings.** Revise the plan. If the planner found a
    fundamental problem (wrong architecture, wrong workstream order),
    stop and discuss with the user before rewriting.

12. **Escalation.** If the planner found MUST-FIX issues that require
    another round, escalate to the user with a summary of the
    disagreement. Do not loop the heavy model more than once.

13. **Commit.** When all reviewers pass, commit the plan with a
    message summarizing what the review changed.

## Expected output

A plan that:

- Traces every workstream to a spec desired behavior — no orphans in
  either direction.
- Lists actual file paths to create/modify (not "a file for hashing" —
  `src/crypto/hash/sha256.ts`).
- Lists the algorithm ID, primary skill, and secondary skills for each
  workstream, matching the project's algorithm registry (if
  applicable).
- Confirms skills are installed before the workstream starts.
- Names specific test vectors (RFC number, section, test case ID) —
  not "known test vector."
- Lists negative tests for every algorithm.
- Has completion criteria that are objectively verifiable (commands,
  greps, test runs) — not subjective.
- Has workstreams ordered so no workstream depends on a later one.
- Respects the project's dependency rules (see AGENTS.md).
- Lists external packages to add and standard library packages used.
- Has an honest Out of Scope section.
- Has been stress-tested from five angles: intent (writer), sources
  (research), context (planner), security (security reviewer), and
  rules (blind reviewer).

## Subagent prompt templates

### Research agent

```
Research the standards, algorithms, and attack surfaces for PLAN-NNN
(<topic>). Investigate against primary sources only — official specs,
RFCs, NIST publications, source code — not secondary write-ups.

For each workstream's algorithm or standard, cite ONLY:
- The governing standard (RFC number + section, or NIST/W3C publication)
- The canonical test vector source (specific test case ID or suite)
- The top 2-3 known attack vectors or failure modes (with source)

Keep it tight. One paragraph per workstream. No exhaustive enumeration.
Write the findings to decisions/PLAN-NNN-research.md with a citation
for every claim. Do not write the plan.
```

### Planner

```
<role>
You are a planning reviewer for this project. You review specs and plans
— not tasks, not code. Your job is to pressure-test the document as a
blueprint. Read .ai-trust/.agents/agents/planner.md first for your full
role definition, output format, and what you do NOT check.
</role>

<context>
<summary><1-2 sentence summary of what this plan covers></summary>
</context>

<instructions>
1. Read AGENTS.md at <path> for project conventions, skill-gated
   implementation rules, and testing rules.
2. Read the plan at <path>.
3. Read the source spec at <path>.
4. Read the research findings at <path>.
5. Read the project's algorithm registry at <path> (if applicable).
6. Check:
   - Spec coverage: does every spec behavior have a workstream? Any
     orphans?
   - Approach soundness: is this the right way to implement the spec?
   - Workstream ordering: are workstreams correctly ordered? Are
     dependency edges explicit?
   - Scope: is the plan doing more or less than the spec asks? Is Out
     of Scope honest?
   - Research completeness: are standards and vectors cited from
     primary sources?
   - Completion criteria: are they objectively verifiable?
7. Return findings in the format specified by planner.md.
</instructions>
```

### Security reviewer

```
<role>
You are a security reviewer for this plan. You review crypto, auth, and
security primitives only. Read AGENTS.md for the algorithm-to-skill
matrix and dependency rules.
</role>

<instructions>
1. Read AGENTS.md at <path> for the algorithm-to-skill matrix.
2. Read the plan at <path>.
3. Read the research findings at <path>.
4. Read the project's algorithm registry at <path> (if applicable).
5. Check:
   - Algorithm registry: is every algorithm in the plan present in the
     registry?
   - Skill gating: are primary and secondary skills listed for each
     algorithm? Are they installed?
   - Test vectors: are they specific (named source, not "known test
     vector")?
   - Negative tests: does every algorithm have at least one?
   - Dependency compliance: would any workstream require a forbidden
     import?
6. Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers and
   exact text.
</instructions>
```

### Blind reviewer

```
You are a plan reviewer for this project. Read AGENTS.md for project
conventions, skill-gated implementation rules, and testing rules.

Read the plan at <path>.
Also read the source spec at <path>, the project's algorithm registry
(if applicable), and the architecture document at <path>.

Check:
1. Does every spec desired behavior have a corresponding workstream/task?
2. Are algorithm IDs in the algorithm registry? Are skills listed and
   installed?
3. Are test vectors specific (named source, not "known test vector")?
4. Does every workstream have negative tests?
5. Are completion criteria objectively verifiable?
6. Is dependency ordering correct?
7. Are there spec constraints the plan violates?
8. Does the plan respect the project's dependency rules (see AGENTS.md)?

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite line numbers.
```

## Inputs

- The plan file (`plans/PLAN-NNN.md`)
- The source spec (`specs/SPEC-NNN.md`)
- The project's algorithm registry (if applicable)
- `AGENTS.md`
- The architecture document
- `PLAN-NNN.template.md` (for format reference)
- The research findings file (`decisions/PLAN-NNN-research.md`)

## Outputs

- A reviewed, revised plan ready to commit
- A research findings file with primary-source citations
- A summary of what the review changed (in the commit message)

## Constraints

- No plan is committed without passing the planner, security reviewer
  (when applicable), and blind reviewer.
- No implementation starts until the plan is reviewed and committed.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds the spec is wrong (not the plan), stop and go back
  to the spec workflow.
- The planner has context (a brief summary). The blind reviewer has
  none. The research agent writes findings only.
- Reviewers are read-only. They report findings; the writer revises.
