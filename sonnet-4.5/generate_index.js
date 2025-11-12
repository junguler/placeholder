const fs = require('fs');
const path = require('path');

const IGNORE_PATTERNS = [
  '.git',
  'node_modules',
  '.github',
  'generate_index.js',
  'index.json',
  '.gitignore',
  '.DS_Store'
];

const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx',
  '.mp3', '.mp4', '.avi', '.mov',
  '.ttf', '.woff', '.woff2', '.eot'
];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

function shouldIgnore(name) {
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.startsWith('.')) {
      return name === pattern;
    }
    return name.includes(pattern);
  });
}

function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const typeMap = {
    '.js': 'javascript',
    '.json': 'json',
    '.html': 'html',
    '.css': 'css',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.sql': 'sql',
    '.xml': 'xml',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.sh': 'bash',
    '.txt': 'text',
  };
  
  return typeMap[ext] || 'text';
}

function readFileContent(filePath) {
  try {
    const stats = fs.statSync(filePath);
    
    if (stats.size > MAX_FILE_SIZE) {
      return {
        error: 'File too large',
        message: `File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: 1MB)`
      };
    }
    
    if (isBinaryFile(filePath)) {
      return {
        error: 'Binary file',
        message: 'Binary files cannot be previewed'
      };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return { content };
  } catch (error) {
    return {
      error: 'Read error',
      message: error.message
    };
  }
}

function scanDirectory(dir, baseDir = dir) {
  const items = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (shouldIgnore(entry.name)) {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        const children = scanDirectory(fullPath, baseDir);
        items.push({
          name: entry.name,
          type: 'directory',
          path: relativePath.replace(/\\/g, '/'),
          children: children
        });
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        const fileData = readFileContent(fullPath);
        
        items.push({
          name: entry.name,
          type: 'file',
          path: relativePath.replace(/\\/g, '/'),
          size: stats.size,
          modified: stats.mtime.toISOString(),
          language: getFileType(fullPath),
          ...fileData
        });
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
  
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function generateIndex() {
  console.log('Generating index.json...');
  
  const rootDir = process.cwd();
  const fileTree = scanDirectory(rootDir);
  
  const index = {
    generated: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || 'Unknown Repository',
    branch: process.env.GITHUB_REF_NAME || 'main',
    tree: fileTree
  };
  
  fs.writeFileSync('index.json', JSON.stringify(index, null, 2));
  console.log('index.json generated successfully!');
  console.log(`Total items: ${countItems(fileTree)}`);
}

function countItems(tree) {
  let count = 0;
  for (const item of tree) {
    count++;
    if (item.type === 'directory' && item.children) {
      count += countItems(item.children);
    }
  }
  return count;
}

generateIndex();