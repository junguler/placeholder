#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const DEFAULT_OUTPUT = 'index.json';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args._[0] ? path.resolve(args._[0]) : process.cwd();
  const output = args.output || DEFAULT_OUTPUT;

  if (args.help || args.h) {
    printHelp();
    process.exit(0);
  }

  const {
    include = [],
    exclude = [
      '**/.git/**',
      '**/node_modules/**',
      '**/bower_components/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/.*',
      'index.json',
      'deploy.yml'
    ],
    includeFileLimitBytes = 2 * 1024 * 1024, // 2 MiB
    reportSizeLimitBytes = 5 * 1024 * 1024,  // 5 MiB
    preserveUnknownExtAsText = false
  } = normalizeGlobLists(args);

  const index = {
    version: 1,
    repo: {},
    tree: null,
    files: [],
    generatedAt: new Date().toISOString()
  };

  // Build filters
  const includeMatchers = include.map(g => minimatchToRegExp(g));
  const excludeMatchers = exclude.map(g => minimatchToRegExp(g));

  async function walk(dir, base = root) {
    const name = await fsp.readdir(dir, { withFileTypes: true });
    const entries = [];

    for (const ent of name) {
      const abs = path.join(dir, ent.name);
      const rel = toPosix(path.relative(root, abs));

      // Exclude by .gitignore-like patterns
      if (rel === '' || rel.startsWith('.git/')) continue;
      if (matchAny(rel, excludeMatchers)) continue;
      if (includeMatchers.length && !matchAny(rel, includeMatchers)) continue;

      try {
        if (ent.isDirectory()) {
          entries.push({
            type: 'dir',
            name: ent.name,
            path,
            children: await walk(abs, base)
          });
        } else if (ent.isFile()) {
          const st = await fsp.stat(abs);
          const { type, textPreview, detectedText, size } = await inspectFile(abs, st, {
            includeFileLimitBytes,
            reportSizeLimitBytes,
            preserveUnknownExtAsText
          });
          entries.push({
            type,
            name: ent.name,
            path,
            size,
            textPreview,
            detectedText
          });
        } else {
          // Skip symlinks, sockets, etc.
        }
      } catch (e) {
        // Ignore files we can't access
      }
    }

    // Sort: dirs first by name (case-insensitive), then files
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return entries;
  }

  // Root entry (/)
  const rootChildren = await walk(root);
  index.tree = {
    type: 'dir',
    name: '/',
    path: '',
    children: rootChildren
  };

  // Flatten files for convenience
  index.files = [];
  function flatten(nodes, prefixPath = '') {
    for (const n of nodes || []) {
      const currentPath = prefixPath ? `${prefixPath}/${n.name}` : n.name;
      if (n.type === 'file') {
        index.files.push({
          path: toPosix(currentPath),
          size: n.size,
          textPreview: n.textPreview,
          detectedText: n.detectedText
        });
      } else if (n.type === 'dir') {
        flatten(n.children, currentPath);
      }
    }
  }
  flatten(rootChildren, '');

  await fsp.writeFile(output, JSON.stringify(index, null, 2), 'utf8');
  console.log(`Wrote ${output} (${index.files.length} files)`);
}

function printHelp() {
  console.log(`generate_index.js

Usage:
  node generate_index.js [options] [rootDir]

Options:
  --output <file>           Output JSON path (default: index.json)
  --include <globs...>      Only include files matching these globs
  --exclude <globs...>      Exclude files matching these globs (defaults provided)
  --include-file-limit <n>  Max bytes to read for preview (default: 2097152)
  --report-size-limit <n>   Max bytes to report as size (default: 5242880)
  --preserve-unknown-ext    Treat unknown extensions as text

Examples:
  node generate_index.js
  node generate_index.js --output index.json --include 'src/**' '*.md'
  node generate_index.js --exclude '**/vendor/**' '**/*.png'
`);
}

