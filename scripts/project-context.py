#!/usr/bin/env python3
"""
Project Context CLI & Engine
Implements two-phase initialization for existing projects:
1. Deterministic discovery (manifests, git, directory layout, AST inspection)
2. Semantic enrichment (source: discovered, confidence: high/authoritative)
And first-class commands:
- init [--existing]
- inspect
- graph
- context [--task TASK-ID]
- compile
"""

import os
import sys
import json
import re
import subprocess
from pathlib import Path

def run_cmd(cmd):
    try:
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return res.stdout.strip()
    except Exception:
        return ""

def parse_python_ast(file_path: Path):
    """Extracts classes and functions from a Python file using simple regex/regex-AST parsing."""
    symbols = []
    try:
        content = file_path.read_text()
        for match in re.finditer(r"^\s*(def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)", content, re.MULTILINE):
            sym_type, sym_name = match.groups()
            symbols.append({"name": sym_name, "type": "function" if sym_type == "def" else "class"})
    except Exception:
        pass
    return symbols

def parse_typescript_ast(file_path: Path):
    """Extracts classes and functions from a TypeScript/JavaScript file."""
    symbols = []
    try:
        content = file_path.read_text()
        # Match class or export function/class or standard function
        for match in re.finditer(r"\b(function|class|const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)", content):
            sym_type, sym_name = match.groups()
            if sym_type in ["function", "class"]:
                symbols.append({"name": sym_name, "type": sym_type})
    except Exception:
        pass
    return symbols

def discover_project(target_dir: str = "."):
    root = Path(target_dir).resolve()
    print(f"=== PHASE 1: Deterministic Discovery ({root.name}) ===", file=sys.stderr)

    manifests = []
    for m in ["package.json", "go.mod", "pyproject.toml", "Cargo.toml", "pom.xml", "Makefile"]:
        if (root / m).exists():
            manifests.append(m)

    git_branch = run_cmd("git rev-parse --abbrev-ref HEAD")
    git_commits = run_cmd("git rev-list --count HEAD")
    
    top_dirs = [d.name for d in root.iterdir() if d.is_dir() and not d.name.startswith(".")]

    # AST Symbol Discovery
    discovered_symbols = {}
    for ext, parser in [("*.py", parse_python_ast), ("*.ts", parse_typescript_ast), ("*.js", parse_typescript_ast)]:
        for p in root.rglob(ext):
            if any(part.startswith(".") for part in p.parts):
                continue
            syms = parser(p)
            if syms:
                discovered_symbols[str(p.relative_to(root))] = syms

    discovered = {
        "project_name": root.name,
        "manifests": manifests,
        "git": {
            "branch": git_branch or "unknown",
            "commits": int(git_commits) if git_commits.isdigit() else 0
        },
        "top_directories": top_dirs,
        "symbols": discovered_symbols,
        "source": "discovered",
        "confidence": "high"
    }

    print(f"  - Detected manifests: {manifests}", file=sys.stderr)
    print(f"  - Git status: branch={discovered['git']['branch']}, commits={discovered['git']['commits']}", file=sys.stderr)
    print(f"  - Top-level directories: {top_dirs}", file=sys.stderr)
    print(f"  - Discovered AST files: {list(discovered_symbols.keys())}", file=sys.stderr)
    return discovered

def enrich_semantics(discovered: dict):
    print("\n=== PHASE 2: Semantic Enrichment & Artifact Generation ===", file=sys.stderr)
    
    stack = []
    if "go.mod" in discovered["manifests"]:
        stack.append("Go")
    if "package.json" in discovered["manifests"] or any(f.endswith((".ts", ".js")) for f in discovered["symbols"]):
        stack.append("Node.js / TypeScript")
    if "pyproject.toml" in discovered["manifests"] or any(f.endswith(".py") for f in discovered["symbols"]):
        stack.append("Python")
    if "Cargo.toml" in discovered["manifests"]:
        stack.append("Rust")

    if not stack:
        stack = ["Generic / Unknown"]

    print(f"  - Inferred Tech Stack: {stack}", file=sys.stderr)
    discovered["inferred_stack"] = stack
    discovered["confidence"] = "high"
    return discovered

