# Workflow: Plan

## When

When a plan is written, before implementation starts and before the
plan is committed.

## Pattern

Writer-research-optimizer review. Same pattern as the spec workflow.
The orchestrator is the big brain — it has full context, loads `adhd`
for divergent ideation, dispatches a research subagent for primary
sources, then a reviewer subagent for review.

```
Orchestrator loads adhd (divergent ideation on the implementation design space)
    → Orchestrator dispatches research subagent (background, primary sources)
    → Orchestrator writes the plan (with full context)
    → Orchestrator dispatches reviewer subagent (plan-optimizer, with context)
    → Reviewer reports findings
    → Orchestrator fixes
    → Loop: max 3 rounds. If still no agreement after 3, escalate to the user.
```

The plan is the implementation blueprint. It calls out actual files,
skills, dependencies, test vectors — everything needed to execute.
A plan that leaves these vague forces the implementer to guess.

## Roles

### Role 1: Orchestrator (you)

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
- Dispatches the research and reviewer subagents.
- Revises the plan after each review round.

### Role 2: Research subagent (background, read-only)

- Spawned with `mattpocock/skills@research` (or equivalent).
- Investigates each workstream's standards, algorithms, and attack
  surfaces against **primary sources** — official specs, RFCs, NIST
  publications, source code — not secondary write-ups.
- Writes findings to `decisions/PLAN-NNN-research.md` with a citation
  for every claim.
- Does not write the plan. The orchestrator consumes the research file.

### Role 3: Reviewer (plan-optimizer subagent, read-only, with context)

- Sees the plan file, the source spec, the research findings, the
  project's algorithm registry (if applicable), and a brief context
  summary from the orchestrator.
- Reviews with knowledge of intent — can challenge whether the plan
  is the right approach to implement the spec, whether workstreams are
  ordered correctly, and whether scope matches the spec.
- Reports findings. Does not fix — the orchestrator revises.

## Steps

1. **Load the `adhd` skill.** Use it to explore the implementation design
   space before writing. Spawn divergent branches under different
   cognitive frames, score and prune, then write the plan from the
   survivors. Do not lock onto the first architecture before
   alternatives are considered.

2. **Read the source spec.** Every workstream in the plan must trace to
   a spec desired behavior. Flag any spec behavior with no corresponding
   workstream, and any workstream with no corresponding spec behavior.

3. **Dispatch the research subagent** (background,
   `mattpocock/skills@research`). Give it the workstream topics, the
   algorithms/standards each touches, and ask for primary-source
   citations for: governing standards, exact test vector sources, and
   known attack vectors. Save the output to
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

5. **Dispatch the reviewer** (foreground, `plan-optimizer` profile —
   medium model with `adhd` loaded). Load the `adhd` skill first — use
   it to explore alternative implementation approaches and challenge
   the plan's architecture from divergent angles before reviewing. Give
   it:
   - The plan file path
   - The source spec path
   - The research findings file path
   - The project's algorithm registry path (if applicable)
   - `AGENTS.md` path
   - A 1-2 sentence context summary (what this plan covers, key user
     priorities)
   - The reviewer checks:
     - **Algorithm-to-skill matrix**: for every workstream implementing
       an algorithm, is the algorithm ID in the algorithm registry? Is
       the primary skill listed? Is it installed? Are secondary skills
       listed where applicable?
     - **Spec coverage**: does every spec desired behavior have a
       workstream? Does every workstream trace to a spec behavior?
     - **Approach soundness**: is this the right way to implement the
       spec? Are there simpler approaches the writer dismissed?
     - **Workstream ordering**: are workstreams ordered so no
       workstream depends on a later one? Are dependency edges explicit?
     - **Scope vs. spec**: is the plan trying to do more than the spec
       asks? Less? Is the Out of Scope section honest?
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
     - **Research completeness**: are standards and vectors cited from
       primary sources, not vague references?

6. **Apply reviewer findings.** Revise the plan. If the reviewer found
   a fundamental problem (wrong architecture, wrong workstream order),
   stop and discuss with the user before rewriting.

7. **Round counter.** If the reviewer found MUST-FIX or SHOULD-FIX
   issues, go back to step 5 (re-dispatch the reviewer on the revised
   plan). Max 3 rounds. If still no agreement after round 3, escalate
   to the user with a summary of the disagreement.

8. **Commit.** When the reviewer passes, commit the plan with a
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
- Has been stress-tested from three angles: intent (orchestrator +
  adhd), sources (research), and architecture (reviewer with context).

## Subagent prompt templates

### Research subagent

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

### Reviewer (plan-optimizer)

```
<role>
You are a plan optimizer for this project. You review plans only — not
specs, not tasks, not code. Your job is to pressure-test the plan as an
implementation blueprint. Read .ai-trust/.agents/agents/plan-optimizer.md
first for your full role definition, output format, and what you do NOT check.
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
   - Algorithm-to-skill matrix: every workstream's algorithm ID in the
     registry? Primary and secondary skills listed and installed?
   - Spec coverage: does every spec behavior have a workstream? Any
     orphans?
   - Approach soundness: is this the right way to implement the spec?
   - Workstream ordering: are workstreams correctly ordered? Are
     dependency edges explicit?
   - Scope: is the plan doing more or less than the spec asks? Is Out
     of Scope honest?
   - Test vectors: are they specific (named source, not "known test
     vector")?
   - Negative tests: does every algorithm have at least one?
   - Completion criteria: are they objectively verifiable?
   - Dependency compliance: would any workstream require a forbidden
     import?
   - Research completeness: are standards and vectors cited from
     primary sources?
7. Return findings in the format specified by plan-optimizer.md.
</instructions>
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

- No plan is committed without passing the reviewer.
- No implementation starts until the plan is reviewed and committed.
- Max 3 review rounds. Escalate to the user if unresolved.
- If a review finds the spec is wrong (not the plan), stop and go back
  to the spec workflow.
- The reviewer has context (a brief summary + the research file).
- The research subagent writes findings only.
- The reviewer is read-only. It reports findings; the orchestrator revises.
