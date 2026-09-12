const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replacements
  if (content.includes("'qa_lead'")) {
    content = content.replace(/'qa_lead'/g, "'QA Lead'");
    changed = true;
  }
  if (content.includes('"qa_lead"')) {
    content = content.replace(/"qa_lead"/g, "'QA Lead'");
    changed = true;
  }
  
  if (content.includes("'qa_engineer'")) {
    content = content.replace(/'qa_engineer'/g, "'QA Tester'");
    changed = true;
  }
  if (content.includes('"qa_engineer"')) {
    content = content.replace(/"qa_engineer"/g, "'QA Tester'");
    changed = true;
  }
  
  if (content.includes('tester')) {
    content = content.replace(/===\s*'tester'/g, "=== 'QA Tester'");
    content = content.replace(/===\s*"tester"/g, "=== 'QA Tester'");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
