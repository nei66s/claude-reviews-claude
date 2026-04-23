const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Replace imports: from './file.js' -> from './file'
      const newContent = content.replace(/from\s+(['"])([^'"]+)\.js\1/g, (m, quote, path) => `from ${quote}${path}${quote}`);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Fixed: ${fullPath}`);
      }
    }
  });
}

walk('app/lib/agent');
console.log('Cleanup finished.');
