# Go Systems Programmer (go-systems-programmer)

Use when building, reviewing, or refactoring Go services, CLIs, agents, workers, or HTTP APIs with explicit dependency wiring, boring main packages, standard-library-first implementation, simple core or infrastructure boundaries, consumer-side interfaces, DTO separation, and careful concurrency and performance decisions.

---

## 1. Core Principles

### A. Explicit Dependency Wiring
*   Wire dependencies in `main.go` (or a composition root). No reflection-based DI. No hidden startup behavior.
*   Constructor functions (`NewXxx`) return concrete types. Interfaces are defined on the consumer side, not the provider.
*   Keep `main` boring: parse config, construct dependencies, call `app.Run(ctx)`, handle signals.

### B. Standard Library First
*   Use the standard library wherever it saves real work. Add third-party only when it provides significant value (chi, pgx, goose, sqlc, etc.).
*   Avoid frameworks that impose lifecycle or configuration conventions.

### C. Simple Core, Infrastructure at Edges
*   Business/domain packages depend on interfaces, not concrete infrastructure.
*   Infrastructure adapters implement domain-defined interfaces.
*   Keep technology-specific DTOs (HTTP request/response, DB rows) out of business packages.
*   Separate DTOs from domain types: domain types are pure, DTOs are transport/persistence shaped.

### D. Consumer-Side Interfaces
*   Define interfaces where they are consumed, not where they are implemented.
*   Keep interfaces small and focused. Prefer multiple small interfaces over one large one.
*   Accept interfaces, return structs.

### E. Boring Main Package
*   `main.go` should be readable top-to-bottom: config → construct → run → shutdown.
*   No business logic in `main`. No domain rules. Just wiring.
*   Signal handling: `signal.NotifyContext` for graceful shutdown.

---

## 2. Concurrency

*   Use `context.Context` for cancellation and timeouts. Pass it explicitly.
*   Goroutines must have a clear exit path. Use `ctx.Done()` or a stop channel.
*   Avoid unbuffered channels unless both ends are guaranteed to be ready.
*   Use `sync.WaitGroup` for coordinated goroutine lifecycle.
*   Prefer `errgroup` for parallel work with early cancellation.
*   Never spawn goroutines without a lifetime bound.

---

## 3. Error Handling

*   Domain-level sentinel errors (`ErrNotFound`, `ErrInvalidInput`) checked with `errors.Is`.
*   Wrap with `fmt.Errorf` and `%w` at boundaries.
*   Don't over-wrap. Don't panic in request paths.
*   Return errors, don't log and return nil.

---

## 4. Logging

*   `log/slog` with structured fields.
*   Pass a logger into constructors. Each package tags with `slog.String("component", "xxx")`.
*   Never log secrets, DSNs, or tokens verbatim.
*   Use log levels correctly: `Info` for startup/state, `Warn` for recoverable issues, `Error` for failures.

---

## 5. Testing

*   Table-driven tests, `*_test.go` next to source.
*   Test public behavior, not implementation details.
*   Use `t.Setenv` for env var isolation.
*   A test may never go green by skipping. `t.Skip` on missing dependencies is forbidden in suites cited as evidence.
*   DB-backed tests are gated behind build tags and fail when unreachable.

---

## 6. HTTP

*   chi router. Handlers use shared response helpers for JSON + errors.
*   Routes registered via `RegisterRoutes(r, handler)`.
*   Set timeouts on `http.Server`: `ReadTimeout`, `WriteTimeout`, `IdleTimeout`.
*   Use `http.MaxBytesReader` to limit request body size.

---

## 7. Configuration

*   Environment variables, loaded explicitly at startup.
*   Config struct validated before use. Missing required values fail fast.
*   Never log secrets. Use masking helpers.
*   No `.env` file loading in production. Use Secret Manager or env injection.

---

## 8. Database

*   SQL lives in `.sql` files (sqlc) or parameterized queries only. No raw query strings in `.go`.
*   Never hand-edit generated code.
*   Migrations are forward-only (goose). Never edit an applied migration.
*   Use `context.Context` for all DB operations.
*   Close rows with `defer rows.Close()`.

---

## 9. Project Layout

*   `cmd/` — entry points (boring main packages).
*   `internal/` — private packages, one domain per package.
*   `internal/infra/` — infrastructure adapters.
*   `internal/<domain>/` — domain logic + handlers + repository interface.
*   `internal/<domain>/db/` or `internal/<domain>/repository/` — persistence implementation.
