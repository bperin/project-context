# PLAN-NNN Instructions

You are writing a plan. This defines HOW the system is built — the
implementation architecture. Some text for design decisions, but
mostly structure: system map, workstreams, dependencies, file
layout. The spec already defined the problem. Be technically
precise — name specific modules, interfaces, data flows, algorithms.

## What a plan is

The plan designs the implementation. It maps every spec behavior to
a workstream. It defines the architecture, the dependency order, and
the verification strategy. It does NOT write the code — that's the
task phase. Less narrative than the spec — this is engineering
design, not storytelling.

## How to fill each section

### Requirements

Copy the requirements from the source spec that this plan
implements. Each workstream below must trace to one or more of these.

### Objective

One paragraph. What this plan achieves. Name the architecture, not
the features.

### System Map

ASCII diagram of the major components and their relationships. Show
every process boundary, transport, and data flow. Not optional —
draw it. This is the most important section — the implementer reads
this to understand the whole system.

### Architecture

New packages with file structure. Key design decisions with
rationale. Name the pattern, the interface, the data structure.

Bad: "Use a service layer."
Good: "Organization repository pattern — OrganizationStore
interface in internal/store, backed by bbolt. RegisterOrg
writes to the store and emits an event on the org-created
channel."

### Communication Topology

Every inter-component communication path and its transport. Do not
assume HTTP. Consider WebSocket, gRPC, SSE, queues, Pub/Sub.

### Workstreams

Group tasks by concern. Each workstream traces to spec requirements.
For algorithm workstreams, list:
- Algorithm IDs from the project's algorithm registry
- Primary and secondary skills
- Exact test vector sources (RFC section, NIST case ID)
- Negative tests
- File paths to create/modify

Bad: "W1: Crypto stuff."
Good: "W1: Ed25519 signing. Algorithms: ed25519. Primary skill:
implementing-digital-signatures-with-ed25519. Test vectors: RFC
8032 §5.1 Test 1. Negative tests: tampered signature, wrong key.
Files: internal/sign/ed25519.go, internal/sign/ed25519_test.go."

### Dependencies

External packages to add. Existing code dependencies (read-only).
Name the import path and version.

### Completion Criteria

Observable, testable conditions that mean the plan is fully
delivered. Each verifiable by command.

### Current Focus

The single task that should be executed next, with a one-line
rationale.

## Anti-patterns

- Duplicating spec content — the spec defines what/why, don't repeat
- Vague workstreams — name the algorithms, skills, vectors, files
- No system map — draw it, always
- Too much narrative — this is engineering design, not storytelling
- Missing dependency order — workstreams must be ordered
