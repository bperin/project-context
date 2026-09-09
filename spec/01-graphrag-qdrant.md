# SPEC-001: Structured GraphRAG with Qdrant Vector & Relational Storage

## Supersedes

- Supersedes: none
- Reason: First formal specification for structured RAG indexing.
- Superseded by: none

## What

A structured GraphRAG indexing and retrieval pipeline where Qdrant stores semantically embedded entity and relationship payloads rather than raw unorganized code dumps. Instead of ingesting entire codebases blindly into vectors, code is parsed into an entity-relationship graph (nodes for packages, modules, functions, and structs; edges for dependencies, callers, and data ownership), embedded, and stored in Qdrant with rich relational payloads.

## Why

- **Eliminates Noise:** Blindly vectorizing all files creates bloated indexes full of boilerplate and low-signal text.
- **Provides Relational Context:** GraphRAG links semantic search hits to structured subgraphs (neighbors, callers, dependencies) to give AI agents precise architectural context.
- **Production Performance:** Leverages Qdrant's sub-200ms vector search and payload filtering alongside graph traversal.

## Desired Behavior

### Ingestion & Structuring
1. Source files are parsed into semantic entities (Modules, Functions, Classes, APIs) and relationships (CALLS, DEFINES, OWNS).
2. Each entity and relationship chunk is structured with explicit metadata (repository, path, symbols, dependencies).
3. Embeddings are generated for the summarized entity descriptions and stored in Qdrant collections with indexed payloads.

### Retrieval & Querying
1. Agent queries are embedded and matched against Qdrant entity collections using top-k semantic search.
2. Retrieved entity IDs serve as anchor points to traverse connected neighborhood relations.
3. The resulting structured subgraph (the "structured context") is provided to agents instead of raw file dumps.

## Scope

### In Scope
- Schema definition for entity and relationship payloads in Qdrant.
- Integration protocol between `.ai/context/knowledge/` and Qdrant collections.
- Python reference pipeline scripts for ingestion and retrieval.

### Out of Scope
- Hosted managed Qdrant cluster provisioning (assumes local or remote Qdrant instance URL).

## Constraints

- Qdrant payloads must strictly mirror the project's directory hierarchy and schema.
- No raw unindexed file blobs allowed in vector collections.

## Success Criteria

1. Qdrant vector search successfully retrieves entity nodes with associated relationship edges.
2. Query responses return precise subgraphs rather than raw unparsed files.
