const fs = require('fs');
const path = require('path');

const excludeFiles = ['.git', '.github', 'generate_index.js', 'index.html', 'files.json'];
const excludeExtensions = ['.exe', '.msi', '.bin', '.sh', '.bat'];

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const ext = path.extname(file).toLowerCase();

    if (excludeFiles.includes(file) || excludeExtensions.includes(ext)) return;

    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      fileList.push(filePath.replace(/\\/g, '/'));
    }
  });
  return fileList;
}

const allFiles = getFiles('./');
fs.writeFileSync('files.json', JSON.stringify(allFiles, null, 2));
console.log('✅ files.json generated with ' + allFiles.length + ' files.');