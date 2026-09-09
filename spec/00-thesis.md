# Project Context Protocol

## Problem

AI coding agents (Claude Code, Cursor, Windsurf, Gemini CLI, Qwen Code, Devin,
OpenCode, Kilo) each reconstruct project understanding by searching files at
the start of every session. This is slow, inconsistent, and lossy — the agent
doesn't know what the project is, where it is, what it's allowed to change,
or what constraints apply until it has read half the codebase.

Existing solutions address fragments of this:

- **GAPS** provides a PLAN.md + task briefs for plan-and-task discipline.
- **ghost-protocol / trakt2 / landman** use a SPEC → PLAN → TASK hierarchy
  with templates, AGENTS.md, DECISIONS.md, and STATE.md in a `.ai-workspace/`
  control plane.
- **setup-kilo-project-interactive.sh** bootstraps that structure interactively.

None of them formalize the full project context as a machine-readable model
that any agent can consume. They solve planning discipline, not context
compilation.

## Thesis

**Don't build a better RAG system for coding agents. Build a project context
system, and make RAG one of its backends.**

Project Context ≠ RAG:

- **RAG** answers: "Find me information related to X."
- **Project Context** answers: "What is this project, where is it now, what am
  I allowed to change, what am I working on, and what constraints apply?"

An agent should call `project.context(task_id)` and receive a compiled context
packet: identity, architecture, current state, task, constraints, dependencies,
decisions, relevant files, required skills, and workflow. The context compiler
traverses a graph of relationships (task → spec → decision → files → tests)
deterministically. RAG (Qdrant, vector search) is a fallback for unknowns the
graph can't resolve.

## Architecture

```
             PROJECT CONTEXT
                    │
             ┌──────┴──────┐
             │             │
         GRAPH STATE     FILE STATE
             │             │
             └──────┬──────┘
                    ↓
             CONTEXT COMPILER
                    │
             ┌──────┴──────┐
             │             │
          deterministic   Qdrant
             │          (fallback)
             └──────┬──────┘
                    ↓
                  AGENT
```

## Context hierarchy

```
PROJECT CONTEXT
│
├── Identity          — name, purpose, stack, repo
├── Architecture      — domains, services, boundaries, dependencies
├── Current State     — active work, completed work, blocked work, known problems
├── Specs             — requirements / invariants
├── Plans             — implementation sequences
├── Tasks             — dependencies, status, affected code
├── Decisions         — ADRs / why things are the way they are
├── Workflows         — how agents are expected to operate
├── Skills            — capabilities agents can invoke
└── Knowledge         — semantic / historical information
                         ↓
                       Qdrant
```

## Graph traversal

Instead of searching "where is the authentication stuff?", the context
compiler traverses:

```
TASK-042
   │
   ├── implements → SPEC-012
   │                    │
   │                    └── constrained_by → ADR-007
   │
   ├── depends_on → TASK-039
   │
   ├── modifies → auth/domain
   │                    │
   │                    ├── files
   │                    ├── tests
   │                    └── interfaces
   │
   └── requires → security-review skill
```

Only if something is still unknown does it hit semantic search / Qdrant.

## Compiled context packet

An agent receives:

```yaml
project:
  name: foo
  objective: ...

architecture:
  domains: [...]
  stack: [...]
  boundaries: [...]

current_state:
  branch: ...
  active_plan: ...
  active_task: ...

task:
  id: TASK-042
  objective: ...
  status: in_progress

constraints:
  - ...

dependencies:
  - TASK-039
  - SPEC-012

decisions:
  - ADR-007

relevant_files:
  - ...

required_skills:
  - implementation
  - testing

workflow:
  - load_context
  - inspect_dependencies
  - implement
  - test
  - record_evidence
  - update_state
```

## Cross-IDE compatibility

The IDE doesn't own the project intelligence. The project carries its own
memory and operating rules with the repo.

```
.ai/
   context/
       identity/
       architecture/
       state/
       specs/
       plans/
       tasks/
       decisions/
       workflows/
       skills/
       knowledge/
   graph/
   adapters/
       claude/
       cursor/
       gemini/
       qwen/
       devin/
       opencode/
       kilo/
```

Each IDE gets a thin adapter that reads the same context and translates it
to that IDE's configuration format (`.cursor/rules/`, `.devin/config.json`,
`CLAUDE.md`, `GEMINI.md`, etc.).

## What this project provides

1. **`scripts/setup-project-context.sh`** — interactive bootstrap script that
   creates the `.ai/` directory structure in any project.
2. **`templates/`** — blank reusable templates for every context type:
   - Identity, Architecture, State
   - SPEC, PLAN, TASK (from the ghost-protocol/trakt2 pattern)
   - ADR, Workflow, Skill
3. **Graph schema** — the relationship model between context nodes.
4. **Adapter specs** — how each IDE reads the context.
5. **Context compiler spec** — how to compile a context packet from graph +
   file state + Qdrant fallback.

## Design principles

1. **The project carries its own context.** No external service required.
2. **Graph-first, RAG-fallback.** Deterministic traversal before semantic search.
3. **IDE-agnostic.** One source of truth, thin adapters per IDE.
4. **Templates, not magic.** Files are markdown. No proprietary format.
5. **Durable.** Context survives session boundaries. Conversation history is
   not project memory.
6. **Hierarchical.** SPEC → PLAN → TASK. Identity → Architecture → State.
7. **Composable.** Use the full hierarchy or just GAPS-style PLAN + tasks.
