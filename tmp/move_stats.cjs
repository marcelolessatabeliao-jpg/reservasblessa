const fs = require('fs');
const path = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');
let lines = data.split('\r\n');
if (lines.length === 1) lines = data.split('\n');

// Find the STATS block
let statsStart = lines.findIndex(l => l.includes('{/* STATS IN HEADER */}'));
let statsEnd = -1;
// Search for the closing div of the stats container (approx 1503 in last view)
for (let i = statsStart + 1; i < lines.length; i++) {
    if (lines[i].includes('              </div>') && (i - statsStart > 50)) {
        statsEnd = i;
        break;
    }
}

if (statsStart !== -1 && statsEnd !== -1) {
    console.log(`Moving stats from ${statsStart} to ${statsEnd}`);
    const statsLines = lines.splice(statsStart, statsEnd - statsStart + 2); // +2 to catch the gap
    
    // Find where to insert (after mobile buttons container, before desktop buttons)
    // Mobile buttons end at /div on 1424. Desktop buttons start after.
    // Let's find "DESKTOP BUTTONS"
    let insertIdx = lines.findIndex(l => l.includes('{/* DESKTOP BUTTONS (RIGHT) */}'));
    if (insertIdx !== -1) {
        console.log(`Inserting at ${insertIdx}`);
        lines.splice(insertIdx, 0, ...statsLines);
    }
}

fs.writeFileSync(path, lines.join('\r\n'));
console.log('Admin.tsx header layout updated!');
