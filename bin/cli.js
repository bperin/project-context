#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const initCommand = require('../src/commands/init');
const inspectCommand = require('../src/commands/inspect');
const graphCommand = require('../src/commands/graph');
const overviewCommand = require('../src/commands/overview');

const program = new Command();

program
  .name('project-context')
  .description('Scaffold and manage .ai/ project context for AI agents')
  .version('2.0.0');

program
  .command('init')
  .description('Scaffold the .ai/ directory with workflows, templates, AGENTS.md, and empty context directories')
  .option('-w, --workspace <path>', 'Workspace directory name', '.ai')
  .option('-t, --target <path>', 'Target project directory', '.')
  .option('-d, --discover', 'Run discovery to populate identity, architecture, and graph nodes', false)
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
  .description('Read existing .ai/ directory and report state (specs/plans/tasks status and progress)')
  .option('-w, --workspace <path>', 'Workspace directory name', '.ai')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      await inspectCommand(options);
    } catch (err) {
      console.error('Error during inspect:', err.message);
      process.exit(1);
    }
  });

program
  .command('graph')
  .description('Build graph nodes and edges from source files and .ai/ context')
  .option('-w, --workspace <path>', 'Workspace directory name', '.ai')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      await graphCommand(options);
    } catch (err) {
      console.error('Error during graph:', err.message);
      process.exit(1);
    }
  });

program
  .command('overview')
  .description('Generate CSV overview of all specs, plans, and tasks from their Status sections')
  .option('-w, --workspace <path>', 'Workspace directory name', '.ai')
  .option('-t, --target <path>', 'Target project directory', '.')
  .action(async (options) => {
    try {
      await overviewCommand(options);
    } catch (err) {
      console.error('Error during overview:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
