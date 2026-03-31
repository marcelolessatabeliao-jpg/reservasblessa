import fs from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// --- 1. REORGANIZE SUB-TABS (KIOSK & QUAD) ---
// Find the sub-tab container for kiosks and quads
const subTabRegex = /<div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">([\s\S]*?)\{subTabConfig\.map\(t => \(([\s\S]*?)<\/div>/g;
// Replace with grid layout
adminContent = adminContent.replace(
  /<div className="flex gap-2 bg-slate-100 p-1 rounded-2xl">/g,
  '<div className="grid grid-cols-2 md:flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">'
);

// Make the "Histórico" tab (the 3rd one) take full width on mobile
adminContent = adminContent.replace(
  /kioskSubTab === t\.key \? t\.color \+ ' shadow-md' : 'text-slate-500 hover:text-slate-700'\n\s+\)\}/g,
  "kioskSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',\n                      t.key === 'historico' && 'col-span-2 md:col-auto'\n                    )}"
);

adminContent = adminContent.replace(
  /quadSubTab === t\.key \? t\.color \+ ' shadow-md' : 'text-slate-500 hover:text-slate-700'\n\s+\)\}/g,
  "quadSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',\n                      t.key === 'historico' && 'col-span-2 md:col-auto'\n                    )}"
);

// --- 2. KIOSK CARDS (MOBILE) ---
// Find the Kiosk Table and wrap it/add cards
const kioskTableTarget = '<div className="overflow-x-auto">';
const kioskCardsReplacement = `          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
              {tabGroups.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
              ) : (
                tabGroups.map((group) => {
                  const { names, capacity } = resolveGroup(group);
                  const isToday = group.reservation_date === todayStr;
                  return (
                    <div key={group.group_key} className="bg-white rounded-2xl border-2 border-emerald-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                      <div className={cn("p-4 border-b border-emerald-100 flex justify-between items-center", isToday ? "bg-emerald-50" : "bg-white")}>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Data da Visita</span>
                            <span className="font-black text-emerald-900">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                         </div>
                         {isToday && <span className="bg-emerald-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm">Hoje</span>}
                      </div>
                      <div className="p-4 space-y-3">
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Cliente</span>
                            <span className="font-black text-emerald-950 uppercase text-sm block">{group.customer_name}</span>
                            <span className="text-[10px] text-emerald-700 font-bold">{group.items.length} reserva(s) • {formatCurrency(group.total_price)}</span>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Quiosques</span>
                            <div className="flex flex-wrap gap-1.5">
                               {names.split(', ').map((n, i) => (
                                 <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200">{n}</span>
                               ))}
                            </div>
                         </div>
                         <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-50">
                            {group.items.some((r) => r.receipt_url) && (
                               <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r) => r.receipt_url)?.receipt_url)}>
                                 <FileText className="w-4 h-4 mr-2" /> Recibo
                               </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl" onClick={() => {setRescheduleData({ type: 'kiosk', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 bg-red-50 rounded-xl" onClick={() => requestDelete(group.items[0], 'kiosk')}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">`;

adminContent = adminContent.replace(kioskTableTarget, kioskCardsReplacement);
// Close the hidden md:block div after the kiosk table
adminContent = adminContent.replace('</table>\n            )}\n          </div>', '</table>\n            )}\n          </div>\n          </div>');

// --- 3. QUAD CARDS (MOBILE) ---
const quadTableTarget = '<div className="overflow-x-auto">';
const quadCardsReplacement = `          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-blue-50/30">
               {tabGroups.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
               ) : (
                 tabGroups.map((group) => {
                   const isExpanded = expandedQuadGroupId === group.group_key;
                   const isToday = group.reservation_date === todayStr;
                   const uniqueModels = Array.from(new Set(group.items.map((r) => QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual')));
                   
                   return (
                     <div key={group.group_key} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden box-border">
                        <div className={cn("p-4 flex justify-between items-center cursor-pointer", isToday ? "bg-blue-50/50" : "bg-white")} onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest">Cliente</span>
                              <span className="font-black text-blue-950 uppercase">{group.customer_name}</span>
                              <span className="text-[10px] font-bold text-blue-800">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              {isToday && <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Hoje</span>}
                              <ChevronDown className={cn('w-5 h-5 text-blue-400 transition-transform', isExpanded && 'rotate-180')} />
                           </div>
                        </div>
                        
                        {isExpanded && (
                           <div className="p-4 bg-blue-50/30 border-t border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Modelos</span>
                                    <div className="flex flex-wrap gap-1">
                                       {uniqueModels.map((m, i) => <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded text-[9px] font-black">{m}</span>)}
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Total</span>
                                    <span className="font-black text-blue-900 text-xs">{formatCurrency(group.total_price)}</span>
                                 </div>
                              </div>
                              
                              <div className="space-y-2">
                                 <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Horários Reservados</span>
                                 {group.items.map((r, i) => (
                                   <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                      <div className="flex items-center gap-2">
                                         <Clock className="w-3.5 h-3.5 text-blue-500" />
                                         <span className="text-[11px] font-black text-blue-900">{r.time_slot}</span>
                                         <span className="text-[10px] font-bold text-blue-600/60">• {QUAD_MODELS_LABELS[r.quad_type] || 'Individual'}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-blue-900">{r.quantity} un.</span>
                                   </div>
                                 ))}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2">
                                 {group.items.some((r) => r.receipt_url) && (
                                   <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => window.open(group.items.find((r) => r.receipt_url)?.receipt_url)}>
                                     <FileCheck className="w-4 h-4" />
                                   </Button>
                                 )}
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => {setRescheduleData({ type: 'quad', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 bg-red-50 rounded-lg" onClick={() => requestDelete(group.items[0], 'quad')}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                           </div>
                        )}
                     </div>
                   );
                 })
               )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">`;

adminContent = adminContent.replace(quadTableTarget, quadCardsReplacement);
// Close the hidden md:block div after the quad table
adminContent = adminContent.replace('</table>\n            )}\n          </div>', '</table>\n            )}\n          </div>\n          </div>');

fs.writeFileSync(adminPath, adminContent);
console.log('Update complete v9 (Responsive Tabs & Cards)!');
