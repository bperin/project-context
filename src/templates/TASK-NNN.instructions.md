# TASK-NNN Instructions

You are writing a task. This is almost pure engineering — granular,
code-level. The implementer reads this and writes code from it.
Ambiguity means bugs. Every field should be specific enough that
the implementer doesn't need to make design decisions. Name exact
file paths, symbol names, signatures, types, test cases. Almost no
prose — this is an engineering spec, not a document.

## What a task is

A single unit of work that one implementer can complete
independently. It defines exactly what files to touch, what symbols
to create or modify, what tests to write, and how to verify. The
implementer should not need to make design decisions — the task
already made them. This is the most granular artifact in the
hierarchy.

## How to fill each section

### Goal

One sentence. What success looks like. Name the outcome, not the
process.

Bad: "Implement the crypto module."
Good: "Ed25519 signing and verification with RFC 8032 test vectors
passing."

### Repositories

Only repositories the worker will touch or read. Not every repository
in the project.

### Relevant Files

To create: new files with one-line purpose.
To modify: existing files with what changes.

Bad: "Modify the crypto code."
Good: "internal/sign/ed25519.go — add Sign(priv, msg) and
Verify(pub, msg, sig) functions."

### Relevant Symbols

Existing: functions/classes/types the worker must understand but not
modify. Include signatures.
To create: new functions/classes with full signatures and field
types.

Bad: "Add a sign function."
Good: "func Sign(priv ed25519.PrivateKey, msg []byte) ([]byte, error)
func Verify(pub ed25519.PublicKey, msg, sig []byte) bool"

### Required Change

Numbered, concrete steps. Each unambiguous and independently
verifiable. This is the engineering checklist — the implementer
follows these steps.

Bad: "1. Implement signing."
Good: "1. internal/sign/ed25519.go: add Sign() using
crypto/ed25519.Sign(). 2. internal/sign/ed25519.go: add Verify()
using crypto/ed25519.Verify(). 3. internal/sign/ed25519_test.go:
add RFC 8032 §5.1 Test 1-4."

### Acceptance Criteria

Observable, testable conditions. Each verifiable by command.

Bad: "Signing works."
Good: "1. go test ./internal/sign/ passes. 2. RFC 8032 §5.1
Test 1-4 pass. 3. Tampered signature returns false from Verify()."

### Tests

Define the exact tests the implementer must write:
- Success cases: valid input, expected output
- Failure cases: wrong key, tampered input, expired token
- Boundary cases: empty input, max-size input, nil values

Bad: "Test the signing."
Good: "Success: Sign() with RFC 8032 Test 1 key+msg produces exact
expected signature. Failure: Verify() with tampered signature
returns false. Boundary: Verify() with empty msg returns false."

### Verification

Exact test command to run. Not a description — the actual command.

Bad: "Run the tests."
Good: "go test ./internal/sign/ -v -count=1"

### Do-Not-Touch

Files/modules the worker must not modify under any circumstance.
Name them explicitly.

## Parallelism

Maximize parallelism. Minimize dependencies between tasks. If two
tasks can run independently, do not add a dependency. The more tasks
that can run in parallel, the faster implementation goes.

## Anti-patterns

- Vague file paths — name the exact path
- Missing signatures — the implementer should not guess types
- No test cases — every task defines its own tests
- Prose — the implementer reads code, not prose
- Design decisions left open — the task decides, the implementer
  executes
