#!/usr/bin/env node

const { Command } = require("commander");
const pkg = require("../package.json");
const { init } = require("../src/commands/init");
const { inspect } = require("../src/commands/inspect");
const { graph } = require("../src/commands/graph");
const { overview } = require("../src/commands/overview");

const program = new Command();

program
  .name("project-context")
  .description("Scaffold and manage .ai/ project context for AI agents")
  .version(pkg.version);

program
  .command("init")
  .description("Scaffold the .ai/ directory with workflows, templates, and AGENTS.md")
  .option("-w, --workspace <dir>", "workspace directory name", ".ai")
  .option("-t, --target <path>", "target project path", ".")
  .option("--discover", "run discovery to populate identity and graph nodes")
  .action(init);

program
  .command("inspect")
  .description("Read the .ai/ directory and report project state")
  .option("-w, --workspace <dir>", "workspace directory name", ".ai")
  .option("-t, --target <path>", "target project path", ".")
  .action(inspect);

program
  .command("graph")
  .description("Build graph nodes and edges from source files")
  .option("-w, --workspace <dir>", "workspace directory name", ".ai")
  .option("-t, --target <path>", "target project path", ".")
  .action(graph);

program
  .command("overview")
  .description("Generate overview.csv from spec/plan/task Status sections")
  .option("-w, --workspace <dir>", "workspace directory name", ".ai")
  .option("-t, --target <path>", "target project path", ".")
  .action(overview);

program.parse();
