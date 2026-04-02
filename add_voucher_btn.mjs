import fs from 'fs';
const path = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace mobile view grid cols
content = content.replace(/grid-cols-2 gap-2/g, "grid-cols-2 sm:grid-cols-3 gap-2");

// Replace desktop view grid cols
content = content.replace(/grid-cols-2 sm:grid-cols-5 gap-3/g, "grid-cols-2 sm:grid-cols-6 gap-3");

const voucherButtonMobile = `
                                     <Button onClick={(e) => {
                                        e.stopPropagation();
                                        const phone = booking.phone ? booking.phone.replace(/\\D/g, '') : '';
                                        if (phone) {
                                            const codeStr = booking.confirmation_code ? '\\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                            const linkStr = booking.confirmation_code ? '\\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                            const msg = encodeURIComponent(\`Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\n\n*Resumo da Reserva:*\nCliente: \${booking.name || ''}\nData: \${booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}\nValor Total: R$ \${(booking.total_amount || 0).toFixed(2).replace('.', ',')}\${codeStr}\${linkStr}\n\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!\`);
                                            window.open(\`https://wa.me/55\${phone}?text=\${msg}\`, '_blank');
                                        } else {
                                            alert('Telefone do cliente não encontrado!');
                                        }
                                     }} className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm flex items-center justify-center gap-1">Voucher</Button>
`;

const replaceMobileButtons = `                                     <Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'paid', booking.is_order);}} className="bg-emerald-600 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm">Efetivar</Button>${voucherButtonMobile}`;
content = content.replace(`                                     <Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'paid', booking.is_order);}} className="bg-emerald-600 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm">Efetivar</Button>`, replaceMobileButtons);


const voucherButtonDesktop = `
                                                 <Button 
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      const phone = booking.phone ? booking.phone.replace(/\\D/g, '') : '';
                                                      if (phone) {
                                                          const codeStr = booking.confirmation_code ? '\\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                                          const linkStr = booking.confirmation_code ? '\\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                                          const msg = encodeURIComponent(\`Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\n\n*Resumo da Reserva:*\nCliente: \${booking.name || ''}\nData: \${booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}\nValor Total: R$ \${(booking.total_amount || 0).toFixed(2).replace('.', ',')}\${codeStr}\${linkStr}\n\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!\`);
                                                          window.open(\`https://wa.me/55\${phone}?text=\${msg}\`, '_blank');
                                                      } else {
                                                          alert('Telefone não encontrado!');
                                                      }
                                                   }}
                                                   className="border-2 border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-blue-50 font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                                                 >
                                                    <FileCheck className="w-4 h-4" /> 
                                                    <span>VOUCHER</span>
                                                 </Button>
`;

content = content.replace('                                                  <Button \n                                                    onClick={(e) => { e.stopPropagation(); if (confirm(\'DELETAR AGORA? Esta ação não pode ser desfeita.\')) onDelete(booking.id, booking.is_order); }} \n                                                    className="border-2 border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 bg-white font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"\n                                                  >\n                                                     <Trash2 className="w-4 h-4" /> \n                                                     <span>EXCLUIR</span>\n                                                  </Button>', `                                                  <Button \n                                                    onClick={(e) => { e.stopPropagation(); if (confirm('DELETAR AGORA? Esta ação não pode ser desfeita.')) onDelete(booking.id, booking.is_order); }} \n                                                    className="border-2 border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 bg-white font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"\n                                                  >\n                                                     <Trash2 className="w-4 h-4" /> \n                                                     <span>EXCLUIR</span>\n                                                  </Button>\n${voucherButtonDesktop}`);


fs.writeFileSync(path, content);
console.log('Update applied');
