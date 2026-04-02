import { readFileSync, writeFileSync } from 'fs';

// --- 1. REPAIR BOOKINGTABLE.TSX (LAYOUT RECONSTRUCTION) ---
const tablePath = 'src/components/admin/BookingTable.tsx';
let tableContent = readFileSync(tablePath, 'utf8');

// The file got messy. Let's find the specific block and replace it entirely.
// We start at the grid container and end after the notes or grid div.
const buggyRegionRegex = /<div className="grid lg:grid-cols-3 gap-6 items-stretch">[\s\S]*?\{booking\.notes \? \([\s\S]*?<\/div>[\s\S]*?<\/div>/;

const cleanExpandedUI = `
                                      <div className="grid lg:grid-cols-3 gap-6 items-start">
                                         {/* Ações Rápidas (Ocupa 2 colunas) */}
                                         <div className="lg:col-span-2 space-y-6">
                                            <div className="bg-white p-6 rounded-3xl shadow-lg border border-emerald-100 flex flex-col justify-between space-y-6 relative overflow-hidden group">
                                               <div className="relative z-10 space-y-6">
                                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-50 pb-4">
                                                     <div className="flex items-center gap-3">
                                                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                                                          <CalendarClock className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                           <h4 className="text-[8px] font-black uppercase text-emerald-700/60 tracking-widest">Ações Rápidas</h4>
                                                           <p className="text-base font-extrabold text-emerald-950">Controle de Reserva</p>
                                                        </div>
                                                     </div>

                                                     {onFileUpload && (
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
                                                       </div>
                                                     )}
                                                  </div>
                                                 
                                                 {/* REAGENDAR Premium Calendar */}
                                                 {rescheduleId === booking.id && (
                                                   <div className="p-3 bg-blue-50/80 rounded-2xl border-2 border-blue-200 animate-in slide-in-from-top-2 duration-300 space-y-3">
                                                     <div className="flex items-center gap-2">
                                                        <CalendarRange className="w-4 h-4 text-blue-700 shrink-0" />
                                                        <p className="text-[9px] font-black uppercase text-blue-700 tracking-wider">Reagendar Reserva</p>
                                                     </div>
                                                     <div className="flex-1">
                                                        <Popover>
                                                          <PopoverTrigger asChild>
                                                            <Button 
                                                              variant="outline" 
                                                              className="w-full h-10 px-3 rounded-xl border border-blue-200 text-blue-950 font-bold text-sm bg-white hover:bg-blue-50 transition-all flex items-center justify-start gap-2"
                                                            >
                                                              <CalendarIcon className="w-4 h-4 text-blue-500" />
                                                              {rescheduleDate ? format(parseISO(rescheduleDate), 'dd/MM/yyyy') : 'Selecionar Nova Data'}
                                                            </Button>
                                                          </PopoverTrigger>
                                                          <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-2 border-blue-100 shadow-2xl" align="start">
                                                            <CalendarUI
                                                              mode="single"
                                                              selected={rescheduleDate ? parseISO(rescheduleDate) : undefined}
                                                              onSelect={(date) => { if (date) setRescheduleDate(format(date, 'yyyy-MM-dd')); }}
                                                              locale={ptBR}
                                                            />
                                                          </PopoverContent>
                                                        </Popover>
                                                     </div>
                                                     <div className="flex gap-2">
                                                       <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] h-9 px-4 rounded-xl shadow-sm" disabled={!rescheduleDate} onClick={() => { if (rescheduleDate) { onReschedule(booking.id, rescheduleDate, booking.is_order); setRescheduleId(null); setRescheduleDate(''); } }}>Confirmar Novo Agendamento</Button>
                                                       <Button size="sm" variant="ghost" className="h-9 font-bold text-[9px]" onClick={() => { setRescheduleId(null); setRescheduleDate(''); }}>Voltar</Button>
                                                     </div>
                                                   </div>
                                                 )}

                                                 <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                     {onGeneratePayment && !['paid', 'pago', 'checked-in', 'cancelled', 'cancelado'].includes(booking.status?.toLowerCase() || '') && (
                                                       <Button onClick={(e) => { e.stopPropagation(); onGeneratePayment(booking.id, !!booking.is_order); }} className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-bold uppercase text-[8px] h-11 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm">
                                                         <QrCode className="w-3.5 h-3.5" />
                                                         <span>PIX</span>
                                                       </Button>
                                                     )}
                                                    <Button onClick={() => onStatusChange(booking.id, 'paid', booking.is_order)} disabled={booking.status === 'paid' || updatingId === booking.id} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 border border-emerald-700 text-white font-bold uppercase text-[8px] h-11 rounded-xl shadow-sm flex flex-col items-center justify-center">
                                                       <CheckCircle className="w-3.5 h-3.5" /> 
                                                       <span>PAGO</span>
                                                    </Button>
                                                    <Button onClick={() => onStatusChange(booking.id, 'checked-in', booking.is_order)} className={cn("border-2 font-bold uppercase text-[8px] h-11 rounded-xl flex flex-col items-center justify-center", booking.status === 'checked-in' ? "bg-emerald-700 border-emerald-800 text-white" : "bg-white border-emerald-500 text-emerald-700")}>
                                                       <UserCheck className="w-3.5 h-3.5" /> 
                                                       <span>CHECK-IN</span>
                                                    </Button>
                                                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); setRescheduleId(rescheduleId === booking.id ? null : booking.id); setRescheduleDate(booking.visit_date || ''); }} className="border-2 border-blue-300 text-blue-700 bg-white font-bold uppercase text-[8px] h-11 rounded-xl flex flex-col items-center justify-center">
                                                       <CalendarRange className="w-3.5 h-3.5" /> 
                                                       <span>REAGENDAR</span>
                                                    </Button>
                                                    <Button onClick={() => onStatusChange(booking.id, 'cancelled', booking.is_order)} className="border-2 border-amber-300 text-amber-700 bg-white font-bold uppercase text-[8px] h-11 rounded-xl flex flex-col items-center justify-center">
                                                       <XCircle className="w-3.5 h-3.5" /> 
                                                       <span>CANCELAR</span>
                                                    </Button>
                                                    <Button onClick={(e) => { e.stopPropagation(); const phone = ((booking as any).customer_phone || (booking as any).phone || '').replace(/\\D/g, ''); if (phone) { window.open("https://wa.me/55" + phone + "?text=" + encodeURIComponent("Voucher: https://reservas.balneariolessa.com.br/voucher/" + booking.confirmation_code), '_blank'); } }} className="border-2 border-blue-300 text-blue-700 bg-blue-50 font-bold uppercase text-[8px] h-11 rounded-xl flex flex-col items-center justify-center">
                                                       <FileCheck className="w-3.5 h-3.5" /> 
                                                       <span>VOUCHER</span>
                                                    </Button>
                                                 </div>
                                               </div>
                                            </div>
                                         </div>

                                         {/* Notas Internas (Ocupa 1 coluna) */}
                                         <div className="bg-emerald-950 text-white p-4 rounded-3xl shadow-lg border border-emerald-900 flex flex-col space-y-4">
                                            <div className="flex items-center gap-2">
                                               <StickyNote className="w-4 h-4 text-emerald-700" />
                                               <p className="text-[8px] font-extrabold uppercase tracking-widest text-white/40">Notas Internas</p>
                                            </div>

                                            {editingNoteId === booking.id ? (
                                               <div className="space-y-3">
                                                  <Textarea 
                                                     value={noteText} 
                                                     onChange={e => setNoteText(e.target.value)} 
                                                     className="rounded-xl border-white/10 min-h-[60px] text-[10px] p-3 bg-white/5 text-white" 
                                                  />
                                                  <div className="flex gap-2">
                                                     <Button onClick={() => { onAddNote(booking.id, noteText, booking.is_order); setEditingNoteId(null); }} className="flex-1 bg-emerald-500 text-emerald-950 font-bold text-[8px] h-8 rounded-lg">SALVAR</Button>
                                                     <Button onClick={() => setEditingNoteId(null)} variant="ghost" className="text-[8px] text-white/40 h-8 font-bold">FECHAR</Button>
                                                  </div>
                                               </div>
                                            ) : (
                                               <div onClick={() => { setEditingNoteId(booking.id); setNoteText(booking.notes || ''); }} className="cursor-pointer min-h-[60px] p-3 rounded-xl border border-dashed border-white/10 flex items-center justify-center transition-all hover:bg-white/5">
                                                 {booking.notes ? (
                                                   <p className="text-[10px] font-medium text-emerald-100 italic leading-relaxed text-center">"\${booking.notes}"</p>
                                                 ) : (
                                                   <Plus className="w-4 h-4 text-white/20" />
                                                 )}
                                               </div>
                                            )}
                                         </div>
                                      </div>`;

tableContent = tableContent.replace(buggyRegionRegex, cleanExpandedUI);
writeFileSync(tablePath, tableContent);
console.log('BookingTable.tsx: Repaired layout and shrunk notes field.');


// --- 2. REPAIR ADMIN.TSX (FIX PIX GENERATION) ---
const adminPath = 'src/pages/Admin.tsx';
let adminContent = readFileSync(adminPath, 'utf8');

const pixFnRegex = /const handleGeneratePayment = async \(bookingId: string, isOrder\? : boolean\) => \{[\s\S]*?setIsGeneratingPix\(false\);[\s\S]*?\}[\s\S]*?\};/;

const fixedPixFn = `  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {
    setIsGeneratingPix(true);
    try {
      const item = isOrder ? orders.find((o: any) => o.id === bookingId) : bookings.find((b: any) => b.id === bookingId);
      if (!item) throw new Error("Reserva não encontrada");

      // Validar valor da reserva para o Asaas (mínimo R$ 5,00 costuma ser exigido)
      const numericValue = Number(item.total_amount);
      if (isNaN(numericValue) || numericValue <= 0) {
        throw new Error("O valor da reserva é inválido para gerar pagamento.");
      }

      console.log(\`Gerando PIX de R$ \${numericValue} para \${item.name || item.customer_name}\`);

      const { data: response, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: bookingId, 
          billingType: 'PIX',
          name: item.name || item.customer_name,
          phone: item.phone || item.customer_phone,
          cpf: item.cpf || '000.000.000-00', 
          value: numericValue,
          description: \`Reserva Balneário Lessa - \${item.name || item.customer_name}\`
        }
      });

      if (error) {
        console.error('Edge Function Error:', error);
        throw error;
      }
      
      if (response && response.success && response.data?.pix) {
        setPixData({
          qrCode: response.data.pix.encodedImage,
          payload: response.data.pix.payload,
          amount: numericValue,
          name: item.name || item.customer_name
        });
      } else {
        const errorMsg = response?.error || "A função não retornou um QR Code válido. Verifique se o CPF é válido.";
        console.warn('Payment creation failed:', response);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('Pix generation error:', err);
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPix(false);
    }
  };`;

// Use a simpler approach if the regex fails: search for the function start
if (adminContent.includes('const handleGeneratePayment')) {
    const start = adminContent.indexOf('const handleGeneratePayment');
    const end = adminContent.indexOf('const updateBookingStatus', start);
    if (start !== -1 && end !== -1) {
       adminContent = adminContent.substring(0, start) + fixedPixFn + "\n\n" + adminContent.substring(end);
       writeFileSync(adminPath, adminContent);
       console.log('Admin.tsx: Fixed PIX generation function with value validation.');
    } else {
       console.error('Admin.tsx: Could not find indices for handleGeneratePayment replacement.');
    }
} else {
    console.error('Admin.tsx: Could not find handleGeneratePayment.');
}
