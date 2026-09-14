# EPIC-NNN Instructions

You are writing an epic. This is the highest-level artifact — it feeds
every spec, plan, and task downstream. Technical precision here
prevents cascading ambiguity.

## What an epic is

A ordered list of capabilities that together deliver a vision. Each
item becomes a future SPEC. The epic is NOT a spec — it does not
define implementation. It defines WHAT capabilities are needed, WHY
they matter, and in WHAT order.

## How to fill each section

### Vision

2-3 sentences. The end state. What does the finished system look like?
Name the outcome, not the features.

Bad: "We want to build a crypto system with lots of features."
Good: "A multi-organization identity layer where orgs control their
own root keys, Trakt verifies and countersigns, and credentials
flow cross-chain via EIP-712."

### Items

Each item is a future SPEC. Be technically precise:
- Name the capability (not the implementation)
- Name the protocols, interfaces, or data structures involved
- Name the dependencies on prior items
- Name what it explicitly does NOT cover
- Name technical constraints or risks

Bad: "Item 1: User authentication. Users can log in."
Good: "Item 1: OIDC authentication with WebAuthn. Organizations
register Ed25519 keys via OIDC client registration. Login uses
WebAuthn (FIDO2) for passwordless auth. Depends on: nothing — this
is the foundation. Out of scope: OAuth2 token exchange, session
management. Risk: WebAuthn transport binding varies by platform."

### Ordering

Why this order? Each item must explain what it unblocks. If the
order changed, what would break? Name the dependency, not the
preference.

### Constraints

Hard invariants across ALL items. Technical, business, regulatory,
security. Name the standard or requirement.

### Out of Scope

What this epic does NOT cover. Be explicit — this prevents scope
creep.

### Open Questions

Unresolved questions that may affect multiple items. These are
flags, not blockers. The planning-brain addresses them when
refining each item into a spec.

## Anti-patterns

- Vague items ("improve security") — name the specific capability
- Implementation detail — that belongs in the plan, not the epic
- Prose padding — dense technical specification, not pages of words
- Missing dependencies — if item 3 needs item 1, say so
- No out-of-scope — without it, scope creeps
