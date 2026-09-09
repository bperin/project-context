# Project Context Protocol (PCP)

A robust, cross-IDE, multi-repository AI project management control plane and context compiler. PCP implements a clean, deterministic architecture designed to give AI agents (like Gemini CLI, Devin, Cursor, and Claude Code) a structured, reliable understanding of existing codebases without bloating their context windows.

---

## 🎯 The Thesis: Convergence Around Project Context

Most RAG and vector database approaches suffer from the **"AI database becomes the brain"** problem: they blindly ingest entire file dumps into vectors. This generates low-signal noise, gets stale instantly, and creates a proprietary black-box database that cannot be audited or easily rebuilt.

PCP solves this by enforcing a single, clean architectural hierarchy centered on a single primitive: **Project Context**.

```
                  PROJECT CONTEXT (Authoritative)
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
     project state     graph         knowledge
       (Markdown)     (Nodes)         (Qdrant)
          │              │              │
          │              │        Derived Index
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                  CONTEXT COMPILER
                         ↓
                AGENT / IDE ADAPTER
```

### The Ownership Invariant

1. **Git / `.ai/` Files** = Authoritative project state (specs, plans, tasks, state, ADRs).
2. **Graph** = Authoritative relationships (nodes & edges derived from files).
3. **Qdrant** = Derived semantic index (fully rebuildable from `.ai/` files at any time).
4. **Context Compiler** = Authoritative runtime view presented to agents/IDE adapters.

> **The PCP Invariant:** Delete Qdrant, run the Context Compiler, and zero project knowledge is lost.

---

## 🛠️ Infrastructure & Two-Phase Discovery

PCP supports non-destructive bootstrap of existing, legacy codebases using a **Two-Phase Initialization** engine:

```
                  project-context init
                           │
            ┌──────────────┴──────────────┐
            ↓                             ↓
  [Phase 1: Deterministic]       [Phase 2: Semantic]
  - Manifest parsing             - Tech stack inference
  - Git branch/history           - AST Symbol indexing (def/class)
  - Layout mapping               - Metadata assembly
            │                             │
            └──────────────┬──────────────┘
                           ↓
                 Authoritative .ai/ View
```

*   **Phase 1 (Deterministic Discovery):** Automatically inspects package manifests (`go.mod`, `package.json`, `pyproject.toml`, `Cargo.toml`), parses local Git history, and maps directory structures.
*   **Phase 2 (Semantic Enrichment / AST Parsing):** Recursively inspects source files (Python, TypeScript, JavaScript), parses classes and functions, and creates structured node metadata (`source: discovered`, `confidence: high`).

---

## 🚀 CLI Usage & Commands

### 1. Installation

Install globally or run directly via NPM:

```bash
npm install -g .
# Or run with npx
npx project-context <command>
```

### 2. Initialization & Bootstrapping
Initialize PCP inside an existing codebase:
```bash
project-context init
```
To configure a custom workspace folder name instead of `.ai/`:
```bash
project-context init --workspace .ai-cool-project
```

### 3. Inspecting Project Identity
Read the discovered project metadata and stack info:
```bash
project-context inspect
```

### 4. Viewing the Discovered Graph
List all discovered directory and AST symbol nodes:
```bash
project-context graph
```

### 5. Compiling Context Packets for Agents
Emit a clean, machine-parseable JSON context packet for an IDE or agent task:
```bash
project-context context --task TASK-042
```

---

## 🐋 Local Qdrant Setup (GraphRAG Fallback)

To run the optional derived Qdrant semantic index locally:

1. Start Qdrant via Docker Compose:
   ```bash
   docker compose up -d
   ```
2. Initialize structured collections:
   ```bash
   python3 scripts/init-qdrant.py
   ```

---

## 🧪 Unified Verification & Tests

To run the complete automated test suite (verifying setups, AST parsers, and custom workspaces):

```bash
npm test
```
