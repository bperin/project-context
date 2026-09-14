# SPEC-NNN Instructions

You are writing a spec. This defines WHAT and WHY, not HOW. The plan
phase decides implementation. Be technically precise — name specific
protocols, interfaces, data structures. No prose padding.

## What a spec is

The spec defines the problem and the desired behavior. It does NOT
design the solution. A reader should understand what to build and
why, but not be constrained on how to build it.

## How to fill each section

### What

One paragraph. What the system does at a high level. Name the
capability, the interfaces, the protocols.

Bad: "A system for managing users."
Good: "An OIDC provider that issues Ed25519-signed identity tokens
for organizations, with WebAuthn-based registration and
cross-chain credential verification via EIP-712."

### Why

Bullet points. What problem does this solve? What pain does it
remove? Name the concrete outcome, not the abstract benefit.

Bad: "Improves security."
Good: "Eliminates password-based auth, reducing credential stuffing
risk. Enables org-controlled keys so Trakt never holds private
material."

### Requirements

Functional: what the system must DO. Each must be testable.
Non-functional: performance, security, compatibility, compliance.

Bad: "Must be fast."
Good: "Token verification < 1ms p99. Supports 10K concurrent
verification requests. Constant-time comparison on all signature
checks."

### Desired Behavior

Observable behavior from the user's perspective. What would a user
manual say? Not what a code doc would say.

### Scope

In scope: what this spec covers. Out of scope: what it does NOT.
Be explicit — out of scope prevents scope creep.

### Constraints

Hard, non-negotiable invariants. Name the standard or requirement.

Bad: "Must be secure."
Good: "All signatures use Ed25519 (RFC 8032). Nonce generation via
crypto/rand. Constant-time comparison via crypto/subtle."

### Success Criteria

Observable, testable conditions. Each verifiable by command or
action.

Bad: "Works correctly."
Good: "go test ./... passes. NIST test vectors pass. Token
verification < 1ms p99 under 10K concurrent load."

### Acceptance Criteria

Concrete, verifiable conditions. Each maps to a requirement and is
objectively checkable (command, grep, test).

### Security Considerations

Only if this spec touches crypto, auth, or security primitives.
List algorithms by registry ID, required skills, attack surfaces.

## Anti-patterns

- Implementation detail — that belongs in the plan
- Vague requirements — each must be testable
- No out-of-scope — without it, scope creeps
- Prose padding — dense technical specification, not pages of words
- Missing constraints — without them, the plan has no guardrails
