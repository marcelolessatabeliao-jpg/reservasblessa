import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\components\\admin\\BookingTable.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldLine = 'onClick={(e) => { e.stopPropagation(); const phone = ((booking as any).customer_phone || (booking as any).phone || \'\').replace(/\\D/g, \'\'); if (phone) { window.open("https://wa.me/55" + phone + "?text=" + encodeURIComponent("Voucher: https://reservas.balneariolessa.com.br/voucher/" + booking.confirmation_code), \'_blank\'); } }}';

const newLine = `onClick={(e) => { 
                                                          e.stopPropagation(); 
                                                          const phone = (booking.customer_phone || (booking as any).phone || '').replace(/\\D/g, ''); 
                                                          if (phone) { 
                                                            const items = (booking as any).order_items || [];
                                                            const itemsList = items.map((it: any) => \`- \${it.quantity}x \${it.product_name || it.product_id} (R$ \${it.unit_price})\`).join('%0A');
                                                            const dateStr = booking.visit_date;
                                                            const name = booking.name || (booking as any).customer_name;
                                                            
                                                            const text = \`🍀 *BALNEÁRIO FAMÍLIA LESSA*%0A%0AEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.%0A%0A📅 *Data:* \${dateStr}%0A👤 *Titular:* \${name}%0A%0A📝 *Resumo do Pedido:*%0A\${itemsList}%0A%0A💰 *Total:* R$ \${booking.total_amount}%0A%0AVoucher: https://reservas.balneariolessa.com.br/voucher/\${booking.confirmation_code}\`;
                                                            
                                                            window.open("https://wa.me/55" + phone + "?text=" + text, '_blank'); 
                                                          } 
                                                        }}`;

// Flexible replacement: find the line regardless of indentation
const lines = content.split('\n');
let replaced = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const phone = ((booking as any).customer_phone')) {
    const indent = lines[i].match(/^\s*/)[0];
    lines[i] = indent + newLine;
    replaced = true;
    break;
  }
}

if (replaced) {
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Successfully updated BookingTable.tsx');
} else {
  console.error('Could not find the target line in BookingTable.tsx');
  process.exit(1);
}
