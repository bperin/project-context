# EPIC-NNN Instructions

You are writing an epic. This is the highest-level artifact — a large
textual vision document. It carries the narrative, the motivation,
the context that every spec, plan, and task downstream depends on.
This is where the story lives. Be thorough — the reader should
understand the full vision, not just a summary.

## What an epic is

A ordered list of capabilities that together deliver a vision. Each
item becomes a future SPEC. The epic is the narrative document — it
explains the full picture: the problem space, the desired end state,
why each piece matters, how the pieces fit together, and what the
world looks like when it's done. It is NOT a spec — it does not
define implementation details. It defines WHAT capabilities are
needed, WHY they matter, and in WHAT order.

## How to fill each section

### Vision

Multiple paragraphs. The full narrative — the problem space, the
desired end state, the journey. What does the finished system look
like? Why does it matter? What's the story? This is the context the
planning-brain reads first. It sets the stage for everything below.
Write enough that someone who wasn't in the room can understand the
full vision.

Bad: "We want to build a crypto system with lots of features."
Good: "Today, organizations managing digital identity face a
fundamental tension: they need third-party verification of their
credentials, but handing over private keys to a verifier breaks
the zero-trust model. Trakt solves this by... [continues with the
full narrative — the problem, the approach, the architecture at a
conceptual level, the end state]"

### Items

Each item is a future SPEC. Items should be substantial — a
paragraph or more each. Cover:
- What capability this item delivers (the capability, not the
  implementation)
- Why it matters (the outcome it delivers, the problem it solves)
- What it depends on from prior items
- What it explicitly does NOT cover
- Technical constraints, risks, or open questions

Bad: "Item 1: User authentication. Users can log in."
Good: "Item 1: OIDC Authentication with WebAuthn

Organizations need to authenticate without passwords. This item
delivers an OIDC provider that issues Ed25519-signed identity tokens,
with WebAuthn (FIDO2) for passwordless registration and login.
Organizations register their Ed25519 public keys via OIDC client
registration; Trakt verifies signatures but never holds private
material.

This is the foundation — every subsequent item depends on org
identity being established first. Without it, there's no verified
signer for credentials, attestations, or cross-chain messages.

Out of scope: OAuth2 token exchange, session management, token
refresh. Those land in Item 3.

Risk: WebAuthn transport binding varies by platform (NFC, BLE, USB,
internal). The registration flow must handle all transports
gracefully. Open question: do we support multi-device
credentials per org, or one key per org?"

### Ordering

Why this order? Each item must explain what it unblocks and what
would break if the order changed. This is the dependency narrative
— write it out, don't just list numbers.

### Constraints

Hard invariants across ALL items. Technical, business, regulatory,
security. Name the standard or requirement and explain why it's a
constraint.

### Out of Scope

What this epic does NOT cover. Be explicit and thorough — this
prevents scope creep and helps the planning-brain reject items
that don't belong.

### Open Questions

Unresolved questions that may affect multiple items. These are
flags, not blockers. List them with enough context that the
planning-brain can address them when refining each item into a
spec.

## Anti-patterns

- Brief items — an epic item should be a paragraph or more, not a
  sentence
- Implementation detail — that belongs in the plan, not the epic
- Missing narrative — the vision section is the story; write it
  fully
- No out-of-scope — without it, scope creeps
- Missing dependencies — if item 3 needs item 1, explain why