def cmd_init(target_dir: str = "."):
    root = Path(target_dir).resolve()
    ai_dir = root / ".ai"
    ai_dir.mkdir(parents=True, exist_ok=True)

    for sub in [
        "context/identity",
        "context/architecture",
        "context/state",
        "context/specs",
        "context/plans",
        "context/tasks",
        "context/decisions",
        "context/workflows",
        "context/skills",
        "context/knowledge",
        "graph/nodes",
        "graph/edges",
        "adapters"
    ]:
        (ai_dir / sub).mkdir(parents=True, exist_ok=True)

    discovered = discover_project(root)
    enriched = enrich_semantics(discovered)

    identity_path = ai_dir / "context" / "identity" / "project.md"
    identity_path.write_text(f"""# Project Identity: {enriched['project_name']}

- **Source**: {enriched['source']}
- **Confidence**: {enriched['confidence']}
- **Stack**: {', '.join(enriched['inferred_stack'])}
- **Manifests**: {', '.join(enriched['manifests']) if enriched['manifests'] else 'None'}
- **Git Branch**: {enriched['git']['branch']} ({enriched['git']['commits']} commits)
""")

    state_path = ai_dir / "context" / "state" / "current.md"
    state_path.write_text("""# Current State

- **Active Specification**: None
- **Objective**: Initialized from existing codebase inspection.
- **Active Task**: None
""")

    nodes_dir = ai_dir / "graph" / "nodes"
    for d in enriched["top_directories"]:
        node_file = nodes_dir / f"{d}.json"
        node_file.write_text(json.dumps({
            "id": f"dir_{d}",
            "type": "directory",
            "path": d,
            "source": "discovered",
            "confidence": "high"
        }, indent=2))

    # Write discovered AST symbols to graph node files as child symbols
    for rel_path, syms in enriched["symbols"].items():
        sym_file = nodes_dir / f"{Path(rel_path).stem}_symbols.json"
        sym_file.write_text(json.dumps({
            "id": f"file_{Path(rel_path).name}",
            "type": "file",
            "path": rel_path,
            "symbols": syms,
            "source": "discovered",
            "confidence": "high"
        }, indent=2))

    print(f"\nSuccessfully initialized project context in {ai_dir}/")

def cmd_inspect():
    ai_dir = Path(".ai")
    if not ai_dir.exists():
        print("No .ai/ directory found. Run `project-context init` first.")
        return
    
    identity = ai_dir / "context" / "identity" / "project.md"
    if identity.exists():
        print(identity.read_text())
    else:
        print("No project identity found.")

def cmd_graph():
    nodes_dir = Path(".ai/graph/nodes")
    if not nodes_dir.exists():
        print("No graph nodes found.")
        return
    
    print("Nodes discovered:")
    for f in nodes_dir.glob("*.json"):
        data = json.loads(f.read_text())
        sym_str = f" [symbols: {len(data['symbols'])}]" if "symbols" in data else ""
        print(f"  - {data['id']} ({data['type']}): {data['path']}{sym_str} [source: {data['source']}, confidence: {data['confidence']}]")

def cmd_context(task_id: str = None):
    ai_dir = Path(".ai")
    if not ai_dir.exists():
        print(json.dumps({"error": "No .ai/ directory found."}))
        return

    packet = {
        "identity": (ai_dir / "context" / "identity" / "project.md").read_text() if (ai_dir / "context" / "identity" / "project.md").exists() else "",
        "state": (ai_dir / "context" / "state" / "current.md").read_text() if (ai_dir / "context" / "state" / "current.md").exists() else "",
        "task": task_id or "none"
    }

    print(json.dumps(packet, indent=2))

if __name__ == "__main__":
    args = sys.argv[1:]
    cmd = args[0] if args else "init"

    if cmd == "init":
        cmd_init()
    elif cmd == "inspect":
        cmd_inspect()
    elif cmd == "graph":
        cmd_graph()
    elif cmd == "context":
        task = None
        if "--task" in args:
            idx = args.index("--task")
            if idx + 1 < len(args):
                task = args[idx + 1]
        cmd_context(task)
    else:
        print(f"Unknown command: {cmd}")
        print("Usage: project-context [init|inspect|graph|context [--task TASK-ID]]")
        sys.exit(1)
