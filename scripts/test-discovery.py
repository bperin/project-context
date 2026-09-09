#!/usr/bin/env python3
import subprocess
import tempfile
import os
import json

def test_discovery():
    print("==============================================")
    print(" Testing Two-Phase Discovery & CLI Commands")
    print("==============================================")

    with tempfile.TemporaryDirectory() as tmpdir:
        # Setup mock existing project
        proj = os.path.join(tmpdir, "mock-repo")
        os.makedirs(proj)
        os.makedirs(os.path.join(proj, "src"))
        os.makedirs(os.path.join(proj, "internal"))
        
        # Create manifests & files (Multi-manifest: Go + Node.js)
        with open(os.path.join(proj, "go.mod"), "w") as f:
            f.write("module example.com/mock\ngo 1.22")
        with open(os.path.join(proj, "package.json"), "w") as f:
            f.write('{"name": "mock-js"}')
        with open(os.path.join(proj, "README.md"), "w") as f:
            f.write("# Mock Repo")

        # Git init
        subprocess.run(["git", "init"], cwd=proj, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=proj, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=proj, capture_output=True)
        subprocess.run(["git", "add", "."], cwd=proj, capture_output=True)
        subprocess.run(["git", "commit", "-m", "init"], cwd=proj, capture_output=True)

        cli_script = os.path.abspath("./scripts/project-context.py")

        # 1. Test init
        res = subprocess.run(["python3", cli_script, "init"], cwd=proj, capture_output=True, text=True)
        print("INIT STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Init failed"
        assert os.path.isdir(os.path.join(proj, ".ai")), ".ai not created"
        assert os.path.isfile(os.path.join(proj, ".ai", "context", "identity", "project.md")), "Identity not created"

        # 2. Test inspect (Multi-manifest stack verification)
        res = subprocess.run(["python3", cli_script, "inspect"], cwd=proj, capture_output=True, text=True)
        print("INSPECT STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Inspect failed"
        assert "Go" in res.stdout, "Go stack not detected"
        assert "Node.js" in res.stdout, "Node.js stack not detected"

        # 3. Test graph
        res = subprocess.run(["python3", cli_script, "graph"], cwd=proj, capture_output=True, text=True)
        print("GRAPH STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Graph failed"
        assert "src" in res.stdout, "src directory node missing"

        # 4. Test context --task TASK-042
        res = subprocess.run(["python3", cli_script, "context", "--task", "TASK-042"], cwd=proj, capture_output=True, text=True)
        print("CONTEXT STDOUT:\n", res.stdout)
        assert res.returncode == 0, "Context failed"
        packet = json.loads(res.stdout)
        assert packet["task"] == "TASK-042", "Task ID missing in packet"

        # 5. Test Graceful Failures (Missing .ai folder checks)
        no_ai_proj = os.path.join(tmpdir, "no-ai")
        os.makedirs(no_ai_proj)
        res_fail = subprocess.run(["python3", cli_script, "inspect"], cwd=no_ai_proj, capture_output=True, text=True)
        assert "No .ai/ directory found" in res_fail.stdout, "Failed to print helpful error for missing .ai"

        # 6. Test Invalid Commands
        res_invalid = subprocess.run(["python3", cli_script, "invalid-cmd"], cwd=proj, capture_output=True, text=True)
        assert res_invalid.returncode != 0, "Invalid command did not exit with error"
        assert "Unknown command" in res_invalid.stdout, "Usage warning not printed"

    print("All Discovery & CLI tests passed successfully!")

if __name__ == "__main__":
    test_discovery()
