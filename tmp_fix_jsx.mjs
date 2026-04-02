import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// The problematic block starts with {onFileUpload && (
const searchStart = '{onFileUpload && (';
const startIdx = content.indexOf(searchStart);

if (startIdx !== -1) {
    // We want to insert <> right after (
    const insertAfterIdx = startIdx + searchStart.length;
    content = content.slice(0, insertAfterIdx) + '<>' + content.slice(insertAfterIdx);
    
    // Now we need to find the matching closing ) for that block. 
    // Given the view_file, it was around line 444 before. 
    // We'll search for the specific closing sequence.
    const searchEnd = '</Button>\n                                                  )}';
    // Let's use a more robust search for the closing of the Button and then the }
    const endMatch = content.match(/<\/Button>\s*\}\)/);
    if (endMatch) {
       content = content.replace(/<\/Button>(\s*)\}\)/, '</Button>$1</>\n)}');
       fs.writeFileSync(file, content);
       console.log('Successfully patched JSX with fragment');
    } else {
        // Fallback: search for the next )} after the startIdx
        const nextClosing = content.indexOf(')}', insertAfterIdx);
        if (nextClosing !== -1) {
            content = content.slice(0, nextClosing) + '</>' + content.slice(nextClosing);
            fs.writeFileSync(file, content);
            console.log('Successfully patched JSX with fragment (fallback)');
        } else {
            console.error('Could not find closing sequence');
        }
    }
} else {
    console.error('Could not find start which is onFileUpload && (');
}
