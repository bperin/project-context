# AGENTS.md — project-context

> **Read MASTER_PROMPT.md first.** It is the full spec for the Node
> rewrite. This file is a quick reference only. If MASTER_PROMPT.md and
> this file conflict, MASTER_PROMPT.md wins.

## What this project is

An npm package that scaffolds a `.ai/` directory into any project.
The `.ai/` directory is a project management system for AI agents —
workflows, templates, specs, plans, tasks, state tracking, and
decisions. It gives any AI agent (Devin, Cursor, Claude Code, Gemini)
the context it needs to work on a project without searching the whole
repo.

## Current state

This project is being rewritten from Python/Bash to Node. The Python
scripts in `scripts/` are dead — do not modify them. The Node rewrite
is in `bin/` and `src/`.

## What's been done

- `MASTER_PROMPT.md` — full spec for the rewrite
- `bin/cli.js` — CLI entry point using commander, dispatches to 4 commands
- `src/commands/init.js` — scaffolds the `.ai/` directory (implemented)
- `src/commands/inspect.js` — reads state (stub, needs implementation)
- `src/commands/graph.js` — builds graph nodes/edges (stub, needs implementation)
- `src/commands/overview.js` — generates CSV from markdown (stub, needs implementation)
- `src/templates/` — canonical templates copied from the trust reference
- `src/workflows/` — canonical workflows copied from the trust reference

## What needs doing

1. **Implement `inspect.js`** — read all spec/plan/task files in
   `.ai/`, parse their `## Status` sections, print a summary table.
2. **Implement `overview.js`** — read all spec/plan/task files, parse
   `## Status` sections, emit CSV to `.ai/context/state/overview.csv`.
   Columns: Type, ID, Title, Status, Progress, Dependencies, Notes.
3. **Implement `graph.js`** — walk source files in the target project,
   detect imports/exports, write JSON nodes to `.ai/graph/nodes/` and
   edges to `.ai/graph/edges/`.
4. **Complete `init.js`** — the `writeAgentsMd` function is a stub.
   Copy the full AGENTS.md protocol from
   `/Users/brian/code/trust/.ai-trust/AGENTS.md`.
5. **Add `--discover` flag to init** — inspect the target project's
   manifests (go.mod, package.json, Cargo.toml), infer the stack,
   populate `.ai/context/identity/project.md` and graph nodes.
6. **Write tests** — `npm test` should scaffold into `/tmp/test-pc`,
   run overview, and verify the CSV output.
7. **Delete the Python scripts** — `scripts/*.py` and
   `scripts/*.sh` are dead. Remove them once the Node CLI works.

## Reference implementation

The trust project at `/Users/brian/code/trust` has a `.ai-trust/`
directory that is the canonical reference. Every file in it is what
`init` should produce. Read these files:

1. `/Users/brian/code/trust/.ai-trust/AGENTS.md` — the protocol
2. `/Users/brian/code/trust/.ai-trust/STATE.md` — state format
3. `/Users/brian/code/trust/.ai-trust/templates/*.md` — all templates
4. `/Users/brian/code/trust/.ai-trust/context/workflows/*.md` — all workflows
5. `/Users/brian/code/trust/.ai-trust/context/state/overview.csv` — CSV format
6. `/Users/brian/code/trust/.ai-trust/context/state/current.md` — state format

The templates and workflows are already copied into `src/templates/`
and `src/workflows/`. Do not modify them — they are the canonical
versions. If they need updating, update them in the trust project and
re-copy.

## Commands

```
npx project-context init [--workspace .ai] [--target .] [--discover]
npx project-context inspect [--workspace .ai] [--target .]
npx project-context graph [--workspace .ai] [--target .]
npx project-context overview [--workspace .ai] [--target .]
```

## Conventions

- **No Python.** The Python scripts are dead. Node only.
- **No bash for core logic.** Bash is fine for CI, not for the tool.
- **Templates are the source of truth.** `src/templates/` and
  `src/workflows/` are canonical. Don't modify them in place.
- **The tool does not carry project-specific content.** It carries
  the framework. Target projects create their own specs/plans/tasks.
- **overview.csv is generated, not maintained.** The `overview`
  command reads markdown and emits CSV. Markdown is source of truth.

## Lifecycle states (for reference)

The templates use these state machines:

- **Spec**: `draft → review → committed → done → superseded`
- **Plan**: `draft → review → committed → in_progress → done → superseded`
- **Task**: `draft → review → committed → implementing → code-review → testing → done → superseded`

Plans and specs show progress as a percentage of children done.
