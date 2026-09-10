const { v5 } = require('uuid');

// Same namespace as overview.js — deterministic v5 UUIDs from IDs.
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function uuidCommand(options) {
  const id = options.id;
  if (!id) {
    console.error('Usage: project-context uuid <ID>');
    process.exit(1);
  }
  console.log(v5(id, NAMESPACE));
}

module.exports = uuidCommand;
