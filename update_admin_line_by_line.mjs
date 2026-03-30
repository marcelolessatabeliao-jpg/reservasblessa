import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Update fetchData parsing logic
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const timeMatch = searchStr.match(/(\\d{2}[:H]\\d{2})/);')) {
        lines[i] = `                   // Try regex first (e.g., 9:00, 09:00, 9H00, 09H00)
                   const timeMatch = searchStr.match(/(\\d{1,2}[:H]\\d{2})/);
                   let finalSlot = null;
                   
                   if (timeMatch) {
                     let raw = timeMatch[1].replace('H', ':');
                     if (raw.length === 4) raw = '0' + raw; // Auto-pad (9:00 -> 09:00)
                     finalSlot = raw;
                   }`;
        // Remove the next line which was the old finalSlot assignment
        if (lines[i+1] && lines[i+1].includes('let finalSlot = timeMatch')) {
            lines.splice(i+1, 1);
        }
        console.log('Updated fetchData parsing logic.');
        break;
    }
}

// Update Quad table display
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('r.time_slot') && lines[i-1] && lines[i-1].includes('SelectContent')) {
        lines[i] = `                                      <>
                                        {r.time_slot === 'INDIV' && <span className="text-amber-600 font-extrabold flex items-center gap-1 underline underline-offset-2">HORÁRIO NÃO DEFINIDO</span>}
                                        {r.time_slot === 'DUPLA' && <span className="text-blue-600 font-extrabold">DUPLA (AGUARDANDO HORA)</span>}
                                        {r.time_slot !== 'INDIV' && r.time_slot !== 'DUPLA' && r.time_slot}
                                      </>`;
        console.log('Updated Quad table display.');
        break;
    }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Admin update complete via line substitution.');
