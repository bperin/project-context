const fs = require('fs');
const path = require('path');

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === '.git' || file === 'node_modules' || file === '.ai') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function graphCommand(options) {
  const targetDir = path.resolve(options.target);
  const aiDir = path.join(targetDir, options.workspace);

  console.log(`Building graph nodes and edges for ${targetDir}...`);

  const nodesDir = path.join(aiDir, 'graph', 'nodes');
  const edgesDir = path.join(aiDir, 'graph', 'edges');

  fs.mkdirSync(nodesDir, { recursive: true });
  fs.mkdirSync(edgesDir, { recursive: true });

  const allFiles = walkDir(targetDir);
  const nodes = [];

  for (const file of allFiles) {
    const relPath = path.relative(targetDir, file);
    const ext = path.extname(file);
    const topDir = relPath.split(path.sep)[0];

    let fileType = 'file';
    let language = 'unknown';

    if (ext === '.js' || ext === '.ts') {
      language = ext === '.ts' ? 'typescript' : 'javascript';
      fileType = 'source';
    } else if (ext === '.py') {
      language = 'python';
      fileType = 'source';
    } else if (ext === '.go') {
      language = 'go';
      fileType = 'source';
    } else if (file.endsWith('package.json')) {
      fileType = 'config';
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
    fs.writeFileSync(path.join(nodesDir, `${node.id}.json`), JSON.stringify(node, null, 2));
  }

  // Create a sample dependency edge if package.json exists
  if (fs.existsSync(path.join(targetDir, 'package.json'))) {
    const edge = {
      from: 'package.json',
      to: 'bin_cli.js',
      type: 'configuration'
    };
    fs.writeFileSync(path.join(edgesDir, 'pkg-to-cli.json'), JSON.stringify(edge, null, 2));
  }

  console.log(`Graph built successfully. Generated ${nodes.length} nodes.`);
}

module.exports = graphCommand;
