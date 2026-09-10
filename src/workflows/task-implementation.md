# Workflow: Task

## When

When a task moves from `todo` to `in_progress`. This is the full task
execution pipeline — from implementation through testing to done.

## Pipeline

The orchestrator never implements, reviews, or tests directly. Every
role is a subagent. The orchestrator spawns them, feeds them context
packets, collects results, and decides what happens next.

```
Orchestrator loads adhd skill (divergent ideation on implementation approach)
    → Orchestrator spawns primary implementer (foreground, write access, primary skill)
    → Primary implements TASK-N (code + initial tests)
        → Orchestrator spawns secondary implementer (foreground, write access, secondary skill)
            → Secondary reviews + fixes TASK-N directly
                → Orchestrator spawns code reviewer (background, read-only, code-review skill)
                    → Code reviewer reports findings
Primary moves to TASK-N+1 while code review runs
If code review calls back → orchestrator spawns fix agent
When code review passes → orchestrator spawns testing agent (background, write access, testing skill)
If tests fail → test-failure workflow (triage, fix, re-run, max 3 rounds, escalate)
When all tests pass → commit → task done
```

## Roles

### Role 0: Orchestrator (you)

- Has full conversation context.
- **Never writes code, tests, or reviews.** Only spawns subagents,
  feeds them context packets, collects results, and decides next steps.
- Builds context packets with the CLI for each subagent.
- Spawns the primary implementer, secondary implementer, code
  reviewer, and testing agent. Moves to the next task while background
  agents work.
- If any agent calls back with findings, spawns a fix subagent (or
  re-spawns the relevant agent) to address them.

### Role 1: Primary implementer (subagent, foreground, write access)

- **No conversation context** — sees only the context packet, task
  file, source files, and the algorithm's **primary skill** from the
  project's algorithm registry (if applicable).
- Implements code + initial tests (just enough to get green: known-answer
  vectors and a round-trip where applicable). The full test suite is
  written by the testing agent after code review.
- Runs verification: the project's build, vet, test, and lint commands.
- Reports what was implemented and any issues found.

### Role 2: Secondary implementer (subagent, write access)

- **No conversation context** — sees only the task file, code, and the
  algorithm's **secondary skill** from the project's algorithm registry
  (if applicable).
- Reviews through a different lens than the primary (different skill).
- **Has write access — fixes issues directly, doesn't just report.**
- Says what they fixed and why, briefly.
- Runs verification after fixing.

### Role 3: Code reviewer (subagent, background, read-only)

- **No conversation context** — sees only `AGENTS.md`, the project's
  algorithm registry (if applicable), the task file, and the diff.
- Loads the project's code-review skill.
- Judges the **code** against project rules (documentation, security,
  architecture, style). Does not review tests — the full test suite
  hasn't been written yet.
- Reports findings as MUST-FIX / SHOULD-FIX / NIT. Does not fix — the
  primary fixes.
- Runs in background while primary works on the next task.

### Role 4: Testing agent (subagent, background, write access)

- **No conversation context** — sees only the source files under test,
  the task file, `AGENTS.md` (testing rules), the project's algorithm
  registry (if applicable), and the project's testing skill.
- Loads the project's testing skill (on-demand) before writing tests.
- Loads the algorithm's secondary skill if it is testing-focused.
- Writes the full test suite: known vectors, known-answer test vectors,
  fuzz targets, examples, negative tests, boundary tests — per the
  tier rules in `AGENTS.md`.
- **Has write access — writes test files directly.**
- Runs verification after writing: the project's test command with
  race detection and shuffle enabled (if supported).
- Reports what was written and any issues found (e.g. code that fails
  a test, suggesting a code bug the reviewer missed).
- Runs in background while primary works on the next task.

## Steps

1. **Build a context packet** for the task:
   ```bash
   node /Users/brian/code/project-context/bin/cli.js context TASK-NNN -t . -o .context-packet.json
   ```

2. **Spawn the primary implementer** (foreground, `subagent_general`
   profile for write access). Give it:
   - The context packet file path
   - The task file path (for goal, files, symbols, constraints, acceptance
     criteria, algorithm ID)
   - The primary skill path (from the algorithm registry if applicable)
   - The project's algorithm registry path (if applicable)
   - `AGENTS.md` path
   The primary implementer:
   - Loads the primary skill, reads its guidance.
   - Implements the code. Documentation cites the relevant standard.
     Concrete structs. Constant-time comparisons. No `math/rand`. No
     private key `String()`/`Format()`/`GoString()`.
   - Writes initial tests (just enough to get green: known-answer vector
     from the standard, a round-trip test where applicable, constant-time
     comparisons for security-sensitive values).
   - Runs verification: build, vet, test, lint. All must pass.
   - Reports what was implemented and any issues found.

