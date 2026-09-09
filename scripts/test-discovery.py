#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile


def run_cli(cli_script, cwd, *args):
    return subprocess.run(
        ["python3", cli_script, *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def test_discovery():
    print("==============================================")
    print(" Testing Two-Phase Discovery & CLI Commands")
    print("==============================================")

    with tempfile.TemporaryDirectory() as tmpdir:
        # Mock an existing multi-language project.
        proj = os.path.join(tmpdir, "mock-repo")
        os.makedirs(os.path.join(proj, "src"))
        os.makedirs(os.path.join(proj, "internal"))

        with open(os.path.join(proj, "go.mod"), "w", encoding="utf-8") as f:
            f.write("module example.com/mock\ngo 1.22\n")
        with open(os.path.join(proj, "package.json"), "w", encoding="utf-8") as f:
            f.write('{"name":"mock-js"}\n')
        with open(os.path.join(proj, "README.md"), "w", encoding="utf-8") as f:
            f.write("# Mock Repo\n")
        with open(os.path.join(proj, "src", "service.py"), "w", encoding="utf-8") as f:
            f.write(
                "class UserService:\n"
                "    def get_user():\n"
                "        pass\n\n"
                "def main_runner():\n"
                "    pass\n"
            )
        with open(os.path.join(proj, "src", "index.ts"), "w", encoding="utf-8") as f:
            f.write("class ApiClient {}\nfunction initialize() {}\n")

        # Git metadata is part of deterministic discovery.
        subprocess.run(["git", "init"], cwd=proj, capture_output=True, check=False)
        subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=proj, capture_output=True, check=False)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=proj, capture_output=True, check=False)
        subprocess.run(["git", "add", "."], cwd=proj, capture_output=True, check=False)
        subprocess.run(["git", "commit", "-m", "init"], cwd=proj, capture_output=True, check=False)

        cli_script = os.path.abspath("./scripts/project-context.py")

        # 1. Existing-project init must be non-destructive and populate context.
        res = run_cli(cli_script, proj, "init")
        print("INIT STDOUT:\n", res.stdout)
        print("INIT STDERR:\n", res.stderr)
        assert res.returncode == 0, "Init failed"
        ai_dir = os.path.join(proj, ".ai")
        assert os.path.isdir(ai_dir), ".ai not created"
        assert os.path.isfile(os.path.join(ai_dir, "context", "identity", "project.md")), "Identity not created"
        assert os.path.isfile(os.path.join(ai_dir, "context", "state", "STATE.md")), "STATE.md not created"
        assert os.path.isfile(os.path.join(ai_dir, "graph", "edges", "relationships.json")), "Graph edges not created"
        assert os.path.isfile(os.path.join(ai_dir, "context", "knowledge", "discovery.json")), "Discovery manifest not created"

        # 2. Inspect must report deterministic + AST-derived stack information.
        res = run_cli(cli_script, proj, "inspect")
        print("INSPECT STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Inspect failed"
        assert "Go" in res.stdout, "Go stack not detected"
        assert "Node.js" in res.stdout, "Node.js stack not detected"
        assert "Python" in res.stdout, "Python stack not detected"

        # 3. Graph must expose both file and symbol nodes.
        res = run_cli(cli_script, proj, "graph")
        print("GRAPH STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Graph failed"
        assert "src" in res.stdout, "src directory node missing"

        nodes_dir = os.path.join(ai_dir, "graph", "nodes")
        assert os.path.isfile(os.path.join(nodes_dir, "service_symbols.json")), "service_symbols file missing"
        assert os.path.isfile(os.path.join(nodes_dir, "index_symbols.json")), "index_symbols file missing"

        with open(os.path.join(nodes_dir, "service_symbols.json"), encoding="utf-8") as f:
            service_data = json.load(f)
        assert any(s["name"] == "UserService" and s["type"] == "class" for s in service_data["symbols"]), "UserService missing"
        assert any(s["name"] == "get_user" and s["type"] == "function" for s in service_data["symbols"]), "get_user missing"

        with open(os.path.join(nodes_dir, "index_symbols.json"), encoding="utf-8") as f:
            index_data = json.load(f)
        assert any(s["name"] == "ApiClient" and s["type"] == "class" for s in index_data["symbols"]), "ApiClient missing"
        assert any(s["name"] == "initialize" and s["type"] == "function" for s in index_data["symbols"]), "initialize missing"

        with open(os.path.join(ai_dir, "graph", "edges", "relationships.json"), encoding="utf-8") as f:
            edges = json.load(f)
        assert any(edge["type"] == "defines" for edge in edges), "defines relationships missing"

        # 4. Task-scoped context must emit machine-readable JSON.
        task_dir = os.path.join(ai_dir, "context", "tasks")
        os.makedirs(task_dir, exist_ok=True)
        with open(os.path.join(task_dir, "TASK-042.md"), "w", encoding="utf-8") as f:
            f.write("# TASK-042\n\n## Objective\n\nValidate task-scoped context.\n")

        res = run_cli(cli_script, proj, "context", "--task", "TASK-042")
        print("CONTEXT STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Context failed"
        packet = json.loads(res.stdout)
        assert packet["task"] == "TASK-042", "Task ID missing in packet"
        assert packet["task_context"]["objective"] == "Validate task-scoped context.", "Task objective missing"
        assert packet["project"]["identity"], "Identity missing from context packet"
        assert packet["graph"]["nodes"], "Graph missing from context packet"

        # 5. Compile must write the same packet shape to disk.
        res = run_cli(cli_script, proj, "compile", "--task", "TASK-042")
        print("COMPILE STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Compile failed"
        compiled = os.path.join(ai_dir, "context", "knowledge", "compiled-context.json")
        assert os.path.isfile(compiled), "Compiled context not written"
        with open(compiled, encoding="utf-8") as f:
            compiled_packet = json.load(f)
        assert compiled_packet["task"] == "TASK-042", "Compiled task missing"

        # 6. Missing context should fail clearly.
        no_ai_proj = os.path.join(tmpdir, "no-ai")
        os.makedirs(no_ai_proj)
        res = run_cli(cli_script, no_ai_proj, "inspect")
        assert res.returncode != 0, "Missing .ai did not fail"
        assert "No .ai/ directory found" in res.stdout, "Helpful missing-context error not printed"

        # 7. Invalid commands should fail with a readable usage message.
        res = run_cli(cli_script, proj, "invalid-cmd")
        assert res.returncode != 0, "Invalid command did not exit with error"
        assert "Unknown command" in res.stdout, "Usage warning not printed"

        # 8. Custom workspace names must work across commands.
        res = run_cli(cli_script, proj, "init", "--workspace", ".ai-cool-project")
        assert res.returncode == 0, "Custom workspace init failed"
        custom = os.path.join(proj, ".ai-cool-project")
        assert os.path.isdir(custom), "Custom workspace directory not created"

        res = run_cli(cli_script, proj, "inspect", "--workspace", ".ai-cool-project")
        assert res.returncode == 0, "Custom workspace inspect failed"
        assert "Project Identity" in res.stdout, "Custom workspace identity missing"

    print("All Discovery & CLI tests passed successfully!")


if __name__ == "__main__":
    test_discovery()
