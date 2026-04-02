import { readFileSync, writeFileSync } from 'fs';

const p = 'src/components/admin/BookingTable.tsx';
let c = readFileSync(p, 'utf8');

c = c.replace(
  `                                              alert('Telefone do cliente não encontrado!');\r\n                                          }\r\n                                       }}\r\n                                      <Button`,
  `                                              alert('Telefone do cliente não encontrado!');\r\n                                          }\r\n                                      <Button`
);

writeFileSync(p, c);
console.log('Fixed');
