#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'setup-project-context.sh');
const result = spawnSync('bash', [scriptPath, ...process.argv.slice(2)], {
  stdio: 'inherit'
});

process.exit(result.status);
