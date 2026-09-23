# Workflow: Task creation

## Owner

The root coordinator owns task decomposition. It writes task records from the
approved spec and plan; it does not transfer dependent reasoning to a fresh
planning subagent.

## Steps

1. Read the approved spec, plan, repository instructions, and current worktree.
2. Use `grill-me` to interrogate the plan. Use `adhd` only when the dependency
   graph or architecture is genuinely open-ended.
3. Split work at exclusive file/symbol boundaries. Each task names files,
   API/data boundaries, success/failure/boundary tests, verification commands,
   do-not-touch paths, dependencies, and an implementation runtime.
4. Register every task in topological order with `project-context add`; edit
   the generated records with the precise task contract. The CLI is the only
   writer of JSONL history.
5. Set implementation tasks to `gpt-5.6-luna` with reasoning effort `high`.
   A bounded reviewer challenges a completed diff; reviewers never write the
   plan or task decomposition.
6. Run `project-context ready` and dispatch only dependency-ready tasks with
   disjoint write sets. The root coordinator owns status changes and integration.

## Delegation rule

Delegate only a question that can be answered independently and returned as
evidence: for example, an API surface inventory, accessibility audit, or a
review of a completed diff. Keep short or dependent steps in the root session.

## Output

- Task markdown with explicit acceptance criteria and runtime.
- Append-only JSONL/task timeline created through the CLI.
- A dependency-ordered implementation wave.
