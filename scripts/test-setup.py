#!/usr/bin/env python3
import subprocess
import tempfile
import os

def run_tests():
    print("==============================================")
    print(" Running setup-project-context.sh Python Tests")
    print("==============================================")
    
    passes = 0
    failures = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        target = os.path.join(tmpdir, "my-test-project")
        os.makedirs(target)
        inputs = f"{target}\nglm-5.2-high\n\nn\nn\nn\n".encode("utf-8")
        
        res = subprocess.run(["bash", "./scripts/setup-project-context.sh"], input=inputs, capture_output=True)
        
        if res.returncode == 0:
            print("  PASS: Script executed with exit code 0")
            passes += 1
        else:
            print(f"  FAIL: Script executed with exit code {res.returncode}")
            print(res.stderr.decode())
            failures += 1

        ai_dir = os.path.join(target, ".ai")
        checks = [
            (os.path.isdir(ai_dir), ".ai directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "identity")), "identity directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "architecture")), "architecture directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "state")), "state directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "specs")), "specs directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "plans")), "plans directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "tasks")), "tasks directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "decisions")), "decisions directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "workflows")), "workflows directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "skills")), "skills directory created"),
            (os.path.isdir(os.path.join(ai_dir, "context", "knowledge")), "knowledge directory created"),
            (os.path.isdir(os.path.join(ai_dir, "templates")), "templates directory created"),
            (os.path.isfile(os.path.join(ai_dir, "AGENTS.md")), "AGENTS.md created"),
            (os.path.isfile(os.path.join(ai_dir, "context", "state", "STATE.md")), "STATE.md created"),
            (os.path.isfile(os.path.join(ai_dir, "context", "decisions", "DECISIONS.md")), "DECISIONS.md created"),
            (os.path.isfile(os.path.join(ai_dir, "templates", "SPEC-NNN.template.md")), "SPEC template created"),
            (os.path.isfile(os.path.join(ai_dir, "templates", "PLAN-NNN.template.md")), "PLAN template created"),
            (os.path.isfile(os.path.join(ai_dir, "templates", "TASK-NNN.template.md")), "TASK template created"),
        ]

        for condition, msg in checks:
            if condition:
                print(f"  PASS: {msg}")
                passes += 1
            else:
                print(f"  FAIL: {msg}")
                failures += 1

    print("==============================================")
    print(" Test Summary")
    print("==============================================")
    print(f"Passes:   {passes}")
    print(f"Failures: {failures}")

    if failures > 0:
        exit(1)
    else:
        print("All tests passed successfully!")
        exit(0)

if __name__ == "__main__":
    run_tests()
