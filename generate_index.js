const fs = require('fs');
const path = require('path');

// Directories and files to hide from the viewer
const EXCLUDE_DIRS = ['.git', '.github'];
const EXCLUDE_FILES = ['generate_index.js', 'tree.json', 'index.html'];

// Common executables to filter out
const EXECUTABLES = ['.exe', '.bat', '.sh', '.bin', '.dll', '.so', '.msi', '.cmd', '.app'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                const children = walk(filePath);
                if (children.length > 0) {
                    results.push({ name: file, type: 'folder', children: children });
                }
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if (!EXCLUDE_FILES.includes(file) && !EXECUTABLES.includes(ext)) {
                // Ensure paths use forward slashes for web compatibility
                results.push({ 
                    name: file, 
                    type: 'file', 
                    path: filePath.split(path.sep).join('/'),
                    ext: ext
                });
            }
        }
    });
    return results;
}

const tree = walk('.');
fs.writeFileSync('tree.json', JSON.stringify(tree, null, 2));
console.log('tree.json generated successfully.');