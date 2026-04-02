const fs = require('fs');

const file = 'src/pages/Admin.tsx';
let data = fs.readFileSync(file, 'utf8');

const regex = /let total = \(adults_normal \* 50\) \+ \(adults_half \* 25\);/g;
data = data.replace(regex, 'let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);');

fs.writeFileSync(file, data);
console.log('Fixed Admin.tsx calculate total');
