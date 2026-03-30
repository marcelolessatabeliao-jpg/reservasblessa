import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `                if ((pId.includes('quad') || pName.includes('quad')) && !parsedQuads.some(pq => pq.order_id === o.id)) {
                   // Try to find a time slot (HH:MM or HHhMM) in name or metadata
                   const searchStr = \`\${pName} \${pId} \${JSON.stringify(item.metadata || {})} \${o.notes || ''}\`.toUpperCase();
                   const timeMatch = searchStr.match(/(\\d{2}[:H]\\d{2})/);
                   let finalSlot = timeMatch ? timeMatch[1].replace('H', ':') : null;
                   
                   if (!finalSlot) {
                     const standardSlot = QUAD_TIMES.find(t => searchStr.includes(t));
                     finalSlot = standardSlot || (searchStr.includes('DUPLA') ? 'DUPLA' : 'INDIV');
                   }`;

const replacement = `                if ((pId.includes('quad') || pName.includes('quad')) && !parsedQuads.some(pq => pq.order_id === o.id)) {
                   // Try to find a time slot (H:MM, HH:MM, HhMM, HHhMM) in name or metadata
                   const searchStr = \`\${pName} \${pId} \${JSON.stringify(item.metadata || {})} \${o.notes || ''}\`.toUpperCase();
                   
                   // Try regex first (e.g., 9:00, 09:00, 9H00, 09H00)
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

if (content.includes(target.trim())) {
    content = content.replace(target.trim(), replacement.trim());
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated Admin.tsx');
} else {
    console.error('Target content not found in Admin.tsx');
    // Try a more relaxed match
    const simplerTarget = `const timeMatch = searchStr.match(/(\\d{2}[:H]\\d{2})/);`;
    if (content.includes(simplerTarget)) {
        console.log('Found simpler target, attempting partial replacement...');
    }
}
