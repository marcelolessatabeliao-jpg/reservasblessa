const fs = require('fs');

const file = 'src/components/admin/BookingTable.tsx';
let data = fs.readFileSync(file, 'utf8');

const regex = /<Button onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*const phone = \(\(booking as any\)[\s\S]*?\}\}\r?\n/g;
data = data.replace(regex, '');

fs.writeFileSync(file, data);
console.log('Cleaned up dangling voucher button code version 2');
