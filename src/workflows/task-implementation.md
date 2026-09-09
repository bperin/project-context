# Workflow: Task

## When

When a task moves from `todo` to `in_progress`. This is the full task
execution pipeline — from implementation through testing to done.

## Pipeline

Four roles move down the line like an assembly line:

```
Primary implements TASK-N (code + initial tests)
    → Secondary reviews + fixes TASK-N (foreground, write access, different skill lens)
        → Code reviewer reviews TASK-N (background, no context, go-code-review skill)
Primary moves to TASK-N+1 while code review runs
If code review calls back → go back, fix
When code review passes → Testing agent writes full test suite (background, write access, golang-testing skill)
If testing agent calls back → go back, fix
When all tests pass → commit → task done
```

## Roles

### Role 1: Primary implementer (you)

- Has full conversation context.
- Consults the algorithm's **primary skill** from `algorithms.json`.
- Implements code + initial tests (just enough to get green: known-answer
  vectors and a round-trip where applicable). The full test suite is
  written by the testing agent after code review.
- Runs verification: `go build && go vet && go test -race && gofmt -l .`
- Spawns the secondary implementer, then the code reviewer, then the
  testing agent. Moves to the next task while background agents work.
- If any agent calls back with findings, goes back and fixes.

### Role 2: Secondary implementer (subagent, write access)

- **No conversation context** — sees only the task file, code, and the
  algorithm's **secondary skill** from `algorithms.json`.
- Reviews through a different lens than the primary (different skill).
- **Has write access — fixes issues directly, doesn't just report.**
- Says what they fixed and why, briefly.
- Runs verification after fixing.

### Role 3: Code reviewer (subagent, background, read-only)

- **No conversation context** — sees only `AGENTS.md`,
  `algorithms.json`, the task file, and the diff.
- Loads the `go-code-review` skill.
- Judges the **code** against project rules (Godoc, security,
  architecture, style). Does not review tests — the full test suite
  hasn't been written yet.
- Reports findings as MUST-FIX / SHOULD-FIX / NIT. Does not fix — the
  primary fixes.
- Runs in background while primary works on the next task.

### Role 4: Testing agent (subagent, background, write access)

- **No conversation context** — sees only the source files under test,
  the task file, `AGENTS.md` (testing rules), `algorithms.json`, and
  the `golang-testing` skill.
- Loads the `golang-testing` skill (on-demand) before writing tests.
- Loads the algorithm's secondary skill if it is testing-focused
  (e.g. `wycheproof`).
- Writes the full test suite: known vectors, Wycheproof, fuzz targets,
  examples, negative tests, boundary tests — per the tier rules in
  `AGENTS.md`.
- **Has write access — writes test files directly.**
- Runs verification after writing: `go test -race -count=1 -shuffle=on`.
- Reports what was written and any issues found (e.g. code that fails
  a test, suggesting a code bug the reviewer missed).
- Runs in background while primary works on the next task.

## Steps

1. **Read the task file.** Note goal, files, symbols, constraints,
   acceptance criteria.

2. **Load the primary skill.** Read its guidance. Do not guess at crypto
   or auth — follow the skill.

3. **Read the algorithm entry in `algorithms.json`** for `godoc_citation`
   and skill mapping.

4. **Implement the code.** Godoc cites the standard. Concrete structs.
   Constant-time comparisons. No `math/rand`. No private key
   `String()`/`Format()`/`GoString()`.

5. **Write initial tests.** Just enough to get green:
   - Known-answer vector from the standard (cite the source in a
     comment: `// Vector: [RFC 8032] Test Vector 1`).
   - A round-trip test where applicable (encrypt/decrypt, sign/verify).
   - Use `crypto/subtle.ConstantTimeCompare` for security-sensitive
     comparisons in tests.
   The full test suite (Wycheproof, fuzz, examples, negative/boundary)
   is written by the testing agent after code review.

