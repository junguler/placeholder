const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const EXCLUDE_PATTERNS = [
  '.git',
  '.github',
  'node_modules',
  'package-lock.json',
  'yarn.lock',
  '.DS_Store',
  'Thumbs.db'
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => 
    filePath.includes(path.sep + pattern) || 
    filePath.startsWith(pattern)
  );
}

function getGitLastModified(filePath) {
  try {
    const output = execSync(`git log -1 --format="%ct" -- "${filePath}"`, { encoding: 'utf8' });
    return parseInt(output.trim()) * 1000; // Convert to milliseconds
  } catch (e) {
    console.warn(`Warning: Could not get git timestamp for ${filePath}`);
    return Date.now();
  }
}

function buildFileTree(dirPath, relativePath = '') {
  const items = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name).replace(/\\/g, '/');

    if (shouldExclude(relPath)) continue;

    if (entry.isDirectory()) {
      items.push({
        type: 'directory',
        name: entry.name,
        path: relPath,
        children: buildFileTree(fullPath, relPath)
      });
    } else {
      const stats = fs.statSync(fullPath);
      items.push({
        type: 'file',
        name: entry.name,
        path: relPath,
        size: stats.size,
        lastModified: getGitLastModified(fullPath)
      });
    }
  }

  // Sort directories first, then alphabetically
  return items.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

// Generate index.json
const rootDir = '.';
const fileTree = buildFileTree(rootDir);

fs.writeFileSync(
  'index.json',
  JSON.stringify({ files: fileTree, generatedAt: new Date().toISOString() }, null, 2)
);

console.log('index.json generated successfully!');