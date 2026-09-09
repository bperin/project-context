# Project Context

A Git-backed project context protocol for AI coding agents.

Project Context gives an existing codebase a durable, structured source of truth for **what the project is, how it is organized, what is being worked on, and how agents should operate**. It is designed to work across coding environments rather than making one IDE or agent the system of record.

## The idea

Most AI coding workflows make every new agent rediscover the project by searching the repository. That works, but it is repetitive, expensive, and inconsistent.

Project Context moves the durable understanding of the project into the repository itself:

```text
                         PROJECT CONTEXT
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
     project state            graph                 knowledge
   specs / plans / tasks   entities + edges      semantic retrieval
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ↓
                       CONTEXT COMPILER
                                ↓
                         AGENT / IDE
```

The important distinction is:

- **Project Context** answers: what is this project, where is it now, what constraints apply, and what work is in progress?
- **Graph** answers: how are project entities related?
- **RAG** answers: what additional information is semantically relevant?

RAG is a retrieval mechanism, not the project's source of truth.

## Design principles

### 1. Project state is authoritative

The durable project model lives in Git-backed `.ai/` files: identity, architecture, state, specs, plans, tasks, decisions, workflows, and skills.

### 2. Graph first, RAG second

Structured relationships should be resolved deterministically before falling back to semantic search. A vector database should be a derived index that can be rebuilt from project state.

### 3. Existing projects are first-class

Project Context can initialize directly against an existing codebase. Discovery inspects repository layout, manifests, Git state, and source symbols before creating the initial context model. Initialization is non-destructive: authored context files are preserved.

### 4. Cross-IDE

The project owns the context. Claude Code, Cursor, Gemini CLI, OpenCode, Kilo, Devin, and other tools can consume the same project model through adapters.

### 5. Human-readable and machine-usable

Markdown remains the primary authoring format. Structured graph JSON and compiled context packets make the same information consumable by tooling.

## Existing-project workflow

```text
existing repository
        ↓
project-context init
        ↓
deterministic discovery
        ↓
AST / semantic enrichment
        ↓
.ai/ project context
        ↓
graph + derived indexes
        ↓
compiled context packet
        ↓
agent / IDE
```

Discovery currently covers Git metadata, common project manifests, repository layout, and Python / TypeScript / JavaScript classes and functions. The generated graph records project, directory, file, and symbol nodes plus `contains` and `defines` relationships.

## Context model

The execution hierarchy is intentionally simple:

```text
SPEC → PLAN → TASK → IMPLEMENT → CHECK → DONE
```

But the underlying project model is a graph. Typical relationships include:

```text
SPEC       ──constrained_by──→ ADR
SPEC       ──decomposes_into─→ PLAN
PLAN       ──contains────────→ TASK
TASK       ──depends_on──────→ TASK
TASK       ──implements──────→ SPEC
TASK       ──modifies────────→ FILE / SYMBOL
TASK       ──validates_with──→ TEST
TASK       ──requires────────→ SKILL
```

## Compiled context

The CLI exposes a task-scoped machine-readable packet:

```bash
project-context context --task TASK-042
```

The packet contains project identity, architecture, current state, task context, specs, plans, decisions, graph nodes, graph edges, workflows, and skills. The goal is **minimum sufficient context**, not dumping the repository into the model context window.

To materialize the packet to disk:

```bash
project-context compile --task TASK-042
```

The result is written to `.ai/context/knowledge/compiled-context.json`.

## GraphRAG and Qdrant

Qdrant is optional and should remain a derived semantic index.

```text
Git / .ai/
    = source of truth

Graph
    = project relationships

Qdrant
    = derived semantic index

Context compiler
    = runtime view for agents
```

If Qdrant is deleted, the project should still contain all durable knowledge required to reconstruct the index.

The repository includes [`spec/01-graphrag-qdrant.md`](spec/01-graphrag-qdrant.md), `scripts/init-qdrant.py`, and a local Docker configuration for experimentation.

## CLI

Install the package locally:

```bash
npm install -g .
```

Then run:

```bash
project-context init
project-context inspect
project-context graph
project-context context --task TASK-042
project-context compile --task TASK-042
```

Use a different project-context directory when needed:

```bash
project-context init --workspace .ai-cool-project
project-context inspect --workspace .ai-cool-project
```

`init` is intended for existing codebases and does not replace application source. Existing authored context files are left untouched.

## Local development

Run the test suite:

```bash
npm test
```

The discovery suite exercises existing-project initialization, multi-manifest stack detection, Python and TypeScript symbol discovery, graph generation, task-scoped context, compilation, missing-context failures, invalid-command handling, and custom workspace names.

Start the optional local Qdrant instance:

```bash
docker compose up -d
python3 scripts/init-qdrant.py
```

## Repository layout

```text
project-context/
├── spec/                 protocol and architectural specifications
├── templates/            reusable project-context templates
├── scripts/              CLI, compiler, setup, discovery, and verification
├── .ai/                  example project-context artifacts
├── bin/                  npm CLI entrypoint
├── docker-compose.yml    local Qdrant environment
├── package.json          npm package metadata
└── AGENTS.md             development workflow for this repository
```

## Specifications

- [`spec/00-thesis.md`](spec/00-thesis.md) — project-context thesis and architecture
- [`spec/01-graphrag-qdrant.md`](spec/01-graphrag-qdrant.md) — derived GraphRAG and Qdrant design

## Status

The core local workflow is implemented: existing-project discovery, context initialization, graph generation, task-scoped context compilation, and the npm CLI are covered by automated tests.

The remaining work is primarily expanding the graph ontology, deeper language-aware dependency extraction, semantic Qdrant ingestion/retrieval, and IDE adapters.

> **Core invariant:** Project Context is the source of truth; graph and semantic indexes are derived views; agents consume compiled context rather than reconstructing the project from scratch.