6. **Run verification.**
   ```
   go build ./...
   go vet ./...
   go test -race ./...
   gofmt -l .        # must output nothing
   ```
   All must pass.

7. **Spawn the secondary implementer** (foreground, `subagent_general`
   profile for write access). Give it: task file, algorithm ID,
   secondary skill path, files to review. It fixes issues directly and
   reports what it changed.

8. **Reconcile.** If the secondary found and fixed things, verify the
   fixes are correct. If it flags something it can't fix, fix it
   yourself. Re-run verification if changes were made.

9. **Spawn the code reviewer** (background, `subagent_explore`
   profile). Give it: `AGENTS.md`, `algorithms.json`, task file, diff.
   It checks the code against project rules (see Code reviewer checks
   below).

10. **Move to the next task.** If the code reviewer calls back with
    findings, go back and fix.

11. **When code review passes → spawn the testing agent** (background,
    `subagent_general` profile for write access). Give it:
    - The source file path(s) under test
    - The task file path (for acceptance criteria and algorithm ID)
    - `AGENTS.md` path (testing rules section)
    - `trust/algorithms.json` path (for Wycheproof requirement)
    - The `golang-testing` skill path
    - The algorithm's secondary skill path if testing-focused (e.g.
      `wycheproof`)
    - The identified tier (so the testing agent applies the right
      rules — see Testing tiers below)
    The testing agent writes the full test suite and runs verification.

12. **Reconcile testing agent output.** If the testing agent reports a
    code bug (a test fails against the approved code), go back and fix
    the code — the code review missed it. If it reports test design
    questions, answer them. Re-run verification after any changes.

13. **Task done.** When the testing agent passes and all tests pass
    (`go test -race -count=1 -shuffle=on ./...`), humanize the commit
    message with the `content-humanizer` skill, cite the standard in
    the commit body, commit, and update task status to `done`.

## Code reviewer checks

The code reviewer (role 3) checks the **code**, not the tests:

- **Godoc**: every exported declaration has a comment citing its
  standard. Citation matches `godoc_citation` in `algorithms.json`.
- **Security**: no `math/rand`, no `==` on secrets, no `bytes.Equal` on
  hashes/signatures, no private key `String()`/`Format()`/`GoString()`,
  no logged secrets. Constant-time comparisons where required.
- **Architecture**: no `auth` or `chain` imports in `trust`. No
  forbidden dependency direction.
- **Style**: concrete structs not interfaces (unless consumer-side
  with multiple implementations). Explicit constructors. No
  reflection DI. No interface inflation.
- **Initial tests**: known-answer vectors cite their source.
  Constant-time comparisons used. Do not flag missing Wycheproof, fuzz,
  or examples — those come from the testing agent.

## Testing tiers

The testing agent (role 4) applies only the rules for the identified
tier, plus the universal rules.

### Universal rules (all tiers)

- Negative tests for every failure mode (wrong key, tampered input,
  expired token, wrong nonce, etc.).
- Boundary tests (empty, nil, max-size, single-byte, oversized).
- Table-driven with named subtests. Failure messages include what was
  wrong, the input, got, want (order: `got != want`).
- Test files next to source (`*_test.go`), named after the source file.
- No `t.Skip`. No test goes green by skipping.
- Constant-time comparison (`crypto/subtle.ConstantTimeCompare`) for
  keys, digests, ciphertexts, tokens, signatures. Never `==` or
  `bytes.Equal` on security-sensitive values.
- `t.Parallel()` on independent subtests. Capture `tc := tc` in the
  closure when parallelizing.
- Fuzz targets (`FuzzXxx`) for any function accepting attacker-controlled
  bytes (`NewPublicKey`, `Decrypt`, `ParseJWK`, token parsers). Assert
  no panic and error-or-success only. Seed with valid inputs and
  known-bad inputs from Wycheproof.
