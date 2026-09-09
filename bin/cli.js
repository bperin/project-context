#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'project-context.py');
const result = spawnSync('python3', [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit'
});

process.exit(result.status);
