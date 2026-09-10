# Workflow: Spec

## When

When a spec is written or substantially revised, before it's committed.

## Pattern

Writer-research-optimizer-review. The orchestrator is the big brain —
it has full context, loads `adhd` for divergent ideation, dispatches a
research subagent for primary sources, then an optimizer subagent to
tighten the spec, then a reviewer subagent to check correctness.

```
Orchestrator loads adhd (divergent ideation on the design space)
    → Orchestrator dispatches research subagent (background, primary sources)
    → Orchestrator writes the spec (with full context)
    → Orchestrator dispatches optimizer subagent (spec-optimizer, with context)
    → Orchestrator applies optimizer findings
    → Orchestrator dispatches reviewer subagent (reviewer, with context)
    → Orchestrator applies reviewer findings
    → Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The orchestrator has intent and context. The research subagent has
primary sources. The optimizer keeps the spec tight and on track
(scope, approach, coverage). The reviewer checks correctness and rule
compliance.

## Roles

### Role 1: Orchestrator (you)

- Has full conversation context — knows the user's goal, what was
  discussed, what was rejected.
- Loads the `adhd` skill before writing. Uses it to explore the design
  space — spawn divergent branches under different cognitive frames
  (regulator, biology, speedrunner, 10-year-old, $0 budget), score and
  prune them, then write the spec from the survivors. This prevents
  locking onto the first approach before alternatives are considered.
- Writes the spec from the `SPEC-NNN.template.md` template.
- Dispatches the research and reviewer subagents.
- Revises the spec after each review round.

### Role 2: Research subagent (background, read-only)

- Spawned with `mattpocock/skills@research` (or equivalent).
- Investigates each standard, algorithm, and attack surface the spec
  touches against **primary sources** — official specs, RFCs, NIST
  publications, source code — not secondary write-ups.
- Writes findings to a single Markdown file (e.g.
  `decisions/SPEC-NNN-research.md`) with a citation for every claim.
- Does not write the spec. The orchestrator consumes the research file.

### Role 3: Optimizer (spec-optimizer subagent, read-only, with context)

- Sees the spec file **and** a brief context summary from the
  orchestrator (1-2 sentences: what this spec is for, what constraints
  the user emphasized) **and** the research findings file.
- Optimizes with knowledge of intent — challenges whether the spec
  solves the right problem, trims scope creep, checks coverage and
  approach soundness.
- Reports findings. Does not fix — the orchestrator revises.
- Runs BEFORE the reviewer.

### Role 4: Reviewer (reviewer subagent, read-only, with context)

- Sees the spec file, the research findings file, `AGENTS.md`, the
  architecture document, and a brief context summary.
- Checks correctness, rule compliance, template compliance, dependency
  compliance, and internal consistency.
- Reports findings. Does not fix — the orchestrator revises.
- Runs AFTER the optimizer.

## Steps

1. **Load the `adhd` skill.** Use it to explore the design space before
   writing. Spawn divergent branches under different cognitive frames,
   score and prune, then write the spec from the survivors. Do not
   lock onto the first approach before alternatives are considered.

2. **Dispatch the research subagent** (background,
   `mattpocock/skills@research`). Give it the spec topic, the
   algorithms/standards the spec will touch, and ask for primary-source
   citations for: governing standards, known test vector sources, and
   known attack vectors. Save the output to
   `decisions/SPEC-NNN-research.md`. Continue to step 3 while it runs;
   consume its findings before step 4.

3. **Write the spec.** Use `SPEC-NNN.template.md`. The spec describes
   WHAT and WHY, not HOW. Do not turn it into an implementation plan.
   Pull exact standard citations and attack references from the research
   file — do not invent them.

4. **Dispatch the optimizer** (foreground, `spec-optimizer` profile —
   heavy model with `adhd` loaded). Load the `adhd` skill first — use
   it to explore alternative architectures and challenge the spec's
   problem fit from divergent angles before optimizing. Give it:
   - The spec file path
   - The research findings file path
   - A 1-2 sentence context summary (what this spec is for, key user
     constraints)
   - `AGENTS.md` path
   - The architecture document path
   - Instruction to read `.ai-trust/.agents/agents/spec-optimizer.md` first for
     its role definition and output format
   - The optimizer checks:
     - **Problem fit**: does this spec solve the actual problem? Is
       the scope right — not too narrow, not too broad?
     - **Approach soundness**: is this the right way to frame the problem?
       Are there simpler approaches the writer dismissed?
     - **Requirements coverage**: does every desired behavior map to a
       measurable success criterion? Any orphans in either direction?
     - **Completeness**: does it cover everything the architecture asks
       for in this module? Are there missing behaviors?
     - **Testability**: is every desired behavior testable? Are success
       criteria objective (pass/fail, not subjective)?
     - **Scope discipline**: is the Out of Scope section honest? Are
       there features sneaking in that belong in a future spec? Trim
       scope creep.
     - **Research completeness**: are standards and attack sources
       cited from primary sources, not vague references?
     - **Internal consistency**: does the spec contradict itself?

5. **Apply optimizer findings.** Revise the spec. If the optimizer
   found a fundamental problem (wrong problem, wrong scope), stop and
   discuss with the user before rewriting.

6. **Dispatch the reviewer** (foreground, `reviewer` profile — cheap
   model). Give it:
   - The spec file path
   - The research findings file path
   - `AGENTS.md` path
   - The architecture document path
   - A 1-2 sentence context summary
   - The reviewer checks:
     - **Correctness**: are cited standards real? Are algorithm IDs in
       the registry?
     - **Rule compliance**: does the spec respect AGENTS.md conventions?
     - **Template compliance**: are all required sections present?
     - **Dependency compliance**: would any desired behavior require a
       forbidden import? Does it respect the project's dependency
       rules (see AGENTS.md)?
     - **Internal consistency**: does the spec contradict itself?

7. **Apply reviewer findings.** Revise the spec.

8. **Round counter.** If the optimizer or reviewer found MUST-FIX or
   SHOULD-FIX issues, go back to step 4 (re-dispatch the optimizer on
   the revised spec, then the reviewer). Max 3 rounds. If still no
   agreement after round 3, escalate to the user with a summary of the
   disagreement.

9. **Commit.** When both the optimizer and reviewer pass (only NITs or
   clean), commit the spec with a message summarizing what the review
   changed.

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
- Has been stress-tested from three angles: intent (orchestrator +
  adhd), sources (research), and architecture (reviewer with context).

## Subagent prompt templates

### Research subagent

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

### Reviewer (spec-optimizer)

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
   - Technical rigor: algorithms and protocols correctly distinguished?
     Domain-specific requirements present?
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
   - Internal consistency: does the spec contradict itself?
   - Rule compliance: does it respect AGENTS.md conventions?
   - Template compliance: are all required sections present?
6. Return findings in the format specified by spec-optimizer.md.
</instructions>
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

- No spec is committed without passing the reviewer.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds a fundamental architecture problem, stop and
  discuss with the user before rewriting.
- The reviewer has context (a brief summary + the research file).
- The research subagent writes findings only. It does not write the spec.
- The reviewer is read-only. It reports findings; the orchestrator revises.
