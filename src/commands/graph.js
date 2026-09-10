const fs = require('fs');
const path = require('path');

function walkDir(dir, fileList = [], skipDirs = new Set(['.git', 'node_modules', '.ai', 'dist', 'build'])) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (skipDirs.has(file)) continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList, skipDirs);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// parseJsImports extracts require/import paths from JS/TS source.
function parseJsImports(content) {
  const imports = [];
  // require('...') and require("...")
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = requireRe.exec(content)) !== null) {
    imports.push(m[1]);
  }
  // import ... from '...' and import '...'
  const importRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(content)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

// parseJsExports extracts module.exports and named exports from JS/TS.
function parseJsExports(content) {
  const exports = [];
  // module.exports = { ... } — grab the keys
  const moduleExportsRe = /module\.exports\s*=\s*\{([^}]*)\}/g;
  let m;
  while ((m = moduleExportsRe.exec(content)) !== null) {
    const keys = m[1].match(/(\w+)/g);
    if (keys) exports.push(...keys);
  }
  // module.exports.foo = ... or exports.foo = ...
  const exportAssignRe = /(?:module\.exports|exports)\.(\w+)\s*=/g;
  while ((m = exportAssignRe.exec(content)) !== null) {
    exports.push(m[1]);
  }
  // export function foo / export const foo / export class foo
  const exportRe = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g;
  while ((m = exportRe.exec(content)) !== null) {
    exports.push(m[1]);
  }
  // export { foo, bar }
  const exportListRe = /export\s*\{([^}]*)\}/g;
  while ((m = exportListRe.exec(content)) !== null) {
    const keys = m[1].match(/(\w+)/g);
    if (keys) exports.push(...keys);
  }
  return [...new Set(exports)];
}

// parseGoImports extracts import paths from Go source.
function parseGoImports(content) {
  const imports = [];
  // Single import "path"
  const singleRe = /import\s+"([^"]+)"/g;
  let m;
  while ((m = singleRe.exec(content)) !== null) {
    imports.push(m[1]);
  }
  // Block import ( "path" ... )
  const blockRe = /import\s*\(\s*([\s\S]*?)\s*\)/g;
  while ((m = blockRe.exec(content)) !== null) {
    const lines = m[1].split('\n');
    for (const line of lines) {
      const lm = line.trim().match(/^"([^"]+)"$/);
      if (lm) imports.push(lm[1]);
    }
  }
  return imports;
}

// resolveImport maps an import string to a node id if it's a local file.
// Returns null for external (node_modules, stdlib, etc.) imports.
function resolveImport(imp, allNodeIds, currentDir, targetDir) {
  // Go: resolve by matching the last path segment to a node
  if (imp.includes('/')) {
    const lastSeg = imp.split('/').pop();
    // Try matching a node whose path ends with this segment
    for (const id of allNodeIds) {
      const nodePath = id.replace(/_/g, '/');
      if (nodePath.endsWith(lastSeg + '.go') || nodePath.endsWith(lastSeg + '.js') || nodePath.endsWith(lastSeg + '.ts')) {
        return id;
      }
    }
  }
  // JS/TS relative imports
  if (imp.startsWith('.') || imp.startsWith('/')) {
    const resolved = path.resolve(currentDir, imp);
    const rel = path.relative(targetDir, resolved);
    const id = rel.replace(/[\/\\]/g, '_');
    // Try exact match, then with extensions
    if (allNodeIds.has(id)) return id;
    for (const ext of ['.js', '.ts', '.jsx', '.tsx', '.json']) {
      if (allNodeIds.has(id + ext.replace('.', '_'))) return id + ext.replace('.', '_');
    }
    // Try index.js in a directory
    const indexId = id + '_index.js';
    if (allNodeIds.has(indexId)) return indexId;
  }
  return null;
}

async function graphCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  console.log(`Building graph nodes and edges for ${targetDir}...`);

  const nodesDir = path.join(aiDir, 'graph', 'nodes');
  const edgesDir = path.join(aiDir, 'graph', 'edges');

  fs.mkdirSync(nodesDir, { recursive: true });
  fs.mkdirSync(edgesDir, { recursive: true });

  // Clear old nodes and edges
  for (const f of fs.readdirSync(nodesDir)) fs.unlinkSync(path.join(nodesDir, f));
  for (const f of fs.readdirSync(edgesDir)) {
    fs.unlinkSync(path.join(edgesDir, f));
  }

  const allFiles = walkDir(targetDir);
  const nodes = [];

  // First pass: create nodes
  for (const file of allFiles) {
    const relPath = path.relative(targetDir, file);
    const ext = path.extname(file);

    let fileType = 'file';
    let language = 'unknown';

    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      language = ext === '.ts' || ext === '.tsx' ? 'typescript' : 'javascript';
      fileType = 'source';
    } else if (ext === '.py') {
      language = 'python';
      fileType = 'source';
    } else if (ext === '.go') {
      language = 'go';
      fileType = 'source';
    } else if (path.basename(file) === 'package.json') {
      fileType = 'config';
    } else if (ext === '.json') {
      fileType = 'config';
    } else if (ext === '.md') {
      fileType = 'doc';
    }

    const node = {
      id: relPath.replace(/[\/\\]/g, '_'),
      type: fileType,
      path: relPath,
      language: language,
      imports: [],
      exports: []
    };

    nodes.push(node);
  }

  // Build a set of all node ids for import resolution
  const allNodeIds = new Set(nodes.map(n => n.id));

  // Second pass: parse imports/exports and create edges
  let edgeCount = 0;
  for (const node of nodes) {
    if (node.type !== 'source') continue;
    const filePath = path.join(targetDir, node.path);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    if (node.language === 'javascript' || node.language === 'typescript') {
      node.imports = parseJsImports(content);
      node.exports = parseJsExports(content);
    } else if (node.language === 'go') {
      node.imports = parseGoImports(content);
    }

    // Resolve imports to edges
    const currentDir = path.dirname(filePath);
    for (const imp of node.imports) {
      const targetId = resolveImport(imp, allNodeIds, currentDir, targetDir);
      if (targetId) {
        const edge = {
          from: node.id,
          to: targetId,
          type: 'import',
        };
        const edgeFile = `${node.id}__${targetId}.json`;
        fs.writeFileSync(path.join(edgesDir, edgeFile), JSON.stringify(edge, null, 2));
        edgeCount++;
      }
    }

    fs.writeFileSync(path.join(nodesDir, `${node.id}.json`), JSON.stringify(node, null, 2));
  }

  console.log(`Graph built successfully. ${nodes.length} nodes, ${edgeCount} edges.`);
}

module.exports = graphCommand;
