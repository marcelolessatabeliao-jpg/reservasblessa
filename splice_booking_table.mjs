import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newSection = [
    '                                   <div className="bg-white p-6 rounded-3xl shadow-lg border border-emerald-100 flex flex-col justify-between space-y-6 relative overflow-hidden group">',
    '                                            <div className="relative z-10 space-y-6">',
    '                                               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-50 pb-4">',
    '                                                  <div className="flex items-center gap-3">',
    '                                                     <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">',
    '                                                       <CalendarClock className="w-5 h-5" />',
    '                                                     </div>',
    '                                                     <div>',
    '                                                        <h4 className="text-[8px] font-black uppercase text-emerald-700/60 tracking-widest">Ações Rápidas</h4>',
    '                                                        <p className="text-base font-extrabold text-emerald-950">Controle de Reserva</p>',
    '                                                     </div>',
    '                                                  </div>',
    '',
    '                                                  {onFileUpload && (',
    '                                                    <div className="flex items-center gap-2">',
    '                                                       <input type="file" id={`upload-${booking.id}`} className="hidden" onChange={e => {',
    '                                                          if (e.target.files) onFileUpload(e.target.files[0], booking.id, !!booking.is_order);',
    '                                                       }} />',
    '                                                       <label htmlFor={`upload-${booking.id}`} className={cn(',
    '                                                          "flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95",',
    '                                                          booking.receipt_url ',
    '                                                            ? "bg-emerald-600 border border-emerald-700 text-white" ',
    '                                                            : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-800"',
    '                                                       )}>',
    '                                                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}',
    '                                                          {booking.receipt_url ? \'PAGO ✓\' : \'ANEXAR COMPROVANTE\'}',
    '                                                       </label>',
    '                                                       <Button ',
    '                                                         onClick={(e) => {',
    '                                                            e.stopPropagation();',
    '                                                            const phone = booking.phone ? booking.phone.replace(/\\D/g, \'\') : \'\';',
    '                                                            if (phone) {',
    '                                                                const codeStr = booking.confirmation_code ? \'\\n*Código do Voucher:* \' + booking.confirmation_code : \'\';',
    '                                                                const linkStr = booking.confirmation_code ? \'\\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/\' + booking.confirmation_code : \'\';',
    '                                                                const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString(\'pt-BR\', {timeZone: \'UTC\'}) : \'\';',
    '                                                                const amt = (booking.total_amount || 0).toFixed(2).replace(\'.\', \',\');',
    '                                                                const cname = booking.name || \'\';',
    '                                                                ',
    '                                                                const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\\n\\n*Resumo da Reserva:*\\nCliente: " + cname + "\\nData: " + dtStr + "\\nValor Total: R$ " + amt + codeStr + linkStr + "\\n\\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");',
    '                                                                window.open("https://wa.me/55" + phone + "?text=" + msg, \'_blank\');',
    '                                                            } else {',
    '                                                                alert(\'Telefone não encontrado!\');',
    '                                                            }',
    '                                                         }} ',
    '                                                         className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"',
    '                                                       >',
    '                                                          <FileCheck className="w-3.5 h-3.5" />',
    '                                                          VOUCHER',
    '                                                       </Button>',
    '                                                    </div>',
    '                                                  )}',
    '                                               </div>'
];

// Replace lines 396 to 480 (1-indexed)
// lines index is 0-indexed, so 395 to 479
const start = 395;
const end = 480; // inclusive in our intention, but slice is (start, end)
lines.splice(start, end - start, ...newSection);

fs.writeFileSync(file, lines.join('\n'));
console.log('Successfully updated BookingTable.tsx with splice');
