const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('frontend');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<thead>')) {
    console.log(`\nFile: ${file}`);
    const regex = /<thead>([\s\S]*?)<\/thead>/gi;
    let match;
    let index = 1;
    while ((match = regex.exec(content)) !== null) {
      console.log(`  Table ${index++}:`);
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      let thMatch;
      const headers = [];
      while ((thMatch = thRegex.exec(match[1])) !== null) {
        headers.push(thMatch[1].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' '));
      }
      console.log(`    Headers: ${JSON.stringify(headers)}`);
    }
  }
});