- `Example` functions for the public API (`ExampleGenerateKey`,
  `ExampleEncryptRoundTrip`, `ExampleSignVerify`) — executable
  documentation that fails the build if the API drifts.
- Cross-module isolation tests if the task touches module boundaries.
  A `TestNoForbiddenImports` that walks the module's `.go` files and
  fails on a forbidden import path.

### Tier 1 — Primitives (hash, AEAD, KDF, key exchange, signatures)

- Known-answer vectors from the governing standard. Cite the vector
  source in a test comment: `// Vector: [RFC 8032] Test 1`.
- Round-trip tests for every encrypt/decrypt, sign/verify pair.
- Wycheproof if the algorithm-to-skill matrix lists it (primary or
  secondary). Download the vector JSON to `testdata/`, write a loader,
  run every case. Map `result` flags onto pass/fail expectations.
- Determinism tests. Same input + same key = same output. Hard equality
  for deterministic algorithms; ciphertext-differs-but-round-trips for
  randomized ones.

### Tier 2 — Compositions (envelope encryption, HPKE, key recovery)

- Full composition round-trip (HPKE: setup → seal → open → recover).
- Protocol-level known vectors from the composition's own RFC, not
  just the underlying primitive vectors.
- Error propagation: corrupted wrapped key, wrong KEK, tampered
  envelope must surface a meaningful error — not a panic, not nil.
- Cross-primitive integration: verify the composition calls primitives
  in the right order with the right parameters.

### Tier 3 — Identity, proofs, attestations (DID, X.509, JWK, Merkle, VC)

- Parse/serialize round-trip. Byte-identical for canonical formats
  (JWK, X.509 DER); canonicalize-then-compare for JSON-LD (VC, DID).
- Cross-implementation vectors: parse documents produced by other
  libraries or standards (W3C VC test suite, DID spec test suite,
  RFC 7517 JWK examples).
- Canonicalization determinism: same logical document → same bytes.
- Verification negative tests: tampered proof, revoked credential,
  expired attestation, wrong issuer, wrong subject.
- Cross-reference tests: an X.509 cert signed with RSA verifies through
  the RSA wrapper. A `did:pkh` resolves through secp256k1.

### Tier 4 — Auth flows (JWT, OIDC, OAuth2, WebAuthn, SIWE, sessions)

- Full flow tests: complete lifecycle (issue → validate → refresh →
  revoke for JWT; discover → authorize → token → userinfo for OIDC).
- HTTP handler tests with `httptest`. No live network calls — mock
  the upstream provider.
- Negative flows: expired token, wrong issuer, wrong audience,
  replayed nonce, revoked session, `alg: none` rejection.
- Contract tests: OIDC discovery response matches the spec, OAuth2
  token response has required fields, JWT claims match RFC 7519.
- Build-tag-gated provider integration (`//go:build integration`)
  that fails when the provider is unreachable — never silently passes.

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

### Secondary implementer

```
You are a secondary implementer for the trust platform — a reusable Go
auth and crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core and must never import
auth or chain.

Read the task file at <path>.
Read the algorithm entry in trust/algorithms.json for the godoc_citation
and secondary skill.
Read the secondary skill at <path>.

Review the code at <file paths> through the lens of the secondary skill.
Fix issues directly — you have write access. Run verification after
fixing:
  go build ./... && go vet ./... && go test -race ./... && gofmt -l .

Report what you fixed and why, briefly. No preamble.
```

### Code reviewer

```
You are a code reviewer for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core and must never import
auth or chain. Read AGENTS.md for full conventions, Godoc rules, testing
rules, and security requirements.

Here is the diff:

<diff>

Read the task file at <path> for acceptance criteria.
Read trust/algorithms.json for Godoc citation verification.

Check:
- Godoc: every exported declaration cites its standard. Citation matches
  algorithms.json godoc_citation field.
- Security: no math/rand, no == on secrets, no bytes.Equal on hashes,
  no private key String()/Format()/GoString(), no logged secrets.
  Constant-time comparisons where required.
- Architecture: no auth or chain imports in trust. No forbidden deps.
- Style: concrete structs, explicit constructors, no reflection DI.
- Initial tests: known-answer vectors cite their source. Constant-time
  comparisons used. Do not flag missing Wycheproof, fuzz, or examples —
  those come from the testing agent.

Return findings as MUST-FIX, SHOULD-FIX, NIT. Cite file and line.
```

