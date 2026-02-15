const fs = require('fs');
const path = require('path');

const EXCLUDED_EXTENSIONS = new Set([
  '.exe', '.msi', '.dll', '.so', '.dylib', '.bin', '.com', '.cmd', '.bat',
  '.ps1', '.scr', '.pif', '.gadget', '.hta', '.cpl', '.msc', '.jar',
  '.wsf', '.wsh', '.ws', '.vbs', '.vbe', '.js_', '.jse', '.shb',
  '.shs', '.sys', '.drv', '.ocx', '.ax', '.acm', '.mui',
  '.appimage', '.deb', '.rpm', '.snap', '.flatpak',
  '.apk', '.aab', '.ipa', '.xap',
  '.class', '.pyc', '.pyo', '.o', '.obj', '.a', '.lib', '.ko',
  '.elf', '.out',
]);

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', '_site', '.github',
]);

const EXCLUDED_FILES = new Set([
  'generate_index.js', 'index.html', 'CNAME',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico',
  '.tiff', '.tif', '.avif', '.jfif',
]);

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus', '.webm',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.ogv', '.avi', '.mov', '.mkv', '.m4v', '.3gp',
]);

const PDF_EXTENSIONS = new Set(['.pdf']);

const FONT_EXTENSIONS = new Set([
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

const BINARY_NON_PREVIEW = new Set([
  '.zip', '.gz', '.tar', '.bz2', '.7z', '.rar', '.xz', '.zst',
  '.iso', '.img', '.dmg', '.vhd', '.vmdk',
  '.db', '.sqlite', '.sqlite3', '.mdb',
  '.dat', '.sav',
]);

function getFileType(ext) {
  ext = ext.toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  if (FONT_EXTENSIONS.has(ext)) return 'font';
  if (BINARY_NON_PREVIEW.has(ext)) return 'binary';
  return 'text';
}

function isTextFile(filePath) {
  try {
    const buffer = Buffer.alloc(8192);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);
    if (bytesRead === 0) return true;
    let nullCount = 0;
    for (let i = 0; i < bytesRead; i++) {
      const byte = buffer[i];
      if (byte === 0) nullCount++;
      if (nullCount > 1) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function walkDir(dir, baseDir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walkDir(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDED_EXTENSIONS.has(ext)) continue;

      const stats = fs.statSync(fullPath);
      let type = getFileType(ext);

      if (type === 'text' && !isTextFile(fullPath)) {
        type = 'binary';
      }

      results.push({
        path: relativePath,
        name: entry.name,
        size: stats.size,
        type: type,
        ext: ext || '(none)',
        dir: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath),
        modified: stats.mtime.toISOString(),
      });
    }
  }

  return results;
}

// Build the file index
const rootDir = process.cwd();
const files = walkDir(rootDir, rootDir);

// Create _site directory
const siteDir = path.join(rootDir, '_site');
if (!fs.existsSync(siteDir)) {
  fs.mkdirSync(siteDir, { recursive: true });
}

// Write file index
fs.writeFileSync(
  path.join(siteDir, 'file_index.json'),
  JSON.stringify(files, null, 2)
);

// Copy index.html
fs.copyFileSync(
  path.join(rootDir, 'index.html'),
  path.join(siteDir, 'index.html')
);

// Copy all indexed files maintaining directory structure
for (const file of files) {
  const src = path.join(rootDir, file.path);
  const dest = path.join(siteDir, file.path);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

console.log(`Indexed ${files.length} files.`);
console.log(`Site built in _site/`);