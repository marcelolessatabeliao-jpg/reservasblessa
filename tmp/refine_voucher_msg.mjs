import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\components\\admin\\BookingTable.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The script from Turn 90 changed it to this (with the specific indent):
const targetStart = 'const items = (booking as any).order_items || [];';
const lines = content.split('\n');
let replaced = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(targetStart)) {
    const indent = lines[i].match(/^\s*/)[0];
    
    // We want to replace from lines[i] to the end of the text assignment
    // But it's easier to just rebuild the whole block inside the onClick
    
    lines[i] = indent + 'const items = (booking as any).order_items || [];';
    lines[i+1] = indent + 'const itemsList = items.map((it: any) => `- ${it.quantity}x ${it.product_name || it.product_id} (${formatCurrency(it.unit_price)})`).join(\'%0A\');';
    lines[i+2] = indent + 'const dateStr = format(parseISO(booking.visit_date || new Date().toISOString()), "dd/MM/yyyy", { locale: ptBR });';
    lines[i+3] = indent + 'const name = booking.name || (booking as any).customer_name;';
    lines[i+4] = indent + '';
    lines[i+5] = indent + 'const text = `🍀 *BALNEÁRIO FAMÍLIA LESSA*%0A%0AEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.%0A%0A📅 *Data:* ${dateStr}%0A👤 *Titular:* ${name}%0A%0A📝 *Resumo do Pedido:*%0A${itemsList}%0A%0A💰 *Total:* ${formatCurrency(booking.total_amount)}%0A%0AVoucher: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}`;';
    
    replaced = true;
    break;
  }
}

if (replaced) {
  fs.writeFileSync(filePath, lines.join('\n'));
} else {
  process.exit(1);
}
