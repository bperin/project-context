const fs = require('fs');
const path = require('path');
const {
  appendTaskEvent,
  appendTimelineEvent,
  parseMarkdownField,
  readSpecs,
  readPlans,
  readTaskFiles,
  getTaskStates,
} = require('./shared');

// nextID finds the highest NNN suffix among existing IDs and returns NNN+1.
function nextID(existing, prefix) {
  let max = 0;
  for (const item of existing) {
    const id = String(item.id || '');
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// readTemplate reads a template file and fills in placeholders.
function readTemplate(aiDir, templateName, vars) {
  const templatePath = path.join(aiDir, 'templates', templateName);
  if (!fs.existsSync(templatePath)) {
    return null;
  }
  let content = fs.readFileSync(templatePath, 'utf8');
  // Replace {{KEY}} placeholders
  for (const [key, val] of Object.entries(vars)) {
    content = content.replace(new RegExp(`{{${key}}}`, 'g'), val);
  }
  // Replace ID-NNN pattern with actual ID
  if (vars.ID) {
    const prefix = vars.ID.replace(/-\d+$/, '');
    content = content.replace(new RegExp(`${prefix}-NNN`, 'g'), vars.ID);
  }
  // Replace <short title> with actual title
  if (vars.TITLE) {
    content = content.replace(/<short title>/g, vars.TITLE);
  }
  return content;
}

// addCommand handles adding a spec, plan, or task.
async function addCommand(options) {
  const { type, title, status, dependencies, skills, triggers, commit, id } = options;

  if (!type || !title) {
    console.error('Usage: project-context add --type <spec|plan|task> --title <title> [options]');
    process.exit(1);
  }

  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  if (!fs.existsSync(aiDir)) {
    console.error(`Workspace directory ${aiDir} does not exist. Run init first.`);
    process.exit(1);
  }

  const prefix = type.toUpperCase().startsWith('SPEC-') ? 'SPEC'
    : type.toUpperCase().startsWith('PLAN-') ? 'PLAN'
    : type.toUpperCase().startsWith('TASK-') ? 'TASK'
    : type.toUpperCase() === 'SPEC' ? 'SPEC'
    : type.toUpperCase() === 'PLAN' ? 'PLAN'
    : type.toUpperCase() === 'TASK' ? 'TASK'
    : null;

  if (!prefix) {
    console.error(`Invalid type: ${type}. Use spec, plan, or task.`);
    process.exit(1);
  }

  // Determine the ID
  let finalID = id;
  if (!finalID) {
    let existing;
    if (prefix === 'SPEC') existing = readSpecs(aiDir);
    else if (prefix === 'PLAN') existing = readPlans(aiDir);
    else existing = [...readTaskFiles(aiDir), ...getTaskStates(aiDir).values()];
    finalID = nextID(existing, prefix);
  }

  // Generate UUID deterministically — inline, not via execSync
  // (execSync to bin/cli.js breaks in bundled builds)
  const { v5 } = require('uuid');
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const uuid = v5(finalID, NAMESPACE);

  const dirName = prefix === 'SPEC' ? 'specs' : prefix === 'PLAN' ? 'plans' : 'tasks';
  const filePath = path.join(aiDir, dirName, `${finalID}.md`);

  // Check for duplicates
  if (fs.existsSync(filePath)) {
    console.error(`${finalID} already exists: ${filePath}`);
    process.exit(1);
  }

  // Create the MD file from template
  const templateName = `${prefix}-NNN.template.md`;
  const parent = options.parent || dependencies || '';
  const templateVars = {
    ID: finalID,
    UUID: uuid,
    TITLE: title,
    STATUS: status || 'draft',
    PARENT: parent,
    DEPENDENCIES: dependencies || parent,
    SKILLS: skills || '',
    TRIGGERS: triggers || '',
    COMMIT: commit || '',
  };

  let content = readTemplate(aiDir, templateName, templateVars);
  if (!content) {
    // No template — write a minimal file
    content = `# ${finalID}: ${title}\n\n**UUID**: ${uuid}\n**Status**: ${status || 'draft'}\n**Parent**: ${parent}\n**Dependencies**: ${dependencies || parent}\n**Skills**: ${skills || ''}\n**Triggers**: ${triggers || ''}\n**Commit**: ${commit || ''}\n`;
  }

  fs.writeFileSync(filePath, content);

  // For tasks: also append to tasks.jsonl and plan timeline
  if (prefix === 'TASK') {
    const planId = parent || dependencies || '';
    appendTaskEvent(aiDir, {
      id: finalID,
      event: 'created',
      title,
      plan: planId,
      status: 'draft',
      skills: skills || '',
      triggers: triggers || '',
    });
    if (planId) {
      appendTimelineEvent(aiDir, planId, {
        task: finalID,
        event: 'queued',
      });
    }
  }

  console.log(`Added ${finalID} to ${dirName}/: ${title}`);
  console.log(`  UUID: ${uuid}`);
  console.log(`  Status: ${status || 'draft'}`);
  if (parent) console.log(`  Parent: ${parent}`);
  if (dependencies) console.log(`  Dependencies: ${dependencies}`);
  if (skills) console.log(`  Skills: ${skills}`);
  if (triggers) console.log(`  Triggers: ${triggers}`);
  console.log(`  File: ${filePath}`);
  if (prefix === 'TASK') {
    console.log(`  JSONL: ${path.join(aiDir, 'data', 'tasks.jsonl')}`);
  }

  return { id: finalID, uuid };
}

module.exports = addCommand;
