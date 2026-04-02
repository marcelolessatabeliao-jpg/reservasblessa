import fs from 'fs';
const path = 'src/components/admin/BookingTable.tsx';
let text = fs.readFileSync(path, 'utf8');

const voucherBtn = `                                                 <Button 
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      const phone = booking.phone ? booking.phone.replace(/\\D/g, '') : '';
                                                      if (phone) {
                                                          const codeStr = booking.confirmation_code ? '\\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                                          const linkStr = booking.confirmation_code ? '\\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                                          const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
                                                          const amt = (booking.total_amount || 0).toFixed(2).replace('.', ',');
                                                          const cname = booking.name || '';
                                                          
                                                          const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\\n\\n*Resumo da Reserva:*\\nCliente: " + cname + "\\nData: " + dtStr + "\\nValor Total: R$ " + amt + codeStr + linkStr + "\\n\\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");
                                                          window.open("https://wa.me/55" + phone + "?text=" + msg, '_blank');
                                                      } else {
                                                          alert('Telefone não encontrado!');
                                                      }
                                                   }}
                                                   className="border-2 border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-blue-50 font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                                                 >
                                                    <FileCheck className="w-4 h-4" /> 
                                                    <span>VOUCHER</span>
                                                 </Button>\n\n`;

// Search for the EXCLUIR button using a flexible approach
const regex = /(<Button[^>]+onClick=\{[^}]*onDelete\(booking\.id,\s*booking\.is_order\)[^}]*\}[^>]*>[\s\S]*?<span>EXCLUIR<\/span>[\s\S]*?<\/Button>)/;

if (regex.test(text)) {
    text = text.replace(regex, voucherBtn + '$1');
    fs.writeFileSync(path, text);
    console.log('SUCCESS: Desktop voucher button added via regex.');
} else {
    console.error('ERROR: Could not find desktop delete button target via regex.');
}
