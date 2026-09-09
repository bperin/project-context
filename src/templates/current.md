# Current State

- **Active Specifications**: SPEC-001 (trust), SPEC-002 (auth), SPEC-003 (chain)
- **Active Plan**: PLAN-001 (trust core crypto primitives) — 69% complete
- **Objective**: Build three reusable Go modules consolidating duplicated auth/crypto
  primitives from ghost-protocol and trakt2. Specs split per architecture guidance:
  establish the crypto/identity pipeline first (trust), then auth, then chain.
- **Completed**: W1–W4 of PLAN-001 (TASK-001 through TASK-009, TASK-012, TASK-013).
  All primitive wrappers for hashing, CSPRNG, HKDF, X25519, AEAD, Ed25519, and
  secp256k1 are implemented, tested, and committed on `dev` (tagged v0.4.0).
- **Next Step**: W5 — TASK-014 (RSA-PSS/PKCS1v1.5) and TASK-015 (ECDSA P-256/P-384).
  These are the last two tasks in PLAN-001. After W5, run govulncheck, open PR
  from dev to master, squash-merge.
- **Deferred to PLAN-002**: Envelope encryption (AES-KW, HPKE), secp256k1 recovery,
  EVM address derivation.
- **Deferred to PLAN-003**: Identity (DID, X.509, JWK/COSE/JOSE), Merkle trees,
  verifiable credentials, attestations.
- **Roadmap (post-PLAN-001)**:
  - chain module: provider-agnostic RPC interface, wallet (uses trust secp256k1),
    ABI-to-typed-code generator (Go + TypeScript + Rust targets), EIP-712 signing
  - auth module: OIDC/OAuth2 providers, WebAuthn, SIWE, JWT, sessions
  - project-context npm package: scaffolds .ai/ directory, generates overview.csv,
    graph watcher for incremental updates

## Session boundary rule

Start a new conversation for each new spec/plan/task workstream. If context
gets too high (around 90%), compact or start a new conversation. Always update
state files before ending a session so the next conversation can pick up
cleanly. The workspace should remain fast.

## Priority Notes

The user needs two things sooner rather than later:

1. **JWT auth for other projects.** ghost-protocol and trakt2 both need JWT
   issuance/validation. This requires trust hashing (HMAC-SHA256) + RSA/ECDSA
   signing + the auth/jwt package. PLAN-001 W5 (RSA/ECDSA) is the last
   prerequisite. Auth/jwt follows after PLAN-001 closes.

2. **Envelope encryption (KEK/DEK) for trakt2.** trakt2 stores agent API keys
   that need to be encrypted at rest. This is PLAN-002 (envelope encryption).
   Depends on W3 (AEAD) and W2 (X25519/HKDF for HPKE) — both done.

3. **CI is now live.** GitHub Actions run on every push to dev/master and
   nightly. Docker image builds and pushes to GHCR on master and version tags.
   The Dockerfile builds and tests all three modules in one stage.

## Implemented Packages

| Package | Status | Algorithms |
|---------|--------|------------|
| `crypto/hash` | done, committed | SHA-256, SHA-3, Keccak-256, BLAKE3 |
| `crypto/rand` | done, committed | CSPRNG (crypto/rand wrapper) |
| `crypto/hkdf` | done, committed | HKDF-SHA256 |
| `crypto/x25519` | done, committed | X25519 ECDH |
| `crypto/aead` | done, committed | AES-256-GCM, XChaCha20-Poly1305 |
| `crypto/ed25519` | done, committed (v0.4.0) | Ed25519 sign/verify, RFC 8032 vectors, Wycheproof 151 cases |
| `crypto/secp256k1` | done, committed (v0.4.0) | secp256k1 ECDSA, RFC 6979 deterministic, EIP-2 low-s, Wycheproof 476 cases |
| `crypto/rsa` | pending (W5) | — |
| `crypto/ecdsa` | pending (W5) | — |
