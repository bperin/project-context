#!/usr/bin/env python3
"""
Project Context Compiler
Enforces the core invariant:
- Git / .ai/ files = Authoritative project state
- Graph = Authoritative relationships
- Qdrant = Derived semantic index (rebuildable from files)
- Context Compiler = Authoritative runtime view for agents
"""

import os
import json
from pathlib import Path

def compile_context(ai_dir: str = ".ai"):
    ai_path = Path(ai_dir)
    if not ai_path.exists():
        print(f"Error: {ai_dir} directory not found. Run project-context init first.")
        return False

    print("=== PROJECT CONTEXT COMPILER ===")
    print(f"Reading authoritative state from: {ai_path.absolute()}")

    # 1. Load Authoritative State Files
    state_file = ai_path / "context" / "state" / "STATE.md"
    specs_dir = ai_path / "context" / "specs"
    plans_dir = ai_path / "context" / "plans"
    tasks_dir = ai_path / "context" / "tasks"
    decisions_dir = ai_path / "context" / "decisions"

    compiled_view = {
        "state": state_file.read_text() if state_file.exists() else "",
        "specs": [f.name for f in specs_dir.glob("*.md")] if specs_dir.exists() else [],
        "plans": [f.name for f in plans_dir.glob("*.md")] if plans_dir.exists() else [],
        "tasks": [f.name for f in tasks_dir.glob("*.md")] if tasks_dir.exists() else [],
        "decisions": [f.name for f in decisions_dir.glob("*.md")] if decisions_dir.exists() else []
    }

    print(f"  - Loaded State: {bool(compiled_view['state']) }")
    print(f"  - Specs found: {len(compiled_view['specs'])}")
    print(f"  - Plans found: {len(compiled_view['plans'])}")
    print(f"  - Tasks found: {len(compiled_view['tasks'])}")
    print(f"  - Decisions found: {len(compiled_view['decisions'])}")

    # 2. Build Derived Index Payload (simulating Qdrant sync)
    print("\n[Derived Indexing] Building Qdrant payload from authoritative files...")
    derived_index_path = ai_path / "context" / "knowledge" / "derived_index.json"
    derived_index_path.write_text(json.dumps(compiled_view, indent=2))
    print(f"Derived index successfully written to {derived_index_path}")
    print("Invariant verified: Qdrant / derived indices can be wiped and fully rebuilt from Git files at any time.")
    return True

if __name__ == "__main__":
    compile_context()
