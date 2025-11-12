const fs = require('fs');
const path = require('path');

function buildTree(dir, basePath = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const tree = [];

  items.forEach(item => {
    const itemPath = path.join(dir, item.name);
    const relPath = path.join(basePath, item.name).replace(/\\/g, '/');

    // Skip hidden/system dirs and generated files
    if (item.name.startsWith('.') || ['.git', '.github', 'node_modules', 'generate_index.js', 'index.html', 'index.json'].includes(item.name)) {
      return;
    }

    if (item.isDirectory()) {
      tree.push({
        type: 'folder',
        name: item.name,
        path: relPath,
        children: buildTree(itemPath, relPath)
      });
    } else if (item.isFile()) {
      let content = null;
      try {
        const fileContent = fs.readFileSync(itemPath, 'utf8');
        // Assume text if it parses as UTF-8; else null (binary)
        content = fileContent;
      } catch (e) {
        // Binary file
        content = null;
      }
      tree.push({
        type: 'file',
        name: item.name,
        path: relPath,
        content: content,
        size: item.size  // For display
      });
    }
  });

  // Sort: folders first, then files alphabetically
  return tree.sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

const rootTree = { type: 'folder', name: '/', path: '', children: buildTree('.') };

// Write index.json
fs.writeFileSync('index.json', JSON.stringify(rootTree, null, 2));

// Generate index.html
const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repo File Manager</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; display: flex; height: 100vh; background: #f5f5f5; }
    #sidebar { width: 300px; border-right: 1px solid #ddd; overflow-y: auto; background: white; }
    #content { flex: 1; padding: 20px; overflow-y: auto; background: white; }
    .tree { padding-left: 20px; }
    .folder { cursor: pointer; font-weight: bold; }
    .folder.closed::before { content: '▶ '; }
    .folder.open::before { content: '▼ '; }
    .file { cursor: pointer; padding: 2px 0; }
    .file:hover, .folder:hover { background: #f0f0f0; }
    .selected { background: #e3f2fd; }
    .breadcrumb { margin-bottom: 10px; }
    .breadcrumb a { color: #1976d2; text-decoration: none; cursor: pointer; }
    .breadcrumb a:hover { text-decoration: underline; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    .binary { text-align: center; color: #666; }
    button { background: #1976d2; color: white; border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px; }
    button:hover { background: #1565c0; }
  </style>
</head>
<body>
  <div id="sidebar"></div>
  <div id="content">
    <div class="breadcrumb" id="breadcrumb"></div>
    <button onclick="loadIndex()">Refresh</button>
    <div id="preview"></div>
  </div>
  <script>
    let treeData = null;
    let currentPath = ['/'];

    async function loadIndex() {
      try {
        const res = await fetch('index.json');
        treeData = await res.json();
        renderTree(treeData, document.getElementById('sidebar'));
        updateBreadcrumbs();
        navigateToPath(currentPath.join('/'));
      } catch (e) {
        document.getElementById('preview').innerHTML = '<p>Error loading index.json</p>';
      }
    }

    function renderTree(node, container) {
      container.innerHTML = '';
      if (node.type === 'folder') {
        const div = document.createElement('div');
        div.className = 'folder ' + (currentPath.join('/').startsWith(node.path) ? 'open' : 'closed');
        div.textContent = node.name || '/';
        div.onclick = (e) => toggleFolder(e, node, div);
        container.appendChild(div);

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree';
        node.children.forEach(child => renderTree(child, childrenDiv));
        container.appendChild(childrenDiv);
      } else if (node.type === 'file') {
        const div = document.createElement('div');
        div.className = 'file';
        div.textContent = node.name;
        div.onclick = () => previewFile(node);
        container.appendChild(div);
      }
    }

    function toggleFolder(e, node, div) {
      e.stopPropagation();
      div.classList.toggle('open');
      div.classList.toggle('closed');
      const tree = div.nextElementSibling;
      tree.style.display = div.classList.contains('open') ? 'block' : 'none';
    }

    function updateBreadcrumbs() {
      const bc = document.getElementById('breadcrumb');
      bc.innerHTML = currentPath.map((p, i) => 
        i === currentPath.length - 1 
          ? p 
          : \`<a onclick="navigateToPath(\${currentPath.slice(0, i+1).join('/')})">\${p}</a> / \`
      ).join(' / ');
    }

    function navigateToPath(newPath) {
      currentPath = newPath === '' ? ['/'] : newPath.split('/').filter(Boolean);
      updateBreadcrumbs();
      // Re-render tree to highlight
      renderTree(treeData, document.getElementById('sidebar'));
      // Preview current dir/files (simplified)
      const preview = document.getElementById('preview');
      preview.innerHTML = '<h3>' + currentPath.join('/') + '</h3><p>Folder contents above.</p>';
      window.location.hash = currentPath.join('/');
    }

    function previewFile(file) {
      const preview = document.getElementById('preview');
      if (file.content) {
        preview.innerHTML = '<h3>' + file.name + '</h3><pre>' + escapeHtml(file.content) + '</pre>';
      } else {
        preview.innerHTML = '<h3>' + file.name + '</h3><div class="binary">Binary file. <a href="https://raw.githubusercontent.com/${{ github.repository }}/main/' + file.path + '" target="_blank">Download/View Raw</a></div>';
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Init
    window.addEventListener('load', loadIndex);
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1) || '/';
      navigateToPath(hash);
    });
  </script>
</body>
</html>`;

fs.writeFileSync('index.html', htmlTemplate);

console.log('Generated index.json and index.html');