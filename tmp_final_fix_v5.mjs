import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// I'll search for {onFileUpload && ( and then find the corresponding closing )}
const search = '{onFileUpload && (';
const startIdx = content.indexOf(search);

if (startIdx !== -1) {
    // Find the next )} after the startIdx
    const nextClosing = content.indexOf(')}', startIdx);
    if (nextClosing !== -1) {
        // Now find the next </div> AFTER the nextClosing
        const nextDiv = content.indexOf('</div>', nextClosing);
        if (nextDiv !== -1 && (nextDiv - nextClosing) < 20) { // If it's very close, it's the misplaced one
            // Swap them: move the </div> before the )}
            const beforeClosing = content.substring(0, nextClosing);
            const afterClosing = content.substring(nextClosing + 2, nextDiv);
            const rest = content.substring(nextDiv + 6);
            content = beforeClosing + '</div>\n                                               )}' + rest;
            fs.writeFileSync(file, content);
            console.log('Successfully swapped </div> and )}');
        } else {
           console.log('Misplaced </div> not found close enough');
           // Maybe it's missing or already inside?
        }
    }
}
