# Go Security Expert (go-security-expert)

This skill provides rigorous guidance for writing secure, hardened Go code following standard library best practices.

---

## 📖 1. Authoritative Reference Maps

*   **Go Vulnerability Management:** [govulncheck tool](https://go.dev/doc/security/vuln/) (essential for CI scanning)
*   **OWASP Go Secure Coding Practices (Go-SCP):** [OWASP Go-SCP Project](https://github.com/OWASP/Go-SCP)
*   **Official OAuth2 Package:** [golang.org/x/oauth2](https://pkg.go.dev/golang.org/x/oauth2) (the gold standard for OAuth2 client authentication)
*   **JWT Security Standards:** [RFC 7519 (JWT Specification)](https://tools.ietf.org/html/rfc7519) and [golang-jwt/jwt/v5 library](https://pkg.go.dev/github.com/golang-jwt/jwt/v5)

---

## 🛡️ 2. Core Security Standards

### A. Authentication & Authorization (OIDC, OAuth2, & JWT)
*   **Algorithm Enforcement:** NEVER trust the `alg` header of incoming tokens. Explicitly enforce verified asymmetric algorithms like **RS256** or **ES256** during server-side verification using standard libraries (e.g., `golang-jwt`). Explicitly reject tokens with `alg: "none"`.
*   **Claim Validation:** Always validate standard claims: `exp` (expiration), `iat` (issued at), `iss` (expected issuer), and `aud` (expected audience).
*   **CSRF & OAuth2 State:** Always use cryptographically random `state` parameters during OAuth2 redirect flows to mitigate Cross-Site Request Forgery (CSRF). Always implement PKCE (Proof Key for Code Exchange) if supporting public clients (mobile/SPA).
*   **Do Not Leak Secrets:** Never log raw Authorization headers, Bearer tokens, passwords, or PII.

### B. Input Validation & Injection Prevention
*   **SQL Injection:** Always use parameterized queries via `database/sql` placeholders (e.g., `db.QueryContext(ctx, "SELECT * FROM users WHERE id = ?", userID)`). Avoid manual string concatenation or unsafe SQL query generation.
*   **Server-Side Request Forgery (SSRF):** When executing outbound HTTP requests, validate and restrict target IPs/domains. Restrict outbound requests to specific pre-defined API domains or use private VPC proxies for internal services.

### C. Cryptography & HTTP Server Hardening
*   **Entropy Sourcing:** Always use cryptographically secure random bytes from `crypto/rand` for tokens, nonces, and session IDs. Never use `math/rand`.
*   **Timing Attacks:** Use constant-time comparisons (`crypto/subtle.ConstantTimeCompare`) when comparing passwords, HMAC signatures, or authorization tokens.
*   **Timeout Enforcements:** Prevent Denial of Service (DoS) attacks (e.g., Slowloris) by setting strict, non-zero timeouts on all `http.Server` instances:
  ```go
  server := &http.Server{
      Addr:         ":8080",
      ReadTimeout:  5 * time.Second,
      WriteTimeout: 10 * time.Second,
      IdleTimeout:  120 * time.Second,
  }
  ```
