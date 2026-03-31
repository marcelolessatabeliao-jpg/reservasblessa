import fs from 'fs';
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');
const lines = data.split('\n');

const startIndex = lines.findIndex((l, i) => i > 940 && l.trim() === '</table>');
console.log('Context around line', startIndex);
if (startIndex !== -1) {
  for (let i = startIndex - 5; i <= startIndex + 10; i++) {
    console.log(`${i}: ${lines[i]}`);
  }
} else {
  console.log('Could not find </table> after line 940');
  for (let i = 950; i <= 960; i++) {
    console.log(`${i}: ${lines[i]}`);
  }
}