3. **Reconcile primary implementer output.** If it reports issues it
   couldn't fix, spawn it again with specific guidance. Do not fix
   code yourself — re-spawn the subagent.

4. **Spawn the secondary implementer** (foreground, `subagent_general`
   profile for write access). Give it: context packet, task file,
   algorithm ID, secondary skill path, files to review. It fixes
   issues directly and reports what it changed.

5. **Reconcile.** If the secondary found and fixed things, verify the
   fixes are correct by re-running verification. If it flags something
   it can't fix, re-spawn the primary implementer with specific guidance.
   Do not fix code yourself — re-spawn the subagent.

6. **Spawn the code reviewer** (background, `subagent_explore`
   profile). Give it: `AGENTS.md`, the project's algorithm registry
   (if applicable), task file, diff. It checks the code against project
   rules (see Code reviewer checks below).

7. **Move to the next task.** If the code reviewer calls back with
   findings, spawn a fix subagent (re-spawn the primary or secondary
   implementer with the findings). Do not fix code yourself.

8. **When code review passes → spawn the testing agent** (background,
   `subagent_general` profile for write access). Give it:
   - The source file path(s) under test
   - The task file path (for acceptance criteria and algorithm ID)
   - `AGENTS.md` path (testing rules section)
   - The project's algorithm registry path (if applicable)
   - The project's testing skill path
   - The algorithm's secondary skill path if testing-focused
   - The identified tier (so the testing agent applies the right
     rules — see Testing tiers below)
   The testing agent writes the full test suite and runs verification.

9. **Reconcile testing agent output.** If the testing agent reports a
   code bug (a test fails against the approved code), spawn the primary
   implementer again to fix the code — the code review missed it. If it
   reports test design questions, answer them. Do not fix code or tests
   yourself — re-spawn the relevant subagent.

13. **If tests fail → run the test-failure workflow**
    (`workflows/test-failure.md`). Do not free-form "go back and fix."
    The test-failure workflow is a structured triage loop: classify
    each failure (code bug, test bug, design issue), fix, re-run the
    full suite, max 3 rounds, escalate to the user if unresolved.

14. **Task done.** When the testing agent passes and all tests pass,
    humanize the commit message with the `content-humanizer` skill,
    cite the relevant standard in the commit body, commit, and update
    task status to `done`.

## Code reviewer checks

The code reviewer (role 3) checks the **code**, not the tests:

- **Documentation**: every exported declaration has a comment citing
  its standard. Citation matches the algorithm's standard citation in
  the project's algorithm registry (if applicable).
- **Security**: no `math/rand`, no `==` on secrets, no `bytes.Equal` on
  hashes/signatures, no private key `String()`/`Format()`/`GoString()`,
  no logged secrets. Constant-time comparisons where required.
