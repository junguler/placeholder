const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE_SIZE = 1024 * 1024; // 1MB - max size to include content
const EXCLUDE_PATTERNS = [
  /^\.git(\/|\\)/,
  /^node_modules(\/|\\)/,
  /^dist(\/|\\)/,
  /^\.github(\/|\\)workflows(\/|\\)/,
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.ttf', '.woff', '.woff2', '.eot',
]);

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const typeMap = {
    // Code
    '.js': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    
    // Web
    '.html': 'html', '.htm': 'html',
    '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    
    // Shell
    '.sh': 'shell', '.bash': 'shell',
    '.ps1': 'powershell',
    '.bat': 'batch', '.cmd': 'batch',
    
    // Markup
    '.md': 'markdown', '.markdown': 'markdown',
    '.yml': 'yaml', '.yaml': 'yaml',
    '.toml': 'toml',
    '.ini': 'ini',
    
    // Data
    '.sql': 'sql',
    '.csv': 'csv',
    
    // Other
    '.txt': 'text',
    '.log': 'log',
  };
  
  return typeMap[ext] || 'text';
}

function isBinary(filename) {
  const ext = path.extname(filename).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function shouldExclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(normalized));
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

function readFileContent(filePath) {
  try {
    const stats = fs.statSync(filePath);
    
    if (stats.size > MAX_FILE_SIZE) {
      return {
        content: null,
        error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
        size: stats.size
      };
    }
    
    if (isBinary(filePath)) {
      return {
        content: null,
        isBinary: true,
        size: stats.size
      };
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      content,
      size: stats.size,
      hash: getFileHash(content),
      lines: content.split('\n').length
    };
  } catch (error) {
    return {
      content: null,
      error: error.message,
      size: 0
    };
  }
}

function scanDirectory(dir, baseDir = dir) {
  const items = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      
      if (shouldExclude(relativePath)) {
        continue;
      }
      
      const stats = fs.statSync(fullPath);
      
      if (entry.isDirectory()) {
        const children = scanDirectory(fullPath, baseDir);
        items.push({
          name: entry.name,
          type: 'directory',
          path: relativePath,
          modified: stats.mtime.toISOString(),
          children: children,
          size: children.reduce((acc, child) => acc + (child.size || 0), 0)
        });
      } else if (entry.isFile()) {
        const fileData = readFileContent(fullPath);
        items.push({
          name: entry.name,
          type: 'file',
          path: relativePath,
          fileType: getFileType(entry.name),
          modified: stats.mtime.toISOString(),
          size: fileData.size,
          lines: fileData.lines,
          content: fileData.content,
          isBinary: fileData.isBinary || false,
          error: fileData.error,
          hash: fileData.hash
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
  console.log('Scanning repository...');
  const repoRoot = process.cwd();
  const structure = scanDirectory(repoRoot);
  
  const index = {
    generated: new Date().toISOString(),
    repository: path.basename(repoRoot),
    structure: structure
  };
  
  // Create dist directory
  const distDir = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }
  
  // Write index.json
  const indexPath = path.join(distDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✓ Generated ${indexPath}`);
  
  // Copy index.html to dist
  const htmlSource = path.join(repoRoot, 'index.html');
  const htmlDest = path.join(distDir, 'index.html');
  if (fs.existsSync(htmlSource)) {
    fs.copyFileSync(htmlSource, htmlDest);
    console.log(`✓ Copied index.html to dist/`);
  }
  
  // Print statistics
  const fileCount = countFiles(structure);
  const totalSize = calculateSize(structure);
  console.log(`\nStatistics:`);
  console.log(`  Files: ${fileCount}`);
  console.log(`  Total size: ${formatSize(totalSize)}`);
  console.log(`  Generated: ${new Date().toLocaleString()}`);
}

function countFiles(items) {
  let count = 0;
  for (const item of items) {
    if (item.type === 'file') {
      count++;
    } else if (item.type === 'directory') {
      count += countFiles(item.children);
    }
  }
  return count;
}

function calculateSize(items) {
  let size = 0;
  for (const item of items) {
    if (item.type === 'file') {
      size += item.size || 0;
    } else if (item.type === 'directory') {
      size += calculateSize(item.children);
    }
  }
  return size;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Run the script
generateIndex();