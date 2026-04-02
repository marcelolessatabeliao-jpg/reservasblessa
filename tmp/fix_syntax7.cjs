const fs = require('fs');

const file = 'src/components/admin/BookingTable.tsx';
let data = fs.readFileSync(file, 'utf8');

const target1 = `<Button onClick={(e) => {
                                         e.stopPropagation();
                                         const phone = ((booking as any).customer_phone || (booking as any).phone || '').replace(/\\D/g, '');
                                         if (phone) {
                                             const codeStr = booking.confirmation_code ? '\\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                             const linkStr = booking.confirmation_code ? '\\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                             const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
                                             const amt = (booking.total_amount || 0).toFixed(2).replace('.', ',');
                                             const cname = booking.name || '';
                                             
                                             const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\\n\\n*Resumo da Reserva:*\\nCliente: " + cname + "\\nData: " + dtStr + "\\nValor Total: R$ " + amt + codeStr + linkStr + "\\n\\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");
                                             window.open("https://wa.me/55" + phone + "?text=" + msg, '_blank');
                                         } else {
                                             alert('Telefone do cliente não encontrado!');
                                          }
                                       }}`;

data = data.replace(target1, '');
data = data.replace(/\r\n\s*\}\}\r\n\s*<Button onClick=\{\(e\)/g, '\r\n<Button onClick={(e)');
// Let's just do a manual string replace for this specific block:
const regex = /<Button onClick=\{\(e\) => \{\s*e\.stopPropagation\(\);\s*const phone = \(\(booking as any\)\.customer_phone \|\| \(\(booking as any\)\.phone \|\| ''\)\)\.replace\(\/\\D\/g, ''\);\s*if \(phone\) \{[\s\S]*?\}\}\r?\n/g;
data = data.replace(regex, '');

fs.writeFileSync(file, data);
console.log('Cleaned up dangling voucher button code');