// Helpers

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output' || a === '-o') {
      args.output = argv[++i];
    } else if (a === '--include') {
      args.include = [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.include.push(argv[++i]);
      }
    } else if (a === '--exclude') {
      args.exclude = [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.exclude.push(argv[++i]);
      }
    } else if (a === '--include-file-limit') {
      args.includeFileLimitBytes = parseSize(argv[++i]);
    } else if (a === '--report-size-limit') {
      args.reportSizeLimitBytes = parseSize(argv[++i]);
    } else if (a === '--preserve-unknown-ext' || a === '--preserve-unknown-ext-as-text') {
      args.preserveUnknownExtAsText = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    } else if (!a.startsWith('--')) {
      args._.push(a);
    }
  }
  return args;
}

function parseSize(v) {
  if (!v) return undefined;
  const m = String(v).match(/^(\d+)\s*(b|bytes|k|kb|m|mb)?$/i);
  if (!m) return Number(v) || undefined;
  const n = parseInt(m[1], 10);
  const u = (m[2] || 'b').toLowerCase();
  const scale = u.startsWith('m') ? 1024 * 1024 : u.startsWith('k') ? 1024 : 1;
  return n * scale;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function minimizeLeadingSlash(p) {
  return p.replace(/^\/+/, '');
}

function matchAny(relPath, patterns) {
  return patterns.some(rx => rx.test(relPath));
}

function globToRegex(glob) {
  // Very small glob-to-regex implementation (no negation)
  let rx = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') rx += '.*';
    else if (c === '?') rx += '.';
    else if (c === '.') rx += '\\.';
    else if (c === '/') rx += '\\/';
    else rx += c.replace(/[\\^$+{}()|[\]]/g, '\\$&');
  }
  rx += '$';
  return new RegExp(rx);
}

function minimatchToRegExp(glob) {
  // Convert /**/ to .*? (non-greedy)
  const normalized = glob
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '(?:.*)?');
  return globToRegex(normalized);
}

const TEXT_EXTS = new Set([
  'txt','md','markdown','json','js','mjs','cjs','ts','tsx','jsx','css','scss','less',
  'html','htm','xml','yml','yaml','toml','ini','cfg','conf','sh','bash','zsh','fish',
  'bat','ps1','py','rb','go','rs','java','kt','kts','scala','php','c','h','hpp','hh','cpp','cc','cxx','hxx',
  'sql','r','R','jl','pl','lua','hs','nim','dart','dockerfile','docker','makefile','mk','cmake','gradle','properties'
]);

function isLikelyTextExt(ext) {
  if (!ext) return false;
  return TEXT_EXTS.has(ext.toLowerCase());
}

async function inspectFile(absPath, st, opts) {
  const { includeFileLimitBytes, reportSizeLimitBytes, preserveUnknownExtAsText } = opts;
  const size = st.size;
  const ext = (path.extname(absPath || '').slice(1) || '').toLowerCase();

  let detectedText = isLikelyTextExt(ext);
  let textPreview = null;

  if (size <= includeFileLimitBytes) {
    try {
      const buf = await fsp.readFile(absPath);
      // Null byte indicates binary
      if (buf.indexOf(0) === -1) {
        const sample = buf.slice(0, Math.min(buf.length, 256 * 1024));
        const start = sample.toString('utf8');
        detectedText = detectedText || looksLikeText(start);
        if (detectedText) {
          const all = buf.toString('utf8');
          textPreview = all.length <= includeFileLimitBytes ? all : all.slice(0, includeFileLimitBytes);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return {
    type: (detectedText && textPreview) ? 'file' : 'file',
    textPreview: (detectedText && textPreview) ? textPreview : undefined,
    detectedText: detectedText || (preserveUnknownExtAsText ? true : false),
    size: size <= reportSizeLimitBytes ? size : reportSizeLimitBytes
  };
}

function looksLikeText(s) {
  if (!s) return false;
  // If contains a lot of common printable characters and not too many nulls/controls
  const printable = (s.match(/[\x20-\x7E\t\r\n]/g) || []).length;
  const ratio = printable / Math.max(1, s.length);
  return ratio > 0.7;
}

// Run
main().catch(err => {
  console.error(err);
  process.exit(1);
});