const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (file === 'routeTree.gen.ts') continue;
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(/\"\/app/g, '"/accueil').replace(/\'\/app/g, "'/accueil");
      fs.writeFileSync(fullPath, content);
    }
  }
}

processDir('src/components');
processDir('src/routes');
