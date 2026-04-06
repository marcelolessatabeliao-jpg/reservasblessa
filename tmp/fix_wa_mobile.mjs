import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\components\\admin\\BookingTable.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Function to generate the consistent WhatsApp text
const newLine = `(e: any) => { 
                                                          e.stopPropagation(); 
                                                          const phone = (booking.customer_phone || (booking as any).phone || '').replace(/\\D/g, ''); 
                                                          if (phone) { 
                                                            const items = (booking as any).order_items || [];
                                                            const itemsList = items.map((it: any) => \`- \${it.quantity}x \${it.product_name || it.product_id} (\${formatCurrency(it.unit_price)})\`).join('%0A');
                                                            const dateStr = format(parseISO(booking.visit_date || new Date().toISOString()), "dd/MM/yyyy", { locale: ptBR });
                                                            const name = booking.name || (booking as any).customer_name;
                                                            
                                                            const text = \`🍀 *BALNEÁRIO FAMÍLIA LESSA*%0A%0AEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.%0A%0A📅 *Data:* \${dateStr}%0A👤 *Titular:* \${name}%0A%0A📝 *Resumo do Pedido:*%0A\${itemsList}%0A%0A💰 *Total:* \${formatCurrency(booking.total_amount)}%0A%0AVoucher: https://reservas.balneariolessa.com.br/voucher/\${booking.confirmation_code}%0A%0A✨ *Aguardamos vocês para o lazer que a sua família merece.*\`;
                                                            
                                                            window.open("https://wa.me/55" + phone + "?text=" + text, '_blank'); 
                                                          } 
                                                        }`;

// 1. ADD VOUCHER TO MOBILE GRID (Ações e Controle)
const mobileGridStart = '<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">';
const mobileVoucherBtn = `
                                      <Button 
                                        onClick={${newLine}} 
                                        className="bg-indigo-50 border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white border-indigo-600 font-black uppercase text-[9px] h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300"
                                      >
                                         <FileCheck className="w-3.5 h-3.5" /> 
                                         Voucher
                                      </Button>`;

// Find the mobile grid and append the button if not there
if (content.indexOf(mobileGridStart) !== -1 && !content.includes('FileCheck className="w-3.5 h-3.5"')) {
    const splitParts = content.split(mobileGridStart);
    content = splitParts[0] + mobileGridStart + mobileVoucherBtn + splitParts[1];
}

// 2. ENSURE DESKTOP VOUCHER IS CORRECT (using exact search from previous Turn 97)
const lines = content.split('\n');
let replacedDesktop = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const items = (booking as any).order_items || [];')) {
    const indent = lines[i].match(/^\s*/)[0];
    lines[i] = indent + 'const items = (booking as any).order_items || [];';
    lines[i+1] = indent + 'const itemsList = items.map((it: any) => `- ${it.quantity}x ${it.product_name || it.product_id} (${formatCurrency(it.unit_price)})`).join(\'%0A\');';
    lines[i+2] = indent + 'const dateStr = format(parseISO(booking.visit_date || new Date().toISOString()), "dd/MM/yyyy", { locale: ptBR });';
    lines[i+3] = indent + 'const name = booking.name || (booking as any).customer_name;';
    lines[i+4] = indent + '';
    lines[i+5] = indent + 'const text = `🍀 *BALNEÁRIO FAMÍLIA LESSA*%0A%0AEsse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.%0A%0A📅 *Data:* ${dateStr}%0A👤 *Titular:* ${name}%0A%0A📝 *Resumo do Pedido:*%0A${itemsList}%0A%0A💰 *Total:* ${formatCurrency(booking.total_amount)}%0A%0AVoucher: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}%0A%0A✨ *Aguardamos vocês para o lazer que a sua família merece.*`;';
    replacedDesktop = true;
  }
}

fs.writeFileSync(filePath, content);
console.log('Successfully updated BookingTable.tsx');