- **Architecture**: no forbidden imports. No forbidden dependency
  direction (see the project's dependency rules in `AGENTS.md`).
- **Style**: concrete structs not interfaces (unless consumer-side
  with multiple implementations). Explicit constructors. No
  reflection DI. No interface inflation.
- **Initial tests**: known-answer vectors cite their source.
  Constant-time comparisons used. Do not flag missing known-answer
  test vectors, fuzz, or examples — those come from the testing agent.

## Testing tiers

The testing agent (role 4) applies only the rules for the identified
tier, plus the universal rules.

### Universal rules (all tiers)

- Negative tests for every failure mode (wrong key, tampered input,
  expired token, wrong nonce, etc.).
- Boundary tests (empty, nil, max-size, single-byte, oversized).
- Table-driven with named subtests. Failure messages include what was
  wrong, the input, got, want (order: `got != want`).
- Test files next to source, named after the source file.
- No skipped tests. No test goes green by skipping.
- Constant-time comparison for keys, digests, ciphertexts, tokens,
  signatures. Never `==` or `bytes.Equal` on security-sensitive values.
- Parallel execution on independent subtests. Capture the test case
  in the closure when parallelizing.
- Fuzz targets for any function accepting attacker-controlled bytes
  (`NewPublicKey`, `Decrypt`, parsers, token parsers). Assert no
  panic and error-or-success only. Seed with valid inputs and
  known-bad inputs from known-answer test vectors.
- `Example` functions for the public API — executable documentation
  that fails the build if the API drifts.
- Cross-module isolation tests if the task touches module boundaries.
  A test that walks the module's source files and fails on a forbidden
  import path.

### Tier 1 — Primitives (hash, AEAD, KDF, key exchange, signatures)

- Known-answer vectors from the governing standard. Cite the vector
  source in a test comment: `// Vector: [Standard] Test 1`.
- Round-trip tests for every encrypt/decrypt, sign/verify pair.
- Known-answer test vectors if the algorithm-to-skill matrix lists
  them (primary or secondary). Download the vector JSON to
  `testdata/`, write a loader, run every case. Map `result` flags
  onto pass/fail expectations.
- Determinism tests. Same input + same key = same output. Hard equality
  for deterministic algorithms; ciphertext-differs-but-round-trips for
  randomized ones.

### Tier 2 — Compositions (envelope encryption, HPKE, key recovery)

- Full composition round-trip (HPKE: setup → seal → open → recover).
- Protocol-level known vectors from the composition's own standard,
  not just the underlying primitive vectors.
- Error propagation: corrupted wrapped key, wrong KEK, tampered
  envelope must surface a meaningful error — not a panic, not nil.
- Cross-primitive integration: verify the composition calls primitives
  in the right order with the right parameters.

### Tier 3 — Identity, proofs, attestations (DID, X.509, JWK, Merkle, VC)

- Parse/serialize round-trip. Byte-identical for canonical formats
  (JWK, X.509 DER); canonicalize-then-compare for JSON-LD (VC, DID).
- Cross-implementation vectors: parse documents produced by other
  libraries or standards (W3C VC test suite, DID spec test suite,
  relevant RFC examples).
- Canonicalization determinism: same logical document → same bytes.
- Verification negative tests: tampered proof, revoked credential,
  expired attestation, wrong issuer, wrong subject.
- Cross-reference tests: an X.509 cert signed with RSA verifies through
  the RSA wrapper. A `did:pkh` resolves through secp256k1.

### Tier 4 — Auth flows (JWT, OIDC, OAuth2, WebAuthn, SIWE, sessions)

- Full flow tests: complete lifecycle (issue → validate → refresh →
  revoke for JWT; discover → authorize → token → userinfo for OIDC).
- HTTP handler tests with a test HTTP server. No live network calls —
  mock the upstream provider.
- Negative flows: expired token, wrong issuer, wrong audience,
  replayed nonce, revoked session, `alg: none` rejection.
- Contract tests: OIDC discovery response matches the spec, OAuth2
  token response has required fields, JWT claims match the relevant
  RFC.
- Build-tag-gated provider integration that fails when the provider
  is unreachable — never silently passes.

## Review format

Reviews don't need to be novels. Find issues. If there's a problem,
say what and why. That's it.

```
MUST-FIX: sha3.go:31 — Write error discarded, use sha3.Sum256 one-shot
SHOULD-FIX: test vector length not validated
NIT: comment could be clearer
```

No preamble. No "overall this is good." Just the findings.

## Subagent prompt templates

### Primary implementer

```
You are a primary implementer for this project. Read AGENTS.md for
full conventions, documentation rules, testing rules, security
requirements, and the project's dependency rules.

Read the context packet at <path> for the task's skills, parent plan,
and spec context.
Read the task file at <path> for goal, files, symbols, constraints,
acceptance criteria, and algorithm ID.
Read the algorithm entry in the project's algorithm registry (if
applicable) for the algorithm's standard citation and primary skill.
Read the primary skill at <path>.

Implement the code:
- Documentation cites the relevant standard.
- Concrete structs. Constant-time comparisons where required.
- No math/rand. No private key String()/Format()/GoString().

Write initial tests (just enough to get green):
- Known-answer vector from the standard (cite the source in a comment:
  // Vector: [Standard] Test Vector 1).
- A round-trip test where applicable (encrypt/decrypt, sign/verify).
- Constant-time comparison for security-sensitive values in tests.

The full test suite (known-answer test vectors, fuzz, examples,
negative/boundary) is written by the testing agent after code review —
do not write it yourself.

Run verification using the project's build, vet, test, and lint
commands. All must pass.

Report what you implemented and any issues found. You have write
access — write code and test files directly.
```

### Secondary implementer

```
You are a secondary implementer for this project. Read AGENTS.md for
full conventions, documentation rules, testing rules, security
requirements, and the project's dependency rules.

Read the task file at <path>.
Read the algorithm entry in the project's algorithm registry (if
applicable) for the algorithm's standard citation and secondary skill.
Read the secondary skill at <path>.

Review the code at <file paths> through the lens of the secondary skill.
Fix issues directly — you have write access. Run verification after
fixing using the project's build, vet, test, and lint commands.

Report what you fixed and why, briefly. No preamble.
```

### Code reviewer

```
You are a code reviewer for this project. Read AGENTS.md for full
conventions, documentation rules, testing rules, security
requirements, and the project's dependency rules.

Here is the diff:

<diff>

Read the task file at <path> for acceptance criteria.
Read the project's algorithm registry (if applicable) for
documentation citation verification.

Check:
- Documentation: every exported declaration cites its standard. Citation
  matches the algorithm's standard citation field.
- Security: no math/rand, no == on secrets, no bytes.Equal on hashes,
  no private key String()/Format()/GoString(), no logged secrets.
  Constant-time comparisons where required.
- Architecture: no forbidden imports. No forbidden dependency direction.
- Style: concrete structs, explicit constructors, no reflection DI.
- Initial tests: known-answer vectors cite their source. Constant-time
  comparisons used. Do not flag missing known-answer test vectors, fuzz,
  or examples — those come from the testing agent.

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite file and line.
```

### Testing agent

```
You are a testing agent for this project. Read AGENTS.md, specifically
the Testing Rules section, for the full testing standard.

Read the source under test at <paths>.
Read the task file at <path> for acceptance criteria and the algorithm ID.
Read the project's algorithm registry (if applicable) for the algorithm's
known-answer test vector requirements.
Read the project's testing skill at <path>.
<If applicable: Read the algorithm's secondary testing skill at <path>.>

The code under test is Tier <N> (<tier name>). Apply only that tier's
rules plus the universal rules.

Write the full test suite:
- Universal: negative tests for every failure mode, boundary tests,
  table-driven with named subtests, parallel execution on independent
  cases, constant-time comparisons (no == or bytes.Equal on secrets),
  no skipped tests, test files named after source files next to source.
- Tier <N>: <list the tier-specific rules>
- Known-answer test vectors: if the algorithm registry lists them for
  this algorithm, download the vector JSON to testdata/, write a loader,
  run every case. One hand-picked vector is not coverage.
- Fuzz: targets for parser surfaces (NewPublicKey, Decrypt, parsers,
  token parsers). Assert no panic, error-or-success only.
- Examples: Example functions for the public API.
- Isolation: if this touches module boundaries, a test for forbidden
  imports.

Write test files directly — you have write access. Run verification
after writing using the project's build, vet, test, and lint commands.

Report what you wrote and any issues found. If a test fails against
the approved code, that's a code bug — report it as MUST-FIX for the
primary to address.
```

## Inputs

- The task file (for goal, files, symbols, constraints, acceptance
  criteria, algorithm ID)
- The project's algorithm registry (if applicable, for the algorithm's
  standard citation and skill mapping)
