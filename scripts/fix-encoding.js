const fs = require('fs');
const path = require('path');

const safeFixMap = {
  'Ã¶': 'ö',
  'Ã¼': 'ü',
  'Ã¤': 'ä',
  'ÃŸ': 'ß',
  'Ã–': 'Ö',
  'Ãœ': 'Ü',
  'Ã„': 'Ä',
  'â‚¬': '€',
  'Ã˜': 'Ø',
  'Ã—': '×',
  'ÃƒÂ¤': 'ä',
  'ÃƒÂ¼': 'ü',
  'ÃƒÂ¶': 'ö',
  'ÃƒÅ¸': 'ß',
  'Ã¢â€ €': '─'
};

const regex = new RegExp(Object.keys(safeFixMap).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

function fixEncodingInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixEncodingInDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.md')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;
      const newContent = content.replace(regex, match => {
        modified = true;
        return safeFixMap[match];
      });
        
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Fixed encoding in ${fullPath}`);
      }
    }
  }
}

fixEncodingInDir(path.join(__dirname, '..', 'src'));
