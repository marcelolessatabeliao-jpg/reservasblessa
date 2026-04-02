import fs from 'fs';

const path = 'src/pages/Admin.tsx';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// 1. Remove the extra brace at line 578 (577 in 0-indexed)
// Let's verify it IS a lone brace
if (lines[577].trim() === '};' && lines[576].trim() === '};') {
    lines.splice(577, 1);
}

// 2. Fix the ternary in the UI
// Look for where handleCreateInternalBooking button is
const btnIdx = lines.findIndex(l => l.includes('onClick={handleCreateInternalBooking}'));
if (btnIdx !== -1) {
    // We need to find the next </div> after the button
    let divEnd = -1;
    for (let i = btnIdx; i < lines.length; i++) {
        if (lines[i].includes('</Button>')) {
             // The next </div> should be the one for SECTION 5
             for (let j = i; j < lines.length; j++) {
                 if (lines[j].includes('</div>')) {
                     divEnd = j;
                     break;
                 }
             }
             break;
        }
    }
    if (divEnd !== -1 && !lines.slice(btnIdx, divEnd + 5).some(l => l.includes(')}'))) {
        lines.splice(divEnd, 0, '                        )}');
    }
}

fs.writeFileSync(path, lines.join('\n'));
console.log("FINAL SYNTAX FIX COMPLETE.");
