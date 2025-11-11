#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const INDEX_JSON_PATH = path.join(DIST_DIR, 'index.json');
const INDEX_HTML_SRC = path.join(REPO_ROOT, 'index.html');
const INDEX_HTML_DST = path.join(DIST_DIR, 'index.html');

// Config
const MAX_INLINE_FILE_SIZE = 200 * 1024; // 200 KB
const MAX_TOTAL_INLINE_SIZE = 8 * 1024 * 1024; // 8 MB cap for safety

// Directories/files to ignore in the index
const IGNORE_NAMES = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  '.next',
  '.cache',
  '.DS_Store'
]);

// File extensions we treat as "binary" or non-text-ish for preview
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.flac',
  '.pdf',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so'
]);

let totalInlinedBytes = 0;

function isIgnored(name, relPath) {
  if (IGNORE_NAMES.has(name)) return true;
  // Skip dist output except when explicitly building it
  if (relPath.startsWith('dist' + path.sep)) return true;
  return false;
}

function isBinaryByExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function looksTextual(buffer) {
  // Simple heuristic: if it contains many control chars, treat as binary
  const len = Math.min(buffer.length, 4096);
  let controlCount = 0;
  for (let i = 0; i < len; i++) {
    const c = buffer[i];
    if (c === 9 || c === 10 || c === 13) continue; // whitespace
    if (c < 32 || c === 127) controlCount++;
  }
  return controlCount / len < 0.05;
}

function readFileForPreview(fullPath, relPath) {
  try {
    const stat = fs.statSync(fullPath);
    const size = stat.size;

    const info = {
      path: relPath.replace(/\\/g, '/'),
      size,
      previewable: false,
      content: null
    };

    if (size === 0) {
      info.previewable = true;
      info.content = '';
      return info;
    }

    if (size > MAX_INLINE_FILE_SIZE) {
      return info; // too large to inline
    }

    if (totalInlinedBytes + size > MAX_TOTAL_INLINE_SIZE) {
      return info; // global cap hit
    }

    if (isBinaryByExtension(fullPath)) {
      return info;
    }

    const buffer = fs.readFileSync(fullPath);

    if (!looksTextual(buffer)) {
      return info;
    }

    const text = buffer.toString('utf8');

    info.previewable = true;
    info.content = text;
    totalInlinedBytes += size;

    return info;
  } catch (err) {
    console.error(`Failed to read file for preview: ${fullPath}`, err);
    return {
      path: relPath.replace(/\\/g, '/'),
      size: null,
      previewable: false,
      content: null
    };
  }
}

function buildTree(dir, baseRel = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const children = [];

  for (const entry of entries) {
    const name = entry.name;
    const relPath = baseRel ? path.join(baseRel, name) : name;

    if (isIgnored(name, relPath)) continue;

    const fullPath = path.join(dir, name);

    if (entry.isDirectory()) {
      const child = {
        type: 'directory',
        name,
        path: relPath.replace(/\\/g, '/'),
        children: buildTree(fullPath, relPath)
      };
      children.push(child);
    } else if (entry.isFile()) {
      const fileInfo = readFileForPreview(fullPath, relPath);
      children.push({
        type: 'file',
        name,
        path: fileInfo.path,
        size: fileInfo.size,
        previewable: fileInfo.previewable,
        content: fileInfo.previewable ? fileInfo.content : null
      });
    }
    // symlinks etc. are skipped for simplicity
  }

  // Sort like a typical file manager: folders first, then files, alphabetical
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return children;
}

function main() {
  console.log('Generating index.json...');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Copy index.html into dist
  if (!fs.existsSync(INDEX_HTML_SRC)) {
    console.error('ERROR: index.html not found in repo root.');
    process.exit(1);
  }
  fs.copyFileSync(INDEX_HTML_SRC, INDEX_HTML_DST);

  const tree = {
    type: 'directory',
    name: '',
    path: '',
    children: buildTree(REPO_ROOT, '')
  };

  fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(tree, null, 2), 'utf8');

  console.log(`index.json generated at ${INDEX_JSON_PATH}`);
  console.log('Build complete: dist/');
}

main();