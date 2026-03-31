import fs from 'fs';

// --- 1. ADMIN.TSX CHANGES ---
const adminPath = 'src/pages/Admin.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// Calendar Alignment: Remove conflicting flex from 'day' class
adminContent = adminContent.replace(
  /day: cn\(\n\s+"h-8 w-8 md:h-12 md:w-12 p-0 font-black text-\[10px\] md:text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50\/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto",\n\s+"flex flex-col items-center justify-center gap-1"\n\s+\)/,
  'day: cn(\n                        "h-8 w-8 md:h-12 md:w-12 p-0 font-black text-[10px] md:text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto"\n                      )'
);

// Calendar DayContent: Remove p-1 and ensure centering
adminContent = adminContent.replace(
  /<div className=\{cn\("relative flex flex-col items-center p-1 rounded-full w-full h-full justify-center transition-all", isFull && "bg-red-50\/50 border border-red-100"\)\}>/,
  '<div className={cn("relative flex flex-col items-center rounded-full w-full h-full justify-center transition-all", isFull && "bg-red-50/50 border border-red-100")}>'
);

// Admin Mobile Receipts for Kiosk/Quad
// I need functional upload/remove for Kiosk/Quad. 
// I'll add two helper functions to Admin.tsx to handle these directly.

const kioskUploadLogic = `
  const handleKioskFileUpload = async (file: File, resId: string) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = \`\${crypto.randomUUID()}.\${fileExt}\`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      
      const isOrder = resId.toString().startsWith('order-');
      if (isOrder) {
         // It's a virtual reservation from an order, we might need to update the order instead or just toast
         toast({ title: "Esta é uma reserva de pedido. O comprovante deve ser anexado ao pedido na aba Reservas." });
      } else {
         const { error: updateError } = await supabase.from('kiosk_reservations').update({ receipt_url: publicUrl }).eq('id', resId);
         if (updateError) throw updateError;
         toast({ title: "Comprovante salvo!" });
         fetchData();
      }
    } catch (err) { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };

  const handleQuadFileUpload = async (file: File, resId: string) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = \`\${crypto.randomUUID()}.\${fileExt}\`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      
      const isOrder = resId.toString().startsWith('order-');
      if (isOrder) {
         toast({ title: "Esta é uma reserva de pedido. O comprovante deve ser anexado ao pedido na aba Reservas." });
      } else {
         const { error: updateError } = await supabase.from('quad_reservations').update({ receipt_url: publicUrl }).eq('id', resId);
         if (updateError) throw updateError;
         toast({ title: "Comprovante salvo!" });
         fetchData();
      }
    } catch (err) { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };
`;

// Insert helpers before renderDashboard
adminContent = adminContent.replace('  const renderDashboard = () =>', kioskUploadLogic + '\n  const renderDashboard = () =>');

// Update Kiosk Mobile Cards to show upload/view/delete
// (This is a complex regex replace, I'll targeting the buttons area)
const kioskMobileButtonsTarget = `                        <div className="flex items-center justify-end gap-2 pt-1">
                          {group.items.some((r: any) => r.receipt_url) && (
                            <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                              <FileText className="w-4 h-4 mr-2" /> Recibo
                            </Button>
                          )}
                          <Button`;

const kioskMobileButtonsReplacement = `                        <div className="flex flex-col gap-2 pt-2 border-t border-emerald-50">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-emerald-700/60 tracking-widest pl-1">Documentação</span>
                            <div className="flex gap-1.5">
                               {group.items[0] && (
                                 <>
                                   <input type="file" id={\`k-up-\${group.group_key}\`} className="hidden" onChange={e => e.target.files && handleKioskFileUpload(e.target.files[0], group.items[0].id)} />
                                   {group.items.some((r: any) => r.receipt_url) ? (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 bg-emerald-50 rounded-lg" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                           <FileCheck className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 bg-red-50 rounded-lg" onClick={async () => {
                                           if (confirm('Remover comprovante?')) {
                                              await supabase.from('kiosk_reservations').update({ receipt_url: null }).eq('id', group.items[0].id);
                                              fetchData();
                                           }
                                        }}>
                                           <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                   ) : (
                                      <label htmlFor={\`k-up-\${group.group_key}\`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[9px] uppercase cursor-pointer">
                                         {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                         Anexar
                                      </label>
                                   )}
                                 </>
                               )}
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                          <Button`;

