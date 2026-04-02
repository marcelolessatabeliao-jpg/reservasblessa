import fs from 'fs';
const path = 'src/components/admin/BookingTable.tsx';
let text = fs.readFileSync(path, 'utf8');

const voucherButton = `                                                   <Button 
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
                                                     className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
                                                   >
                                                      <FileCheck className="w-3.5 h-3.5" />
                                                      VOUCHER
                                                   </Button>`;

// Find the closure of the upload div or the start of the upload block
const target = /\{booking\.receipt_url \? 'PAGO ✓' : 'ANEXAR COMPROVANTE'\}\s*<\/label>\s*<\/div>/;

if (target.test(text)) {
    text = text.replace(target, `$& \n${voucherButton}`);
    fs.writeFileSync(path, text);
    console.log('SUCCESS: Voucher button added to Ações Rápidas header.');
} else {
    console.error('ERROR: Could not find target area in Ações Rápidas header.');
}
