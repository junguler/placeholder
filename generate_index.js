const fs = require('fs');
const path = require('path');

const exclude = new Set(['.git', '.github', 'generate_index.js', 'index.html', 'files.json', 'node_modules']);
const excludeExt = new Set(['.exe', '.msi', '.bin', '.sh', '.bat', '.ds_store']);

function buildTree(dir) {
    const stats = fs.statSync(dir);
    const node = {
        name: path.basename(dir),
        path: dir.replace(/\\/g, '/').replace(/^\.\//, ''),
        type: stats.isDirectory() ? 'folder' : 'file',
        children: []
    };

    if (stats.isDirectory()) {
        const files = fs.readdirSync(dir);
        files.forEach(child => {
            if (exclude.has(child) || excludeExt.has(path.extname(child).toLowerCase())) return;
            node.children.push(buildTree(path.join(dir, child)));
        });
        // Sort: Folders first, then files alphabetically
        node.children.sort((a, b) => (b.type === 'folder') - (a.type === 'folder') || a.name.localeCompare(b.name));
    }
    return node;
}

const tree = buildTree('./');
// We only want the children of the root to avoid a redundant "root" folder
fs.writeFileSync('files.json', JSON.stringify(tree.children, null, 2));