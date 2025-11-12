const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['.git', 'node_modules', '.github'];
const EXCLUDE_FILES = ['index.json', 'generate_index.js'];

function shouldExclude(filePath) {
  const baseName = path.basename(filePath);
  return EXCLUDE_DIRS.some(dir => filePath.includes('/' + dir + '/')) || 
         EXCLUDE_DIRS.includes(baseName) ||
         EXCLUDE_FILES.includes(baseName);
}

function getFileInfo(filePath) {
  const stats = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.isFile() ? stats.size : 0,
    extension: stats.isFile() ? path.extname(filePath).toLowerCase() : ''
  };
}

function buildTree(dirPath) {
  if (shouldExclude(dirPath)) return null;
  
  const info = getFileInfo(dirPath);
  
  if (info.type === 'directory') {
    const children = fs.readdirSync(dirPath)
      .map(child => buildTree(path.join(dirPath, child)))
      .filter(child => child !== null);
    
    info.children = children;
  }
  
  return info;
}

const rootPath = '.';
const tree = buildTree(rootPath);

if (tree) {
  fs.writeFileSync('index.json', JSON.stringify(tree, null, 2));
  console.log('index.json generated successfully');
} else {
  console.error('Failed to generate index.json');
  process.exit(1);
}