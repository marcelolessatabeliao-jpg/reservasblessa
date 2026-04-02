import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file has:
// {onFileUpload && ( <div ...> ... <Button ...> </Button> )} </div>
// We want:
// {onFileUpload && ( <div ...> ... <Button ...> </Button> </div> )}

// Find the line with )} followed by </div>
const pattern = /\}\)\s+<\/div>/;
if (pattern.test(content)) {
    content = content.replace(/\}\)\s+<\/div>/, '</div>\n                                               )}');
    fs.writeFileSync(file, content);
    console.log('Successfully moved </div> inside conditional block');
} else {
    console.error('Pattern not found');
    // Fallback: just search for the specific lines
    if (content.includes('</Button>\n                                                  )}')) {
        content = content.replace('</Button>\n                                                  )}', '</Button>\n                                                  </div>\n                                               )}');
        // And we need to remove the extra </div> that was at line 445
        // This is getting complex. Let's use a simpler regex.
    }
}
