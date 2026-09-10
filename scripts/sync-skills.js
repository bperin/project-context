#!/usr/bin/env node

// sync-skills.js — copy language skills from ~/.agents/skills/ (or
// $SKILLS_HOME) into the bundled skills/ directory at the package root.
//
// This makes project-context self-contained: when compiled or installed
// elsewhere, init can copy language skills into target projects without
// needing ~/.agents/skills/ to exist on the target machine.
//
// Usage:
//   npm run sync-skills

const fs = require('fs');
const path = require('path');

const SKILLS_HOME = process.env.SKILLS_HOME || path.join(process.env.HOME, '.agents', 'skills');
const BUNDLED_DIR = path.join(__dirname, '..', 'skills');

// Skills referenced in LANGUAGE_PRESETS (src/commands/init.js) plus
// algorithm-specific skills from trust/AGENTS.md.
const REQUIRED_SKILLS = [
  // Node
  'typescript-code-review',
  'typescript-unit-testing',
  'typescript-security-review',
  'accelint-ts-performance',
  'js-ts-performance-readability',
  // Go
  'go-systems-programmer',
  'go-security-expert',
  'go-memory-oom-guard',
  'golang-testing',
  'golang-security',
  'golang-code-style',
  'golang-error-handling',
  'golang-concurrency',
  'golang-performance',
  'wycheproof',
  'go-code-review',
  // Cross-language / domain
  'build-web3',
  'ethereum',
  'implementing-digital-signatures-with-ed25519',
  // Rust
  'rust-security',
  'rust-testing',
  'rust-performance',
  // Python
  'python-code-style',
  'python-testing-patterns',
  'python-performance-optimization',
  'python-cybersecurity-tool-development',
];

if (!fs.existsSync(SKILLS_HOME)) {
  console.error(`SKILLS_HOME not found: ${SKILLS_HOME}`);
  console.error('Set SKILLS_HOME or install skills to ~/.agents/skills/');
  process.exit(1);
}

fs.mkdirSync(BUNDLED_DIR, { recursive: true });

let bundled = 0;
let missing = 0;

for (const skill of REQUIRED_SKILLS) {
  const src = path.join(SKILLS_HOME, skill);
  const dst = path.join(BUNDLED_DIR, skill);

  if (!fs.existsSync(src)) {
    console.error(`MISSING: ${skill}`);
    missing++;
    continue;
  }

  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`bundled: ${skill}`);
  bundled++;
}

console.log(`\n${bundled} skills bundled, ${missing} missing`);
if (missing > 0) process.exit(1);
