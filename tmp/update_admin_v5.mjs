import fs from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Convert Kiosk Table to Responsive Content
// Find the div that starts the table section in renderKioskTab
const kioskTableStart = '<div className="overflow-x-auto">\n            {tabGroups.length === 0 ? (';
const kioskResponsiveContent = `          {/* Responsive Content */}
          <div className="block">
            {tabGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                {kioskSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : kioskSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {tabGroups.map((group: any) => {
                    const { names, capacity } = resolveGroup(group);
                    const isToday = group.reservation_date === todayStr;
                    return (
                      <div key={group.group_key} className={cn(
                        "p-4 space-y-3",
                        isToday ? "bg-emerald-50/60" : "bg-white"
                      )}>
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <span className={cn('font-black text-sm', isToday ? 'text-emerald-800' : 'text-emerald-900')}>
                              {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                            </span>
                            {isToday && <span className="text-[9px] bg-emerald-700 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit">HOJE</span>}
                          </div>
                          <div className="text-right">
                             <div className="font-black text-emerald-950 uppercase text-xs">{group.customer_name}</div>
                             <div className="text-[10px] text-emerald-700 font-bold">{formatCurrency(group.total_price)}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                           <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 font-bold text-[10px] shadow-sm">{names}</Badge>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {group.items.some((r: any) => r.receipt_url) && (
                            <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                              <FileText className="w-4 h-4 mr-2" /> Recibo
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline"
                            className="h-9 px-3 rounded-xl border-blue-200 text-blue-600 font-black text-[10px]"
                            onClick={() => {
                              setRescheduleData({ type: 'kiosk', group });
                              setRescheduleDate(parseISO(group.reservation_date));
                            }}
                          ><CalendarClock className="w-4 h-4 mr-2" /> Reagendar</Button>
                          <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-red-200 text-red-500 font-black text-[10px]" onClick={() => requestDelete(group.items[0], 'kiosk')}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">`;

// We need to find where the table ends to close the divs
const kioskTableEnd = '</table>\n            )}\n          </div>';
const kioskResponsiveContentEnd = '</table>\n                </div>\n              </>\n            )}\n          </div>';

// This is tricky with simple replace. I'll use a more surgical approach.
content = content.replace(kioskTableStart, kioskResponsiveContent);
content = content.replace(kioskTableEnd, kioskResponsiveContentEnd);

// 2. Convert Quad Table to Responsive Content
const quadTableStart = '<div className="overflow-x-auto">\n            {tabGroups.length === 0 ? (';
const quadResponsiveContent = `          {/* Responsive Content */}
          <div className="block">
            {tabGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                {quadSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : quadSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-blue-100">
                  {tabGroups.map((group: any) => {
                    const isExpanded = expandedQuadGroupId === group.group_key;
                    const isToday = group.reservation_date === todayStr;
                    const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual')));
                    
                    return (
                      <div key={group.group_key} className={cn(
                        "p-4 space-y-4 transition-all",
                        isToday ? "bg-blue-50/60" : "bg-white",
                        isExpanded && "bg-blue-100/40"
                      )}>
                        <div className="flex justify-between items-start" onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                          <div className="flex flex-col gap-1">
                            <span className={cn('font-black text-sm', isToday ? 'text-blue-700' : 'text-blue-900')}>
                              {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                            </span>
                            {isToday && <span className="text-[9px] bg-blue-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit">HOJE</span>}
                          </div>
                          <div className="text-right">
                             <div className="font-black text-blue-950 uppercase text-xs">{group.customer_name}</div>
                             <Badge className="bg-blue-100 text-blue-950 border-0 font-black text-[9px] px-1.5">{group.total_quantity} quads</Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {(uniqueModels as string[]).map((m, i) => (
                            <Badge key={i} variant="outline" className="border-blue-200 text-blue-800 font-bold bg-blue-50/50 text-[9px]">{m}</Badge>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                           <Button variant="ghost" size="sm" className="text-blue-600 font-black text-[10px] h-8 px-2" onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                              {isExpanded ? 'Ocultar Horários' : 'Ver Horários'}
                              <ChevronDown className={cn('w-3 h-3 ml-1 transition-transform', isExpanded && 'rotate-180')} />
                           </Button>
                           <div className="flex gap-2">
                              {group.items.some((r: any) => r.receipt_url) && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => {
                                setRescheduleData({ type: 'quad', group });
                                setRescheduleDate(parseISO(group.reservation_date));
                              }}><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(group.items[0], 'quad')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                           </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-2 mt-2 bg-white/40 p-2 rounded-xl border border-blue-100">
                             {group.items.map((r: any, idx: number) => (
                               <div key={r.id} className="flex justify-between items-center text-[10px] border-b border-blue-50 last:border-0 pb-1">
                                  <div className="flex flex-col">
                                     <span className="font-black text-blue-900 uppercase tracking-tighter">
                                        {r.time_slot === 'INDIV' ? 'HORÁRIO NÃO DEF.' : r.time_slot}
                                     </span>
                                     <span className="text-blue-700/60 font-bold">
                                        {QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual'} ({r.quantity || 1}x)
                                     </span>
                                  </div>
                                  <div className="font-black text-blue-800">{formatCurrency(r.price || 0)}</div>
                               </div>
                             ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">`;

const quadTableEnd = '</tbody>\n              </table>\n            )}\n          </div>';
const quadResponsiveContentEnd = '</tbody>\n                  </table>\n                </div>\n              </>\n            )}\n          </div>';

// Surgeon again
content = content.replace(quadTableStart, quadResponsiveContent);
content = content.replace(quadTableEnd, quadResponsiveContentEnd);

fs.writeFileSync(filePath, content);
console.log('Update complete v5!');
