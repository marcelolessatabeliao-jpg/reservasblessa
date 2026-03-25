
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'integrations', 'supabase', 'types.ts');
try {
  const content = fs.readFileSync(file, 'utf16le');
  console.log(content.split('\n').slice(0, 100).join('\n'));
} catch (e) {
  console.log('Error reading file:', e);
}
