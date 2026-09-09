#!/usr/bin/env python3
"""Project Context CLI and discovery engine.

The project context directory is a Git-backed control plane. Discovery is
non-destructive: existing project files are inspected and context artifacts
are only created when they do not already exist.
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

MANIFESTS = (
    "package.json",
    "go.mod",
    "pyproject.toml",
    "Cargo.toml",
    "pom.xml",
    "build.gradle",
    "Makefile",
    "requirements.txt",
)
SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx"}
SKIP_DIRS = {
    ".git", ".ai", "node_modules", "venv", ".venv", "dist", "build",
    "target", "__pycache__", ".next", ".pytest_cache", ".mypy_cache",
}
VALID_COMMANDS = {"init", "inspect", "graph", "context", "compile"}


def run_cmd(args: list[str], cwd: Path) -> str:
    try:
        result = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, check=False
        )
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def git_info(root: Path) -> dict[str, Any]:
    inside = run_cmd(["git", "rev-parse", "--is-inside-work-tree"], root) == "true"
    if not inside:
        return {"is_repo": False, "branch": "unknown", "commits": 0, "remote": ""}

    count = run_cmd(["git", "rev-list", "--count", "HEAD"], root)
    return {
        "is_repo": True,
        "branch": run_cmd(["git", "branch", "--show-current"], root) or "detached",
        "commits": int(count) if count.isdigit() else 0,
        "remote": run_cmd(["git", "config", "--get", "remote.origin.url"], root),
    }


def parse_python(path: Path) -> list[dict[str, Any]]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, SyntaxError):
        return []

    symbols: list[dict[str, Any]] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append(
                {
                    "name": node.name,
                    "type": "class" if isinstance(node, ast.ClassDef) else "function",
                    "line": getattr(node, "lineno", None),
                }
            )
    return sorted(symbols, key=lambda item: (item.get("line") or 0, item["name"]))


def parse_js_ts(path: Path) -> list[dict[str, Any]]:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []

    patterns = [
        (re.compile(r"\bclass\s+([A-Za-z_$][\w$]*)"), "class"),
        (re.compile(r"\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"), "function"),
        (
            re.compile(
                r"\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\("
            ),
            "function",
        ),
    ]

    found: dict[tuple[int, str, str], dict[str, Any]] = {}
    for pattern, kind in patterns:
        for match in pattern.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            name = match.group(1)
            found[(line, name, kind)] = {"name": name, "type": kind, "line": line}
    return [found[key] for key in sorted(found)]


def discover_symbols(root: Path) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        relative = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        symbols = parse_python(path) if path.suffix == ".py" else parse_js_ts(path)
        if symbols:
            result[str(relative)] = symbols
    return result


def infer_stack(manifests: list[str], symbols: dict[str, list[dict[str, Any]]]) -> list[str]:
    stack: list[str] = []
    suffixes = {Path(path).suffix for path in symbols}
    if "go.mod" in manifests:
        stack.append("Go")
    if "package.json" in manifests or suffixes & {".ts", ".tsx", ".js", ".jsx"}:
        stack.append("Node.js / TypeScript / JavaScript")
    if "pyproject.toml" in manifests or "requirements.txt" in manifests or ".py" in suffixes:
        stack.append("Python")
    if "Cargo.toml" in manifests:
        stack.append("Rust")
    if "pom.xml" in manifests or "build.gradle" in manifests:
        stack.append("Java / JVM")
    return stack or ["Unknown"]


def discover_project(root: Path) -> dict[str, Any]:
    root = root.resolve()
    manifests = [name for name in MANIFESTS if (root / name).exists()]
    directories = sorted(
        child.name
        for child in root.iterdir()
        if child.is_dir() and child.name not in SKIP_DIRS and not child.name.startswith(".")
    )
    symbols = discover_symbols(root)
    return {
        "project_name": root.name,
        "root": str(root),
        "manifests": manifests,
        "git": git_info(root),
        "top_directories": directories,
        "symbols": symbols,
        "inferred_stack": infer_stack(manifests, symbols),
        "source": "discovered",
        "confidence": "high",
    }


def safe_write(path: Path, content: str) -> bool:
    """Create a file without overwriting authored project context."""
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def node_filename(path: str) -> str:
    return Path(path).as_posix().replace("/", "__") + ".json"


def write_initial_context(workspace: Path, discovered: dict[str, Any]) -> None:
    directories = [
        "context/identity", "context/architecture", "context/state", "context/specs",
        "context/plans", "context/tasks", "context/decisions", "context/workflows",
        "context/skills", "context/knowledge", "graph/nodes", "graph/edges", "adapters",
    ]
    for rel in directories:
        (workspace / rel).mkdir(parents=True, exist_ok=True)

    identity = (
        f"# Project Identity: {discovered['project_name']}\n\n"
        "## Purpose\n\n"
        "Initialized from an existing codebase. This file is the durable project identity "
        "and can be edited by the project owner.\n\n"
        "## Stack\n\n"
        + "\n".join(f"- {item}" for item in discovered["inferred_stack"])
        + "\n\n## Repositories\n\n"
        "| Path | Role |\n|------|------|\n| `.` | primary repository |\n\n"
        "## Discovery\n\n"
        f"- Source: `{discovered['source']}`\n"
        f"- Confidence: `{discovered['confidence']}`\n"
        f"- Manifests: {', '.join(discovered['manifests']) or 'none'}\n"
        f"- Git branch: `{discovered['git']['branch']}`\n"
        f"- Git commits: `{discovered['git']['commits']}`\n"
        f"- Git remote: `{discovered['git']['remote'] or 'none'}`\n"
    )
    safe_write(workspace / "context/identity/project.md", identity)

    layout = "\n".join(f"- `{directory}/`" for directory in discovered["top_directories"])
    architecture = (
        "# Architecture\n\n"
        "Discovery records deterministic facts. Architectural interpretation can be "
        "refined by the project owner or an agent after review.\n\n"
        "## Repository Layout\n\n"
        f"{layout}\n"
    )
    safe_write(workspace / "context/architecture/overview.md", architecture)

    state = (
        "# Current State\n\n"
        "## Active Work\n\n- None recorded.\n\n"
        "## Completed Work\n\n"
        "- **Initialization** — discovered existing repository and created Project Context.\n\n"
        "## Blocked Work\n\n- None recorded.\n\n"
        "## Known Problems\n\n- None recorded.\n\n"
        "## Repository Snapshot\n\n"
        f"- Branch: `{discovered['git']['branch']}`\n"
        f"- Commits: `{discovered['git']['commits']}`\n\n"
        "## Next Action\n\n"
        "1. Review discovered architecture and create the first SPEC/PLAN/TASK set.\n"
    )
    safe_write(workspace / "context/state/STATE.md", state)
    # Keep compatibility with earlier workspaces that used lowercase `current.md`.
    safe_write(workspace / "context/state/current.md", state)
    safe_write(workspace / "context/decisions/DECISIONS.md", "# Decisions\n\nNo decisions recorded yet.\n")

    nodes = workspace / "graph" / "nodes"
    edges: list[dict[str, str]] = []
    project_node = {
        "id": "project",
        "type": "project",
        "path": ".",
        "source": "discovered",
        "confidence": "high",
    }
    safe_write(nodes / "project.json", json.dumps(project_node, indent=2))

    for directory in discovered["top_directories"]:
        directory_id = f"dir:{directory}"
        safe_write(
            nodes / f"dir-{directory}.json",
            json.dumps(
                {
                    "id": directory_id,
                    "type": "directory",
                    "path": directory,
                    "source": "discovered",
                    "confidence": "high",
                },
                indent=2,
            ),
        )
        edges.append({"from": "project", "type": "contains", "to": directory_id})

    for rel_path, symbols in discovered["symbols"].items():
        file_id = f"file:{rel_path}"
        safe_write(
            nodes / node_filename(rel_path),
            json.dumps(
                {
                    "id": file_id,
                    "type": "file",
                    "path": rel_path,
                    "symbols": symbols,
                    "source": "discovered",
                    "confidence": "high",
                },
                indent=2,
            ),
        )
        # Preserve the original, simple artifact names for callers/tests.
        safe_write(
            nodes / f"{Path(rel_path).stem}_symbols.json",
            json.dumps(
                {
                    "id": file_id,
                    "type": "file",
                    "path": rel_path,
                    "symbols": symbols,
                    "source": "discovered",
                    "confidence": "high",
                },
                indent=2,
            ),
        )

        first_dir = Path(rel_path).parts[0] if len(Path(rel_path).parts) > 1 else None
        edges.append(
            {
                "from": f"dir:{first_dir}" if first_dir else "project",
                "type": "contains",
                "to": file_id,
            }
        )
        for symbol in symbols:
            symbol_id = f"symbol:{rel_path}#{symbol['name']}"
            safe_write(
                nodes / (Path(rel_path).as_posix().replace("/", "__") + f"#{symbol['name']}.json"),
                json.dumps(
                    {
                        "id": symbol_id,
                        "type": symbol["type"],
                        "name": symbol["name"],
                        "path": rel_path,
                        "source": "discovered",
                        "confidence": "high",
                    },
                    indent=2,
                ),
            )
            edges.append({"from": file_id, "type": "defines", "to": symbol_id})

    safe_write(workspace / "graph/edges/relationships.json", json.dumps(edges, indent=2))


def parse_task_file(path: Path, task_id: str) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    objective_lines: list[str] = []
    active = False
    for line in lines:
        if line.startswith("#") and "objective" in line.lstrip("# ").lower():
            active = True
            continue
        if active and line.startswith("#"):
            break
        if active:
            objective_lines.append(line)
    return {
        "id": task_id,
        "path": str(path),
        "content": text,
        "objective": "\n".join(objective_lines).strip(),
    }


def compile_packet(root: Path, workspace_name: str, task_id: str | None = None) -> dict[str, Any]:
    workspace = root / workspace_name
    if not workspace.exists():
        raise FileNotFoundError(
            f"No {workspace_name}/ directory found. Run `project-context init` first."
        )

    def read(rel: str) -> str:
        path = workspace / rel
        return path.read_text(encoding="utf-8") if path.exists() else ""

    packet: dict[str, Any] = {
        "version": 1,
        "workspace": workspace_name,
        "project": {
            "identity": read("context/identity/project.md"),
            "architecture": read("context/architecture/overview.md"),
            "state": read("context/state/STATE.md") or read("context/state/current.md"),
        },
        "task": task_id,
        "task_context": None,
        "specs": {},
        "plans": {},
        "decisions": {},
        "graph": {"nodes": [], "edges": []},
        "required_skills": [],
        "workflow": [],
    }

    for category, rel_dir in (
        ("specs", "context/specs"),
        ("plans", "context/plans"),
        ("decisions", "context/decisions"),
    ):
        directory = workspace / rel_dir
        if directory.exists():
            packet[category] = {
                path.stem: path.read_text(encoding="utf-8")
                for path in sorted(directory.glob("*.md"))
            }

    if task_id:
        task_path = workspace / "context" / "tasks" / f"{task_id}.md"
        packet["task_context"] = (
            parse_task_file(task_path, task_id)
            if task_path.exists()
            else {"id": task_id, "missing": True}
        )

    nodes_dir = workspace / "graph" / "nodes"
    if nodes_dir.exists():
        seen: set[str] = set()
        for path in sorted(nodes_dir.glob("*.json")):
            try:
                node = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            node_id = node.get("id")
            if node_id and node_id in seen:
                continue
            if node_id:
                seen.add(node_id)
            packet["graph"]["nodes"].append(node)

    edges_path = workspace / "graph" / "edges" / "relationships.json"
    if edges_path.exists():
        try:
            packet["graph"]["edges"] = json.loads(edges_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            packet["graph"]["edges"] = []

    skills_dir = workspace / "context/skills"
    if skills_dir.exists():
        packet["required_skills"] = [path.stem for path in sorted(skills_dir.glob("*.md"))]

    workflow_dir = workspace / "context/workflows"
    if workflow_dir.exists():
        packet["workflow"] = [path.stem for path in sorted(workflow_dir.glob("*.md"))]

    return packet


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="project-context",
        description="Git-backed project context for AI coding agents",
    )
    parser.add_argument("command", nargs="?", default="init")
    parser.add_argument("--task", help="Task ID for task-scoped context")
    parser.add_argument(
        "--workspace", default=".ai", help="Project context directory name (default: .ai)"
    )
    args = parser.parse_args()

    if args.command not in VALID_COMMANDS:
        print(f"Unknown command: {args.command}")
        print(
            "Usage: project-context [init|inspect|graph|context|compile] "
            "[--task TASK-ID] [--workspace NAME]"
        )
        return 1

    root = Path.cwd().resolve()
    try:
        if args.command == "init":
            discovered = discover_project(root)
            write_initial_context(root / args.workspace, discovered)
            discovery_path = root / args.workspace / "context/knowledge/discovery.json"
            safe_write(discovery_path, json.dumps(discovered, indent=2))
            print(f"Initialized project context: {root / args.workspace}")
            print(f"Project: {discovered['project_name']}")
            print(f"Stack: {', '.join(discovered['inferred_stack'])}")
            print(
                f"Discovered symbols: "
                f"{sum(len(items) for items in discovered['symbols'].values())}"
            )
            return 0

        if args.command == "inspect":
            packet = compile_packet(root, args.workspace)
            print(packet["project"]["identity"] or "No project identity found.")
            return 0

        if args.command == "graph":
            packet = compile_packet(root, args.workspace)
            print(f"Nodes discovered: {len(packet['graph']['nodes'])}")
            for node in packet["graph"]["nodes"]:
                extra = f" [symbols: {len(node['symbols'])}]" if "symbols" in node else ""
                label = node.get("path", node.get("name", ""))
                print(f"  - {node.get('id')} ({node.get('type')}): {label}{extra}")
            print(f"Edges: {len(packet['graph']['edges'])}")
            return 0

        packet = compile_packet(root, args.workspace, args.task)
        if args.command == "context":
            print(json.dumps(packet, indent=2))
            return 0

        output = root / args.workspace / "context/knowledge/compiled-context.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(packet, indent=2), encoding="utf-8")
        print(output)
        return 0

    except FileNotFoundError as exc:
        if args.command == "context":
            print(json.dumps({"error": str(exc)}))
        else:
            print(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