### Testing agent

```
You are a testing agent for the trust platform — a reusable Go auth and
crypto platform with three modules (trust, auth, chain) where
auth → trust ← chain. Trust is the crypto core and must never import
auth or chain. Read AGENTS.md, specifically the Testing Rules section,
for the full testing standard.

Read the source under test at <paths>.
Read the task file at <path> for acceptance criteria and the algorithm ID.
Read trust/algorithms.json for the algorithm's Wycheproof requirement.
Read the golang-testing skill at <path>.
<If wycheproof: Read the wycheproof skill at <path>.>

The code under test is Tier <N> (<tier name>). Apply only that tier's
rules plus the universal rules.

Write the full test suite:
- Universal: negative tests for every failure mode, boundary tests,
  table-driven with named subtests, t.Parallel() on independent cases,
  constant-time comparisons (no == or bytes.Equal on secrets), no
  t.Skip, test files named after source files next to source.
- Tier <N>: <list the tier-specific rules>
- Wycheproof: if algorithms.json lists wycheproof for this algorithm,
  download the vector JSON to testdata/, write a loader, run every case.
  One hand-picked vector is not Wycheproof coverage.
- Fuzz: FuzzXxx targets for parser surfaces (NewPublicKey, Decrypt,
  ParseJWK, token parsers). Assert no panic, error-or-success only.
- Examples: ExampleXxx functions for the public API.
- Isolation: if this touches module boundaries, TestNoForbiddenImports.

Write test files directly — you have write access. Run verification
after writing:
  go build ./... && go vet ./... && go test -race -count=1 -shuffle=on ./...
  gofmt -l .

Report what you wrote and any issues found. If a test fails against
the approved code, that's a code bug — report it as MUST-FIX for the
primary to address.
```

## Inputs

- The task file (for goal, files, symbols, constraints, acceptance
  criteria, algorithm ID)
- `trust/algorithms.json` (for `godoc_citation` and skill mapping)
- `AGENTS.md` (project conventions, Godoc rules, testing rules,
  security requirements)
- The primary skill (loaded by the primary before implementing)
- The secondary skill (loaded by the secondary implementer)
- The `go-code-review` skill (loaded by the code reviewer)
- The `golang-testing` skill (loaded by the testing agent)
- The `wycheproof` skill (loaded by the testing agent if applicable)

## Outputs

- Implemented code with Godoc citations
- Initial tests (known-answer vectors, round-trip)
- Code review findings (resolved by primary)
- Full test suite (Wycheproof, fuzz, examples, negative/boundary tests)
- A committed task with a humanized message citing the standard
- Task status updated to `done`

## Constraints

- No `math/rand`. Only `crypto/rand`.
- No `==` or `bytes.Equal` on security-sensitive values.
- No private key `String()` or `Format()` methods.
- No skipped tests. No live network calls in tests.
- Every exported declaration has Godoc citing its standard.
- Secondary implementer must consult a different skill than primary.
- The testing agent is spawned only after code review passes — not
  before. Code is reviewed before the full test suite is written.
- The testing agent has write access — it writes test files directly.
  If a test fails against approved code, the code has a bug; the
  primary fixes it.
- Run `-race` and `-shuffle=on` every time. Order-dependent or racy
  tests are MUST-FIX, not NITs.
- Commit message humanized with `content-humanizer`. Cite the standard
  in the commit body.
- The task is not `done` until all tests pass AND the testing agent
  passes. Code review passing is necessary but not sufficient.