adminContent = adminContent.replace(kioskMobileButtonsTarget, kioskMobileButtonsReplacement);

// Update Quad Mobile Cards similarly
const quadMobileButtonsTarget = `                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => {
                                setRescheduleData({ type: 'quad', group });
                                setRescheduleDate(parseISO(group.reservation_date));
                              }}><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(group.items[0], 'quad')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>`;

const quadMobileButtonsReplacement = `                              {group.items[0] && (
                                 <>
                                   <input type="file" id={\`q-up-\${group.group_key}\`} className="hidden" onChange={e => e.target.files && handleQuadFileUpload(e.target.files[0], group.items[0].id)} />
                                   {group.items.some((r: any) => r.receipt_url) ? (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                           <FileCheck className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={async () => {
                                           if (confirm('Remover comprovante?')) {
                                              await supabase.from('quad_reservations').update({ receipt_url: null }).eq('id', group.items[0].id);
                                              fetchData();
                                           }
                                        }}>
                                           <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </>
                                   ) : (
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" asChild>
                                        <label htmlFor={\`q-up-\${group.group_key}\`} className="cursor-pointer">
                                           {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        </label>
                                      </Button>
                                   )}
                                 </>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => {
                                setRescheduleData({ type: 'quad', group });
                                setRescheduleDate(parseISO(group.reservation_date));
                              }}><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(group.items[0], 'quad')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>`;

adminContent = adminContent.replace(quadMobileButtonsTarget, quadMobileButtonsReplacement);

fs.writeFileSync(adminPath, adminContent);

// --- 2. BOOKINGTABLE.TSX CHANGES ---
const btPath = 'src/components/admin/BookingTable.tsx';
let btContent = fs.readFileSync(btPath, 'utf8');

const btMobileActionsTarget = `                               <div className="space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">Ações e Controle</p>`;

const btMobileActionsReplacement = `                               <div className="space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">Pagamento / Comprovante</p>
                                  {onFileUpload && (
                                     <div className="flex flex-col gap-2">
                                        <input type="file" id={\`m-up-\${booking.id}\`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                        {booking.receipt_url ? (
                                           <div className="flex gap-2">
                                              <Button variant="outline" className="flex-1 h-10 rounded-xl bg-emerald-50 border-emerald-200 text-emerald-700 font-black text-[9px] uppercase" onClick={() => window.open(booking.receipt_url!)}>
                                                 <FileCheck className="w-3.5 h-3.5 mr-2" /> Ver Comprovante
                                              </Button>
                                              <Button variant="outline" className="w-10 h-10 rounded-xl bg-red-50 border-red-200 text-red-500 flex items-center justify-center" onClick={() => onRemoveReceipt?.(booking.id)}>
                                                 <Trash2 className="w-4 h-4" />
                                              </Button>
                                           </div>
                                        ) : (
                                           <label htmlFor={\`m-up-\${booking.id}\`} className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-white border-2 border-dashed border-emerald-200 text-emerald-800 font-black text-[9px] uppercase cursor-pointer hover:bg-emerald-50 transition-all">
                                              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                              Anexar Comprovante
                                           </label>
                                        )}
                                     </div>
                                  )}
                               </div>
                               <div className="space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">Ações e Controle</p>`;

btContent = btContent.replace(btMobileActionsTarget, btMobileActionsReplacement);
fs.writeFileSync(btPath, btContent);

console.log('Update complete v8 (Calendar Alignment & Mobile Receipts)!');
