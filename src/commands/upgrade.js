const fs = require("fs");
const path = require("path");
const {
  copyWithHeader,
  detectLanguage,
  createDataFiles,
  readIdentity,
  writeJSON,
  ensureContextPacketsIgnored,
  ensureLanguageSkills,
  ensureMemoryLakeMcp,
  ensureMemoryLakeIdentity,
} = require("./shared");

async function upgradeCommand(options) {
  const targetDir = path.resolve(options.target || ".");
  const repoName = path.basename(targetDir);

  // Find existing workspace, or default to .{reponame}-manager
  let workspace = options.workspace;
  if (!workspace) {
    const expected = `.${repoName}-manager`;
    const entries = fs.readdirSync(targetDir);
    const candidates = entries.filter(
      (e) =>
        e.startsWith(".") && fs.statSync(path.join(targetDir, e)).isDirectory(),
    );
    const known = candidates.find(
      (e) => e === expected || e.endsWith("-manager"),
    );
    workspace = known || expected;
  }

  const wsDir = path.join(targetDir, workspace);
  if (!fs.existsSync(wsDir)) {
    console.error(`Workspace not found: ${wsDir}`);
    console.error("Run init first.");
    process.exit(1);
  }

  ensureContextPacketsIgnored(targetDir);
  ensureContextPacketsIgnored(wsDir);
  const memoryLake = ensureMemoryLakeMcp(targetDir);
  console.log(
    `${memoryLake.changed ? "Configured" : "Verified"} project MCP memorylake in ${memoryLake.path}`,
  );

  console.log(`Upgrading ${workspace} workspace at ${wsDir}...`);

  // Source root for assets. Defaults to this package's src/ directory.
  // Pass --source <dir> to sync assets from another checkout (e.g. when
  // running a vendored binary that does not bundle the markdown assets).
  const srcRoot = options.source
    ? path.resolve(options.source)
    : path.join(__dirname, "..");
  const srcWorkflows = path.join(srcRoot, "workflows");
  const srcSkills = path.join(srcRoot, "skills");
  const srcAgents = path.join(srcRoot, "agents");
  const srcTemplates = path.join(srcRoot, "templates");

  // Clean up obsolete files from older versions. We don't migrate data
  // from these — we just remove generated assets. Existing legacy epic/spec
  // documents and all plan/task data are left alone.
  const obsoleteFiles = [
    path.join(wsDir, "overview.xlsx"),
    path.join(wsDir, "overview.csv"),
    path.join(wsDir, "workflows", "spec-creation.md"),
    path.join(wsDir, "workflows", "plan-creation.md"),
    path.join(wsDir, "workflows", "task-creation.md"),
    // Old workflow names (pre-skill-name alignment)
    path.join(wsDir, "workflows", "plan-workflow.md"),
    path.join(wsDir, "workflows", "task-workflow.md"),
    path.join(wsDir, "workflows", "task-implementation.md"),
    path.join(wsDir, "workflows", "code-review.md"),
    // Superseded by the coordinator-only pc-plan lifecycle reference.
    path.join(wsDir, "workflows", "overview.md"),
    // Old templates no longer generated
    path.join(wsDir, "templates", "STATE.md"),
    path.join(wsDir, "templates", "current.md"),
    path.join(wsDir, "templates", "DECISIONS.md"),
    path.join(wsDir, "templates", "skill.md"),
    path.join(wsDir, "templates", "skill.template.md"),
    path.join(wsDir, "templates", "state.template.md"),
    path.join(wsDir, "templates", "workflow.template.md"),
    path.join(wsDir, "templates", "architecture.template.md"),
    path.join(wsDir, "templates", "identity.template.md"),
    path.join(wsDir, "templates", "ADR-NNN.template.md"),
    // PLAN+TASK-only lifecycle. Legacy data remains readable in place.
    path.join(wsDir, "workflows", "pc-epic.md"),
    path.join(wsDir, "workflows", "pc-spec.md"),
    path.join(wsDir, "workflows", "pc-create-tasks.md"),
    path.join(wsDir, "workflows", "pc-implement.md"),
    path.join(wsDir, "workflows", "pc-review.md"),
    path.join(wsDir, "workflows", "test-failure.md"),
    path.join(wsDir, "templates", "EPIC-NNN.template.md"),
    path.join(wsDir, "templates", "EPIC-NNN.instructions.md"),
    path.join(wsDir, "templates", "SPEC-NNN.template.md"),
    path.join(wsDir, "templates", "SPEC-NNN.instructions.md"),
    // Writer guidance must not be embedded in generated plan/task packets.
    path.join(wsDir, "templates", "PLAN-NNN.instructions.md"),
    path.join(wsDir, "templates", "TASK-NNN.instructions.md"),
  ];
  const obsoleteSkillDirs = [
    // Former package-root shared skill bundle. Remove this closed list only;
    // project-owned local skills remain untouched.
    "accelint-ts-performance",
    "build-web3",
    "ethereum",
    "go-code-review",
    "go-memory-oom-guard",
    "go-security-expert",
    "go-systems-programmer",
    "golang-code-style",
    "golang-concurrency",
    "golang-error-handling",
    "golang-performance",
    "golang-security",
    "golang-testing",
    "implementing-digital-signatures-with-ed25519",
    "js-ts-performance-readability",
    "python-code-style",
    "python-cybersecurity-tool-development",
    "python-performance-optimization",
    "python-testing-patterns",
    "rust-performance",
    "rust-security",
    "rust-testing",
    "typescript-code-review",
    "typescript-security-review",
    "typescript-unit-testing",
    "wycheproof",
    // Old workflow names (pre-pc- prefix)
    "create-spec",
    "create-plan",
    "create-task",
    "approve-spec",
    "approve-plan",
    "spec-optimizer",
    "plan-optimizer",
    "task-optimizer",
    // Old non-prefixed skill names (renamed to pc-*)
    "code-optimizer",
    "context",
    "implement",
    "inspect-project",
    "plan",
    "review",
    "test",
    "uuid",
    "pc-epic",
    "pc-spec",
    "pc-archive",
    "pc-context",
    "pc-create-tasks",
    "pc-implement",
    "pc-inspect-project",
    "pc-optimize",
    "pc-review",
    "pc-test",
    "pc-uuid",
    // Removed in favor of writer + challenger
    "implementer",
    "reviewer",
  ];
  const obsoleteAgentProfiles = [
    "spec-optimizer.md",
    "plan-optimizer.md",
    "task-optimizer.md",
    "code-optimizer.md",
    // Superseded planning/document writer profiles.
    "spec-writer.md",
    "plan-writer.md",
    "task-writer.md",
    // Replaced by writer + challenger
    "implementer.md",
    "reviewer.md",
    "planning-brain.md",
    // Removed from the current writer + challenger profile set.
    "workstream-analyst.md",
    "test-agent.md",
  ];

  for (const f of obsoleteFiles) {
    if (fs.existsSync(f)) {
      fs.rmSync(f, { force: true });
      console.log(`Removed obsolete file: ${path.relative(wsDir, f)}`);
    }
  }
  const legacyAgentsInstructions = path.join(wsDir, ".agents", "AGENTS.md");
  if (fs.existsSync(legacyAgentsInstructions)) {
    fs.rmSync(legacyAgentsInstructions, { force: true });
    console.log("Removed obsolete file: .agents/AGENTS.md");
  }
  for (const skillName of obsoleteSkillDirs) {
    const d = path.join(wsDir, ".agents", "skills", skillName);
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
      console.log(`Removed obsolete skill: ${skillName}`);
    }
  }
  for (const agentFile of obsoleteAgentProfiles) {
    for (const agentsBase of [
      path.join(wsDir, ".agents", "agents"),
      path.join(targetDir, ".devin", "agents"),
    ]) {
      const f = path.join(agentsBase, agentFile);
      if (fs.existsSync(f)) {
        fs.rmSync(f, { force: true });
        console.log(
          `Removed obsolete agent profile: ${path.relative(targetDir, f)}`,
        );
      }
    }
  }

  // Ensure directories exist
  const dirs = [
    path.join(wsDir, ".agents", "skills"),
    path.join(wsDir, "workflows"),
    path.join(wsDir, "plans"),
    path.join(wsDir, "tasks"),
    path.join(wsDir, "decisions"),
    path.join(wsDir, "architecture"),
    path.join(wsDir, "identity"),
    path.join(wsDir, "graph"),
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });

  // Copy AGENTS.md (workflow protocol)
  const agentsTemplate = path.join(srcTemplates, "AGENTS.md");
  if (fs.existsSync(agentsTemplate)) {
    copyWithHeader(agentsTemplate, path.join(wsDir, "AGENTS.md"));
  } else {
    fs.writeFileSync(path.join(wsDir, "AGENTS.md"), "# Agent Protocol\n");
  }

  // Copy workflow .md files
  if (fs.existsSync(srcWorkflows)) {
    for (const f of fs.readdirSync(srcWorkflows)) {
      if (f.endsWith(".md") && !f.includes("template") && f !== "overview.md") {
        copyWithHeader(
          path.join(srcWorkflows, f),
          path.join(wsDir, "workflows", f),
        );
      }
    }
  }

  // Copy document templates (PLAN/TASK) so the workspace
  // has the current templates without re-running init.
  if (fs.existsSync(srcTemplates)) {
    const dstTemplates = path.join(wsDir, "templates");
    fs.mkdirSync(dstTemplates, { recursive: true });
    for (const f of fs.readdirSync(srcTemplates)) {
      if (!f.endsWith(".md")) continue;
      const srcFile = path.join(srcTemplates, f);
      const dstFile = path.join(dstTemplates, f);
      if (f.endsWith(".instructions.md")) continue;
      copyWithHeader(srcFile, dstFile);
    }
  }

  // Copy workflow skills from src/skills/
  const agentsDir = path.join(wsDir, ".agents");
  const skillsDir = path.join(agentsDir, "skills");

  if (fs.existsSync(srcSkills)) {
    for (const skillName of fs.readdirSync(srcSkills)) {
      if (skillName === "AGENTS.md") continue;
      const srcSkillDir = path.join(srcSkills, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;
      const skillFiles = fs.readdirSync(srcSkillDir);
      if (skillFiles.length === 0) continue;
      const dstSkillDir = path.join(skillsDir, skillName);
      fs.rmSync(dstSkillDir, { recursive: true, force: true });
      fs.mkdirSync(dstSkillDir, { recursive: true });
      for (const f of skillFiles) {
        fs.cpSync(path.join(srcSkillDir, f), path.join(dstSkillDir, f), { recursive: true });
      }
    }
  }

  // Sync subagent profiles to .agents/agents/ only. The root .agents
  // symlink discovers them. Do NOT copy to .devin/agents/ — that
  // creates duplicate profiles the user asked to avoid.
  // Use plain copy (not copyWithHeader) because agent profiles have YAML
  // frontmatter that must be the first line — prepending an HTML comment
  // breaks frontmatter parsing.
  if (fs.existsSync(srcAgents)) {
    const profileFiles = fs
      .readdirSync(srcAgents)
      .filter((f) => f.endsWith(".md"));
    const dstAgentsDir = path.join(agentsDir, "agents");
    fs.mkdirSync(dstAgentsDir, { recursive: true });
    for (const f of profileFiles) {
      fs.copyFileSync(path.join(srcAgents, f), path.join(dstAgentsDir, f));
    }

    // Remove any stale managed profiles from .devin/agents/ so only
    // .agents/agents/ has them. Check both root and workspace-level.
    const devinAgentsPaths = [
      path.join(targetDir, ".devin", "agents"),
      path.join(wsDir, ".devin", "agents"),
    ];
    for (const devinAgentsDir of devinAgentsPaths) {
      if (fs.existsSync(devinAgentsDir)) {
        for (const f of profileFiles) {
          const stale = path.join(devinAgentsDir, f);
          if (fs.existsSync(stale)) fs.rmSync(stale, { force: true });
        }
        // Remove the dir if empty
        try {
          fs.rmdirSync(devinAgentsDir);
        } catch (e) {}
      }
    }
  }

  // Shared skills are never copied into managers. The manifest records their
  // canonical user-level references; upgrade owns only pc-plan and profiles.

  // Ensure data files exist (create if missing, preserve if existing)
  const language = detectLanguage(targetDir);
  const dataDir = path.join(wsDir, "data");
  if (!fs.existsSync(path.join(dataDir, "identity.json"))) {
    createDataFiles(wsDir, language, repoName, repoName);
  }
  ensureMemoryLakeIdentity(wsDir, repoName);
  ensureLanguageSkills(wsDir, language);

  // Ensure .agents symlink exists (unless --no-symlink)
  if (options.symlink !== false) {
    const agentsLink = path.join(targetDir, ".agents");
    try {
      fs.rmSync(agentsLink, { recursive: true, force: true });
    } catch (e) {}
    fs.symlinkSync(path.join(workspace, ".agents"), agentsLink);
    console.log(`Symlinked .agents → ${workspace}/.agents`);
  }

  // Regenerate hooks (unless --no-hooks)
  if (options.hooks !== false) {
    const devinDir = path.join(targetDir, ".devin");
    fs.mkdirSync(devinDir, { recursive: true });
    const hooksPath = path.join(devinDir, "hooks.v1.json");
    const hookPath = path.join(
      __dirname,
      "..",
      "..",
      "scripts",
      "task-done-hook.js",
    );
    const hooks = {
      PostToolUse: [
        {
          command: "node",
          args: [
            hookPath,
            "-t",
            targetDir,
            "-w",
            workspace,
            "--tool",
            "{{tool}}",
            "--output-file",
            "{{output_file}}",
          ],
          match: "setStatus|edit|write|notebook_edit",
        },
      ],
    };
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
    console.log(`Generated ${hooksPath}`);
  }

  console.log(`Successfully upgraded ${workspace} workspace at ${wsDir}`);
}

module.exports = upgradeCommand;
