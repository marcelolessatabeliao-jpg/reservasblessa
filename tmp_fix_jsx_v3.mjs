import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use a simple, robust regex to move the Button inside the preceding div.
// We look for a line ending with </div> and then a Button.
// The view showed:
// 421:                                                    </div> 
// 422:                                                    <Button 
content = content.replace(/<\/div>\s*<Button/g, '<Button');
content = content.replace(/<\/Button>\s*<\/div>/g, '</Button>\n                                                    </div>');
// Wait, that's ambiguous. Let's be better.

content = fs.readFileSync(file, 'utf8'); // Reload to be safe
content = content.replace(/<\/div>(\s+)<Button/g, '$1  <Button');
content = content.replace(/<\/Button>(\s+)\}/g, '</Button>\n$1</div>\n$1}');

fs.writeFileSync(file, content);
console.log('Successfully patched JSX with node');
