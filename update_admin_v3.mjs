import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replacement for the parsing logic (fetchData)
const regex1 = /const timeMatch = searchStr\.match\(\/\\(\\d\{2\}[:H]\\d\{2\}\)\/\);[\s\n\r]*let finalSlot = timeMatch \? timeMatch\[1\]\.replace\('H', ':'\) : null;/;
const replacement1 = `// Try regex first (e.g., 9:00, 09:00, 9H00, 09H00)
                   const timeMatch = searchStr.match(/(\\d{1,2}[:H]\\d{2})/);
                   let finalSlot = null;
                   
                   if (timeMatch) {
                     let raw = timeMatch[1].replace('H', ':');
                     if (raw.length === 4) raw = '0' + raw; // Auto-pad (9:00 -> 09:00)
                     finalSlot = raw;
                   }`;

// Replacement for the table display (renderQuadTab)
const regex2 = /\{isEditing \? \([\s\n\r]*<Select value=\{editData\.time_slot\} onValueChange=\{v => setEditData\(\{\.\.\.editData, time_slot: v\}\)\}>[\s\n\r]*<SelectTrigger className="h-6 text-\[10px\]"><SelectValue \/><\/SelectTrigger>[\s\n\r]*<SelectContent>\{QUAD_TIMES\.map\(t => <SelectItem key=\{t\} value=\{t\}>\{t\}<\/SelectItem>\)\}<\/SelectContent>[\s\n\r]*<\/Select>[\s\n\r]*\) : r\.time_slot\}/;
const replacement2 = `{isEditing ? (
                                      <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                         <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                         <SelectContent>{QUAD_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                      </Select>
                                    ) : (
                                      <>
                                        {r.time_slot === 'INDIV' && <span className="text-amber-600 font-extrabold flex items-center gap-1 underline underline-offset-2">HORÁRIO NÃO DEFINIDO</span>}
                                        {r.time_slot === 'DUPLA' && <span className="text-blue-600 font-extrabold">DUPLA (AGUARDANDO HORA)</span>}
                                        {r.time_slot !== 'INDIV' && r.time_slot !== 'DUPLA' && r.time_slot}
                                      </>
                                    )}`;

if (content.match(regex1)) {
    content = content.replace(regex1, replacement1);
    console.log('Successfully updated fetchData logic.');
} else {
    console.error('Regex 1 (fetchData) failed to match.');
}

if (content.match(regex2)) {
    content = content.replace(regex2, replacement2);
    console.log('Successfully updated Quad table display.');
} else {
    console.error('Regex 2 (table display) failed to match.');
}

fs.writeFileSync(filePath, content);
console.log('Admin update complete.');
