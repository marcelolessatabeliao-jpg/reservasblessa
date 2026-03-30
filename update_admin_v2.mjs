import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `const timeMatch = searchStr.match(/(\\d{2}[:H]\\d{2})/);
                   let finalSlot = timeMatch ? timeMatch[1].replace('H', ':') : null;
                   
                   if (!finalSlot) {
                     const standardSlot = QUAD_TIMES.find(t => searchStr.includes(t));
                     finalSlot = standardSlot || (searchStr.includes('DUPLA') ? 'DUPLA' : 'INDIV');
                   }`;

const replacement1 = `// Try regex first (e.g., 9:00, 09:00, 9H00, 09H00)
                   const timeMatch = searchStr.match(/(\\d{1,2}[:H]\\d{2})/);
                   let finalSlot = null;
                   
                   if (timeMatch) {
                     let raw = timeMatch[1].replace('H', ':');
                     if (raw.length === 4) raw = '0' + raw; // Auto-pad (9:00 -> 09:00)
                     finalSlot = raw;
                   }
                   
                   if (!finalSlot) {
                     const standardSlot = QUAD_TIMES.find(t => searchStr.includes(t.replace(/^0/, '')) || searchStr.includes(t));
                     finalSlot = standardSlot || (searchStr.includes('DUPLA') ? 'DUPLA' : 'INDIV');
                   }`;

// Try to update the fetchData logic
if (content.includes(target1.trim()) || content.includes('const timeMatch = searchStr.match(/(\\d{2}[:H]\\d{2})/);')) {
    content = content.replace(/const timeMatch = searchStr\.match\(\/\\(\\d\{2\}[:H]\\d\{2\}\)\/\);[\s\S]*?finalSlot = standardSlot \|\| \(searchStr\.includes\('DUPLA'\) \? 'DUPLA' : 'INDIV'\);/, replacement1.trim());
    console.log('Successfully updated fetchData in Admin.tsx');
}

// Ensure the table displays the time correctly
const tableTarget = `<span className="text-[10px] uppercase font-bold text-blue-600">
                                    {isEditing ? (
                                      <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                         <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                         <SelectContent>{QUAD_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                      </Select>
                                    ) : r.time_slot}
                                 </span>`;

const tableReplacement = `<span className="text-[10px] uppercase font-bold text-blue-600 flex items-center gap-1.5">
                                    {isEditing ? (
                                      <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                         <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                         <SelectContent>{QUAD_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                      </Select>
                                    ) : (
                                      <>
                                        {r.time_slot === 'INDIV' && <span className="text-amber-600 font-black">HORÁRIO NÃO DEFINIDO</span>}
                                        {r.time_slot === 'DUPLA' && <span className="text-blue-600 font-black">DUPLA (AGUARDANDO HORA)</span>}
                                        {r.time_slot !== 'INDIV' && r.time_slot !== 'DUPLA' && r.time_slot}
                                      </>
                                    )}
                                 </span>`;

if (content.includes(tableTarget.trim())) {
    content = content.replace(tableTarget.trim(), tableReplacement.trim());
    console.log('Successfully updated Quad table display in Admin.tsx');
}

fs.writeFileSync(filePath, content);
console.log('Update process complete.');
