import fs from 'fs';
const file = 'src/pages/Admin.tsx';
let content = fs.readFileSync(file, 'utf8');

// Ensure User is in the import list
if (content.includes('Trash2,') && !content.includes('  User,')) {
  content = content.replace('  Trash2,', '  Trash2,\n  User,');
}

fs.writeFileSync(file, content);
console.log('Successfully added User icon to Admin.tsx');