- `AGENTS.md` (project conventions, documentation rules, testing rules,
  security requirements)
- The primary skill (loaded by the primary before implementing)
- The secondary skill (loaded by the secondary implementer)
- The project's code-review skill (loaded by the code reviewer)
- The project's testing skill (loaded by the testing agent)
- The algorithm's secondary testing skill (loaded by the testing agent
  if applicable)

## Outputs

- Implemented code with documentation citations
- Initial tests (known-answer vectors, round-trip)
- Code review findings (resolved by primary)
- Full test suite (known-answer test vectors, fuzz, examples,
  negative/boundary tests)
- A committed task with a humanized message citing the standard
- Task status updated to `done`

## Constraints

- **The orchestrator never writes code, tests, or reviews.** It only
  spawns subagents, feeds them context packets, collects results, and
  decides next steps. If code needs fixing, re-spawn the implementer.
  If tests need fixing, re-spawn the testing agent. If review is needed,
  spawn the reviewer. The orchestrator is a coordinator, not a worker.
- No `math/rand`. Only `crypto/rand`.
- No `==` or `bytes.Equal` on security-sensitive values.
- No private key `String()` or `Format()` methods.
- No skipped tests. No live network calls in tests.
- Every exported declaration has documentation citing its standard.
- Secondary implementer must consult a different skill than primary.
- The testing agent is spawned only after code review passes — not
  before. Code is reviewed before the full test suite is written.
- The testing agent has write access — it writes test files directly.
  If a test fails against approved code, the code has a bug; spawn the
  primary implementer to fix it.
- Run race detection and shuffle (if supported) every time.
  Order-dependent or racy tests are MUST-FIX, not NITs.
- Commit message humanized with `content-humanizer`. Cite the standard
  in the commit body.
- The task is not `done` until all tests pass AND the testing agent
  passes. Code review passing is necessary but not sufficient.
