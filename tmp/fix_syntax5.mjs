import { readFileSync, writeFileSync } from 'fs';

const p = 'src/components/admin/BookingTable.tsx';
let c = readFileSync(p, 'utf8');

const regex = /\}\}\r?\n\s*<Button onClick=\{\(e\) => \{e\.stopPropagation\(\); onStatusChange\(booking\.id, 'checked-in'/g;

c = c.replace(regex, `<Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'checked-in'`);

writeFileSync(p, c);
console.log('Fixed regex 2');
