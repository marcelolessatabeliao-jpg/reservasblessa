import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use a more robust regex to find the problematic conditional block
// and wrap it in a fragment.
// We look for {onFileUpload && ( followed by the div and then the button up to the closing )}
const pattern = /\{onFileUpload && \(\s+<div className="flex items-center gap-2">[\s\S]+?<\/Button>\s+\)\}/;
const match = content.match(pattern);

if (match) {
    let replaced = match[0];
    // Insert <> after (
    replaced = replaced.replace('{onFileUpload && (', '{onFileUpload && (<>');
    // Insert </> before )}
    replaced = replaced.replace(')}', '</>\n)}');
    content = content.replace(match[0], replaced);
    fs.writeFileSync(file, content);
    console.log('Successfully patched JSX with fragment via regex');
} else {
    console.error('Could not find the problematic block with regex');
    // Fallback: search for specific line parts
    const startPart = '{onFileUpload && (';
    const endPart = ')}';
    const startIdx = content.indexOf(startPart);
    if (startIdx !== -1) {
        const nextClosing = content.indexOf(endPart, startIdx);
        if (nextClosing !== -1) {
            const inner = content.substring(startIdx + startPart.length, nextClosing);
            content = content.substring(0, startIdx + startPart.length) + '<>' + inner + '</>' + content.substring(nextClosing);
            fs.writeFileSync(file, content);
            console.log('Successfully patched JSX with fragment via fallback substring');
        }
    }
}
