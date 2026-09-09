# SPEC-001: Project Context Compiler & Derived Qdrant GraphRAG

## Supersedes

- Supersedes: previous SPEC-001 (raw vector storage)
- Reason: Enforce strict ownership invariant where Git / `.ai/` files are authoritative project state and Qdrant is a purely derived, rebuildable semantic index.
- Superseded by: none

## Ownership Invariant

1. **Git / `.ai/` files** = Authoritative project state (specs, plans, tasks, state, ADRs).
2. **Graph** = Authoritative relationships (nodes & edges derived from files).
3. **Qdrant** = Derived semantic index (fully rebuildable from `.ai/` files at any time).
4. **Context Compiler** = Authoritative runtime view presented to agents/IDE adapters.

**Delete Qdrant, rebuild it, and zero project knowledge is lost.**

## Desired Behavior

The Context Compiler reads authoritative `.ai/` files, builds the relationship graph and structured chunks, and pushes them to Qdrant as a derived index. Agents query the compiled runtime view or search Qdrant for semantic anchor points, but all source of truth remains in version-controlled Markdown files.
