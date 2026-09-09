#!/usr/bin/env python3
"""Compatibility entrypoint for the Project Context compiler.

The canonical compiler implementation lives in scripts/project-context.py so
there is one CLI contract and one packet format. This wrapper keeps the older
standalone command usable.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Compile a Project Context packet")
    parser.add_argument("--workspace", default=".ai")
    parser.add_argument("--task")
    args = parser.parse_args()

    script = Path(__file__).with_name("project-context.py")
    command = [sys.executable, str(script), "compile", "--workspace", args.workspace]
    if args.task:
        command += ["--task", args.task]

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        return result.returncode

    output_path = result.stdout.strip()
    if output_path:
        print(f"Compiled context: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
