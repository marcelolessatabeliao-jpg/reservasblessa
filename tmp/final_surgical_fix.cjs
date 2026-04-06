const fs = require('fs');

const adminPath = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx';
let lines = fs.readFileSync(adminPath, 'utf8').split('\n');

// Line 1444 (1-indexed is index 1443)
const targetIndex = 1443;
if (lines[targetIndex] && lines[targetIndex].includes('INDIV')) {
    lines[targetIndex] = lines[targetIndex].replace(/HORí RIO NíƒÆ’O DEFINIDO/g, 'HORÁRIO NÃO DEFINIDO');
    fs.writeFileSync(adminPath, lines.join('\n'), 'utf8');
    console.log("Line 1444 fixed!");
} else {
    console.log("Could not find target string on line 1444, searching throughout...");
    let fixed = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('HORí RIO')) {
            lines[i] = lines[i].replace(/HORí RIO NíƒÆ’O DEFINIDO/g, 'HORÁRIO NÃO DEFINIDO');
            fixed = true;
        }
    }
    if (fixed) {
        fs.writeFileSync(adminPath, lines.join('\n'), 'utf8');
        console.log("Target string fixed elsewhere!");
    }
}
