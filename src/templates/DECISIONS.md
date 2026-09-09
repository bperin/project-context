# Architectural Decisions (ADR Index)

| ID | Title | Status | Date |
|----|-------|--------|------|
| ADR-001 | Initial Project Context Setup | Accepted | 2026-09-09 |
| ADR-002 | Three-module split: auth → trust ← chain | Accepted | 2026-09-09 |
| ADR-003 | Split SPEC-001 into three specs (trust, auth, chain) | Accepted | 2026-09-09 |
| ADR-004 | Move Keccak-256 + secp256k1 address recovery into trust | Accepted | 2026-09-09 |
| ADR-005 | Keep all EIP-712 in chain, not split with trust | Accepted | 2026-09-09 |
| ADR-006 | AnchorRef (opaque) in trust, EVMAnchor verification in chain | Accepted | 2026-09-09 |
| ADR-007 | JWT supports asymmetric algorithms (RS256/ES256/EdDSA) + HS256 | Accepted | 2026-09-09 |
| ADR-008 | Attestation canonicalization with domain separation | Accepted | 2026-09-09 |
| ADR-009 | Use golang.org/x/crypto wherever possible, not stdlib equivalents | Accepted | 2026-09-09 |
| ADR-010 | Use github.com/zeebo/blake3 for BLAKE3 (no x/crypto implementation) | Accepted | 2026-09-09 |
| ADR-011 | Reject AEAD nonce tracking — random nonces only (OOM risk) | Accepted | 2026-09-09 |
| ADR-012 | X25519 redaction hashes key material with SHA-256, never exposes raw bytes | Accepted | 2026-09-09 |
| ADR-013 | HKDF Extract returns error on empty secret (matches DeriveKey validation) | Accepted | 2026-09-09 |
