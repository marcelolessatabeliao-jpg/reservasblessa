import fs from 'fs';
const file = 'src/components/admin/BookingTable.tsx';
let content = fs.readFileSync(file, 'utf8');

// Define exactly what the desktop onFileUpload block should look like
const desktopBlock = `                                                  {onFileUpload && (
                                                    <div className="flex items-center gap-2">
                                                       <input type="file" id={\`upload-\${booking.id}\`} className="hidden" onChange={e => {
                                                          if (e.target.files) onFileUpload(e.target.files[0], booking.id, !!booking.is_order);
                                                       }} />
                                                       <label htmlFor={\`upload-\${booking.id}\`} className={cn(
                                                          "flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95",
                                                          booking.receipt_url 
                                                            ? "bg-emerald-600 border border-emerald-700 text-white" 
                                                            : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                                                       )}>
                                                          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                                          {booking.receipt_url ? 'PAGO ✓' : 'ANEXAR COMPROVANTE'}
                                                       </label>
                                                       <Button 
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
                                                       </Button>
                                                    </div>
                                                  )}`;

// Find the block in the current content.
// It starts with {onFileUpload && ( and ends with )}
const searchKey = '{onFileUpload && (';
const startIdx = content.lastIndexOf(searchKey); // Use lastIndexOf to find the Desktop one (it's after the mobile one)

if (startIdx !== -1) {
    // Find the next )} after startIdx
    const endKey = ')}';
    const nextClosing = content.indexOf(endKey, startIdx);
    if (nextClosing !== -1) {
        const endIdx = nextClosing + endKey.length;
        const newContent = content.substring(0, startIdx) + desktopBlock + content.substring(endIdx);
        fs.writeFileSync(file, newContent);
        console.log('Successfully repaired BookingTable.tsx');
    } else {
        console.error('Could not find closing )} after startIdx');
    }
} else {
    console.error('Could not find {onFileUpload && ( in file');
}
