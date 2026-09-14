# SPEC-NNN Instructions

You are writing a spec. This defines WHAT and WHY, not HOW. Less
textual than the epic — focused on the specific problem this spec
solves. The plan phase decides implementation. Be technically
precise — name specific protocols, interfaces, data structures. No
prose padding, but enough detail that the plan has clear boundaries.

## What a spec is

The spec defines the problem and the desired behavior for one
capability from the epic. It does NOT design the solution. A reader
should understand what to build and why, but not be constrained on
how to build it. It's more focused and less narrative than the epic
— the epic told the story, the spec defines the requirements.

## How to fill each section

### What

One to two paragraphs. What the system does at a high level. Name
the capability, the interfaces, the protocols. More focused than
the epic vision — this is about THIS spec's scope, not the whole
project.

Bad: "A system for managing users."
Good: "An OIDC provider that issues Ed25519-signed identity tokens
for organizations, with WebAuthn-based registration and
cross-chain credential verification via EIP-712. The provider
supports multi-tenant org isolation and key rotation without
token invalidation."

### Why

Bullet points. What problem does this solve? What pain does it
remove? Name the concrete outcome, not the abstract benefit.

Bad: "Improves security."
Good: "Eliminates password-based auth, reducing credential stuffing
risk. Enables org-controlled keys so Trakt never holds private
material. Allows credential portability across chains without
re-issuance."

### Requirements

Functional: what the system must DO. Each must be testable.
Non-functional: performance, security, compatibility, compliance.
Name the metric, not the aspiration.

Bad: "Must be fast."
Good: "Token verification < 1ms p99. Supports 10K concurrent
verification requests. Constant-time comparison on all signature
checks."

### Desired Behavior

Observable behavior from the user's perspective. What would a user
manual say? Not what a code doc would say. Group by feature area.

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
- Too much narrative — the epic told the story, the spec defines
  the requirements
- Missing constraints — without them, the plan has no guardrails
