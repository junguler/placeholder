const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['.git', '.github', 'node_modules'];
const EXCLUDE_FILES = ['generate_index.js', 'tree.json', 'index.html', 'package.json', 'package-lock.json'];
const EXECUTABLES = ['.exe', '.bat', '.sh', '.bin', '.dll', '.so', '.msi', '.cmd', '.app', '.pyc'];

function walk(dir, relativePath = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const relPath = path.join(relativePath, file).replace(/\\/g, '/');
        const stat = fs.statSync(filePath);
        
        if (stat && stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                const children = walk(filePath, relPath);
                results.push({ 
                    name: file, 
                    type: 'folder', 
                    path: relPath, 
                    children: children 
                });
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if (!EXCLUDE_FILES.includes(file) && !EXECUTABLES.includes(ext)) {
                results.push({ 
                    name: file, 
                    type: 'file', 
                    path: relPath, 
                    ext: ext,
                    size: stat.size 
                });
            }
        }
    });
    return results;
}

const tree = walk('.');
fs.writeFileSync('tree.json', JSON.stringify(tree, null, 2));
console.log('✅ tree.json generated.');