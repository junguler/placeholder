#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REPO_ROOT = process.cwd();
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const INDEX_JSON_PATH = path.join(DIST_DIR, 'index.json');
const INDEX_HTML_SRC = path.join(REPO_ROOT, 'index.html');
const INDEX_HTML_DST = path.join(DIST_DIR, 'index.html');

// Config
const MAX_INLINE_FILE_SIZE = 200 * 1024; // 200 KB per file
const MAX_TOTAL_INLINE_SIZE = 8 * 1024 * 1024; // 8 MB total

// Directories/files to ignore from indexing
const IGNORE_NAMES = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  '.next',
  '.cache',
  '.DS_Store'
]);

// Binary-like extensions: don't inline as text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico',
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.flac',
  '.pdf',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so'
]);

// Media to copy so browser can preview them
const MEDIA_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico',
  '.mp4', '.webm', '.ogg', '.mov',
  '.mp3', '.wav', '.flac'
]);

let totalInlinedBytes = 0;

function isIgnored(name, relPath) {
  if (IGNORE_NAMES.has(name)) return true;
  if (relPath.startsWith('dist' + path.sep)) return true;
  return false;
}

function isBinaryByExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function isMediaFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

function looksTextual(buffer) {
  const len = Math.min(buffer.length, 4096);
  let controlCount = 0;
  for (let i = 0; i < len; i++) {
    const c = buffer[i];
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c === 127) controlCount++;
  }
  return controlCount / len < 0.05;
}

function ensureDistDirFor(relPath) {
  const outPath = path.join(DIST_DIR, relPath);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return outPath;
}

function copyMediaIfNeeded(fullPath, relPath) {
  if (!isMediaFile(relPath)) return;
  const outPath = ensureDistDirFor(relPath);
  fs.copyFileSync(fullPath, outPath);
}

function readFileForPreview(fullPath, relPath) {
  const rel = relPath.replace(/\\/g, '/');

  try {
    const stat = fs.statSync(fullPath);
    const size = stat.size;

    const info = {
      path: rel,
      size,
      previewable: false,
      content: null
    };

    // Always copy media files into dist so they can be served
    copyMediaIfNeeded(fullPath, rel);

    if (size === 0) {
      info.previewable = true;
      info.content = '';
      return info;
    }

    if (size > MAX_INLINE_FILE_SIZE) {
      return info;
    }

    if (totalInlinedBytes + size > MAX_TOTAL_INLINE_SIZE) {
      return info;
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
      path: rel,
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
  }

  // Directories first, then files, alphabetical
  children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return children;
}

function main() {
  console.log('Generating index.json and preparing dist/...');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  if (!fs.existsSync(INDEX_HTML_SRC)) {
    console.error('ERROR: index.html not found in repo root.');
    process.exit(1);
  }

  // Copy entry HTML
  fs.copyFileSync(INDEX_HTML_SRC, INDEX_HTML_DST);

  const tree = {
    type: 'directory',
    name: '',
    path: '',
    children: buildTree(REPO_ROOT, '')
  };

  fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(tree, null, 2), 'utf8');

  console.log(`Created: ${INDEX_JSON_PATH}`);
  console.log('Done. dist/ is ready for deployment.');
}

main();