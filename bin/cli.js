#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');
const uuidCommand = require('../src/commands/uuid');
const contextCommand = require('../src/commands/context');
const setStatusCommand = require('../src/commands/set-status');
const addCommand = require('../src/commands/add');

const program = new Command();

program
  .name('project-context')
  .description('Scaffold and manage project-context-{repo} workspace for AI agents')
  .version('2.0.0');

// Auto-detect the workspace directory: look for .{reponame}-manager in the target.
function resolveWorkspace(options) {
  if (options.workspace) {
    return options.workspace;
  }
  const targetDir = path.resolve(options.target || '.');
  const repoName = path.basename(targetDir);
  const expected = `.${repoName}-manager`;
  const entries = fs.readdirSync(targetDir);
  if (entries.includes(expected) && fs.statSync(path.join(targetDir, expected)).isDirectory()) {
    return expected;
  }
  return expected;
}

program
  .command('init')
  .description('Scaffold the project-context-{repo} workspace with workflows, skills, AGENTS.md, and overview.xlsx')
  .option('-w, --workspace <path>', 'Workspace directory name (default: project-context-{reponame})')
  .option('-t, --target <path>', 'Target project directory', '.')
  .option('-d, --discover', 'Run discovery to populate identity', false)
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (err) {
      console.error('Error during init:', err.message);
      process.exit(1);
    }
  });

program
  .command('inspect')
  .description('Read overview.xlsx and report specs/plans/tasks status and progress')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      options.workspace = resolveWorkspace(options);
      await inspectCommand(options);
    } catch (err) {
      console.error('Error during inspect:', err.message);
      process.exit(1);
    }
  });

program
  .command('graph')
  .description('Build graph nodes and edges from source files')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      options.workspace = resolveWorkspace(options);
      await graphCommand(options);
    } catch (err) {
      console.error('Error during graph:', err.message);
      process.exit(1);
    }
  });

program
  .command('overview')
  .description('Refresh the Workflows sheet in overview.xlsx from workflow markdown files')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      options.workspace = resolveWorkspace(options);
      await overviewCommand(options);
    } catch (err) {
      console.error('Error during overview:', err.message);
      process.exit(1);
    }
  });

program
  .command('uuid <id>')
  .description('Generate a deterministic v5 UUID from an ID (e.g. SPEC-001, TASK-010)')
  .action((id) => {
    try {
      uuidCommand({ id });
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

program
  .command('context <id>')
  .description('Build a minimal context packet for a spec/plan/task (for feeding subagents)')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .option('--workflow <name>', 'Workflow context for always-on/project-local skill filtering (default: all)')
  .option('-o, --output <path>', 'Write to file instead of stdout')
  .action((id, options) => {
    try {
      options.workspace = resolveWorkspace(options);
      contextCommand({ id, ...options });
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

program
  .command('add')
  .description('Add a spec/plan/task row to overview.xlsx (agents use this, not direct xlsx edits)')
  .requiredOption('--type <type>', 'spec, plan, or task')
  .requiredOption('--title <title>', 'Title')
  .option('--id <id>', 'Override the auto-assigned ID (e.g. SPEC-001)')
  .option('--status <status>', 'Initial status (default: draft)')
  .option('--dependencies <deps>', 'Comma-separated parent IDs')
  .option('--skills <skills>', 'Comma-separated skill names')
  .option('--triggers <triggers>', 'Comma-separated trigger names (resolved via Skill Matrix)')
  .option('--commit <hash>', 'Commit hash')
  .option('--progress <pct>', 'Progress percentage (specs/plans only)')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      options.workspace = resolveWorkspace(options);
      await addCommand(options);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

program
  .command('status <id> <status>')
  .description('Set the Status cell for a SPEC/PLAN/TASK row in overview.xlsx')
  .option('-w, --workspace <path>', 'Workspace directory name (auto-detected)')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (id, status, options) => {
    try {
      options.workspace = resolveWorkspace(options);
      options.id = id;
      options.status = status;
      await setStatusCommand(options);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
