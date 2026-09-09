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

RAG is therefore a retrieval mechanism, not the project's source of truth.

## Design principles

### 1. Project state is authoritative

The durable project model lives in Git-backed `.ai/` files: identity, architecture, state, specs, plans, tasks, decisions, workflows, and skills.

### 2. Graph first, RAG second

Structured relationships should be resolved deterministically before falling back to semantic search. A vector database should be a derived index that can be rebuilt from project state.

### 3. Existing projects are first-class

Project Context is intended to initialize against codebases that already exist. Discovery can inspect repository layout, manifests, Git state, and source symbols before creating the initial context model.

### 4. Cross-IDE

The project owns the context. Claude Code, Cursor, Gemini CLI, OpenCode, Kilo, Devin, and other tools can consume the same project model through adapters.

### 5. Human-readable and machine-usable

Markdown remains the primary authoring format. Structured metadata and graph data make the same information consumable by tooling.

## Existing-project workflow

The intended workflow is:

```text
existing repository
        ↓
project-context init
        ↓
deterministic discovery
        ↓
semantic / AST enrichment
        ↓
.ai/ project context
        ↓
graph + derived indexes
        ↓
context compiled for an agent
```

Discovery should be non-destructive. Existing source files and Git history remain the source material; Project Context adds a durable control plane around them.

A future initialized project looks roughly like:

```text
.ai/
├── context/
│   ├── identity/
│   ├── architecture/
│   ├── state/
│   ├── specs/
│   ├── plans/
│   ├── tasks/
│   ├── decisions/
│   ├── workflows/
│   ├── skills/
│   └── knowledge/
├── graph/
└── adapters/
```

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

This allows agents to answer project questions through relationships rather than broad filesystem searches.

## Compiled context

The target interface is a task-scoped context packet such as:

```text
project.context(TASK-042)
```

which can resolve:

- project identity and architecture
- current project state
- the active task and its dependencies
- applicable specifications and decisions
- relevant files and symbols
- required skills and workflow
- semantic knowledge when the deterministic graph is insufficient

The goal is **minimum sufficient context**, not dumping the repository into the model context window.

## GraphRAG and Qdrant

Qdrant is optional and should remain a derived semantic index.

The intended boundary is:

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

The repository includes an initial Qdrant specification in [`spec/01-graphrag-qdrant.md`](spec/01-graphrag-qdrant.md) and a local Docker configuration for experimentation.

## Repository layout

```text
project-context/
├── spec/                 protocol and architectural specifications
├── templates/            reusable project-context templates
├── scripts/              setup, discovery, and verification scripts
├── .ai/                  example project-context artifacts
├── bin/                  CLI entrypoint
├── docker-compose.yml    local Qdrant environment
├── package.json          npm package metadata
└── AGENTS.md             development workflow for this repository
```

## CLI

The intended CLI surface is:

```bash
project-context init
project-context inspect
project-context graph
project-context context --task TASK-042
```

For an existing codebase, `init` is intended to create the project context without replacing the application itself.

> **Current implementation note:** the CLI entrypoint is present, but the repository is still under active implementation. Some command paths and discovery components are currently being wired together. Treat the specifications and tests as the source of intended behavior while the implementation converges.

## Local development

Install the package locally:

```bash
npm install -g .
```

Run the test suite:

```bash
npm test
```

Start the optional local Qdrant instance:

```bash
docker compose up -d
python3 scripts/init-qdrant.py
```

## Specifications

- [`spec/00-thesis.md`](spec/00-thesis.md) — project-context thesis and architecture
- [`spec/01-graphrag-qdrant.md`](spec/01-graphrag-qdrant.md) — structured GraphRAG and Qdrant design

## Status

This repository is an active protocol/implementation project. The architecture is being developed around one core invariant:

> **Project Context is the source of truth; graph and semantic indexes are derived views; agents consume compiled context rather than reconstructing the project from scratch.**
