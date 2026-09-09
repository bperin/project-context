# Project Context Protocol

Robust cross-IDE multi-repository project management control plane and structured GraphRAG vector context.

## Quick Start

### 1. Install Globally via NPM
```bash
npm install -g .
# or run directly
npx project-context
```

### 2. Start Qdrant (for GraphRAG)
To spin up Qdrant locally for structured entity retrieval:
```bash
docker compose up -d
python3 scripts/init-qdrant.py
```

### 3. Run Tests
```bash
npm test
```
