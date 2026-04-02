import { readFileSync, writeFileSync } from 'fs';

const p = 'src/components/admin/BookingTable.tsx';
let c = readFileSync(p, 'utf8');

const regex = /alert\('Telefone do cliente não encontrado!'\);\r?\n\s*}\r?\n\s*}\r?\n\s*<Button/g;

c = c.replace(regex, `alert('Telefone do cliente não encontrado!');\n                                          }\n                                      <Button`);

writeFileSync(p, c);
console.log('Fixed regex');
