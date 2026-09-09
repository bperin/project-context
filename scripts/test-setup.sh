#!/usr/bin/env bash
set -euo pipefail

# Tests for setup-project-context.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SETUP_SCRIPT="$ROOT_DIR/scripts/setup-project-context.sh"

passes=0
failures=0

assert_eq() {
  local expected="$1" actual="$2" msg="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $msg"
    ((passes++))
  else
    echo "  FAIL: $msg"
    echo "    Expected: '$expected'"
    echo "    Actual:   '$actual'"
    ((failures++))
  fi
}

assert_file_exists() {
  local file="$1" msg="${2:-File $file exists}"
  if [[ -f "$file" ]]; then
    echo "  PASS: $msg"
    ((passes++))
  else
    echo "  FAIL: $msg (file not found)"
    ((failures++))
  fi
}

assert_dir_exists() {
  local dir="$1" msg="${2:-Directory $dir exists}"
  if [[ -d "$dir" ]]; then
    echo "  PASS: $msg"
    ((passes++))
  else
    echo "  FAIL: $msg (directory not found)"
    ((failures++))
  fi
}

echo "=============================================="
echo " Running setup-project-context.sh Tests"
echo "=============================================="

TEST_TMP="$(mktemp -d)"
trap 'rm -rf "$TEST_TMP"' EXIT

# Test 1: Non-interactive run simulation using inputs
# Inputs: PROJECT_ROOT, KEEP_EXISTING (y), MODEL (glm-5.2-high), SPEC_PATH (none), CONFIGURE_REPOS (n), ADD_ANOTHER (n)
echo
echo "Test 1: Basic dry/non-interactive run simulation"

TARGET_PROJ="$TEST_TMP/my-test-project"
mkdir -p "$TARGET_PROJ"

# We pipe inputs to the script
# 1. Destination directory: $TARGET_PROJ
# 2. Model: glm-5.2-high
# 3. Path to existing SPEC: (empty)
# 4. Configure existing dirs: n
# 5. Add another repository?: n
# 6. Create repo-local AGENTS.md?: n
inputs="$TARGET_PROJ\nglm-5.2-high\n\nn\nn\nn\n"

if printf "$inputs" | bash "$SETUP_SCRIPT"; then
  echo "  PASS: Script executed successfully"
  ((passes++))
else
  echo "  FAIL: Script execution failed"
  ((failures++))
fi

# Verify structure
AI_DIR="$TARGET_PROJ/.ai"
assert_dir_exists "$AI_DIR" ".ai directory created"
assert_dir_exists "$AI_DIR/context/identity" "identity directory created"
assert_dir_exists "$AI_DIR/context/architecture" "architecture directory created"
assert_dir_exists "$AI_DIR/context/state" "state directory created"
assert_dir_exists "$AI_DIR/context/specs" "specs directory created"
assert_dir_exists "$AI_DIR/context/plans" "plans directory created"
assert_dir_exists "$AI_DIR/context/tasks" "tasks directory created"
assert_dir_exists "$AI_DIR/context/decisions" "decisions directory created"
assert_dir_exists "$AI_DIR/context/workflows" "workflows directory created"
assert_dir_exists "$AI_DIR/context/skills" "skills directory created"
assert_dir_exists "$AI_DIR/context/knowledge" "knowledge directory created"
assert_dir_exists "$AI_DIR/templates" "templates directory created"
assert_file_exists "$AI_DIR/AGENTS.md" "AGENTS.md created"
assert_file_exists "$AI_DIR/context/state/STATE.md" "STATE.md created"
assert_file_exists "$AI_DIR/context/decisions/DECISIONS.md" "DECISIONS.md created"
assert_file_exists "$AI_DIR/templates/SPEC-NNN.template.md" "SPEC template created"
assert_file_exists "$AI_DIR/templates/PLAN-NNN.template.md" "PLAN template created"
assert_file_exists "$AI_DIR/templates/TASK-NNN.template.md" "TASK template created"

echo
echo "=============================================="
echo " Test Summary"
echo "=============================================="
echo "Passes:   $passes"
echo "Failures: $failures"

if [[ $failures -gt 0 ]]; then
  exit 1
else
  echo "All tests passed successfully!"
  exit 0
fi
