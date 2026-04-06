import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  FileText, 
  Trash2, 
  Pencil, 
  CalendarClock,
  ChevronDown,
  Clock,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from "@/lib/utils";
import { formatCurrency } from '@/lib/booking-types';
import { QUAD_TIMES, QUAD_MODELS_LABELS } from '@/lib/admin-constants';

interface AdminQuadTabProps {
  quadReservations: any[];
  quadSubTab: 'hoje' | 'futuras' | 'historico';
  setQuadSubTab: (tab: 'hoje' | 'futuras' | 'historico') => void;
  expandedQuadGroupId: string | null;
  setExpandedQuadGroupId: (id: string | null) => void;
  editingId: string | null;
  editData: any;
  setEditData: (data: any) => void;
  startEditing: (item: any) => void;
  cancelEditing: () => void;
  saveEditing: (type: 'kiosk' | 'quad') => void;
  setEditingQuadItem: (item: any) => void;
  setRescheduleData: (data: any) => void;
  setRescheduleDate: (date: Date) => void;
  requestDelete: (item: any, type: string) => void;
  totalQuads?: number;
  onUpdateTotalQuads?: (val: number) => void;
}

export function AdminQuadTab({
  quadReservations,
  quadSubTab,
  setQuadSubTab,
  expandedQuadGroupId,
  setExpandedQuadGroupId,
  editingId,
  editData,
  setEditData,
  startEditing,
  cancelEditing,
  saveEditing,
  setEditingQuadItem,
  setRescheduleData,
  setRescheduleDate,
  requestDelete,
  totalQuads = 3,
  onUpdateTotalQuads
}: AdminQuadTabProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const allGroups = Object.values((quadReservations || []).reduce((acc, curr) => {
    const key = `${curr.reservation_date}_${curr.customer_name || 'Venda'}`;
    if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Cliente', items: [], total_price: 0, total_quantity: 0 };
    acc[key].items.push(curr);
    acc[key].total_price += (curr.price || 0);
    acc[key].total_quantity += (Number(curr.quantity) || 1);
    return acc;
  }, {} as Record<string, any>));

  const groupsByTab: Record<string, any[]> = {
    hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
    futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
    historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
  };
  const tabGroups = groupsByTab[quadSubTab];

  const subTabConfig = [
    { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-blue-600 text-white' },
    { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
    { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
  ];

  const normalizeQuadType = (t: string) => {
    const slow = (t || '').toLowerCase();
    if (slow.includes('dupla')) return 'dupla';
    if (slow.includes('criança') || slow.includes('crianca')) return 'adulto-crianca';
    return 'individual';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
        {/* Priority Control */}
        <div className="bg-amber-50 md:p-6 p-4 border-b-2 border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                 <Clock className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="text-xs md:text-sm font-black text-blue-950 uppercase tracking-wider">Capacidade Prioritária</h3>
                 <p className="text-[10px] text-blue-800 font-bold uppercase tracking-tighter">Define o total de quadriciclos disponíveis no sistema</p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-amber-700 uppercase ml-1 mb-1">Qtd. Total</span>
                 <input 
                   type="number" 
                   value={totalQuads} 
                   onChange={(e) => onUpdateTotalQuads?.(Number(e.target.value))}
                   className="w-24 h-11 rounded-xl border-2 border-amber-200 bg-white px-4 text-center font-black text-blue-900 focus:border-blue-500 transition-all outline-none"
                 />
              </div>
           </div>
        </div>

        <div className="p-6 border-b-2 border-slate-200 bg-blue-50/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-black text-blue-950">Reservas de Quadriciclos</h3>
              <p className="text-xs text-blue-900 font-bold">Clique em um grupo para ver os horários</p>
            </div>
            <div className="flex flex-row overflow-x-auto gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
              {subTabConfig.map(t => (
                <button
                  key={t.key}
                  onClick={() => setQuadSubTab(t.key as any)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                    quadSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',
                    t.key === 'historico' && 'col-span-2 md:col-auto'
                  )}
                >
                  {t.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', quadSubTab === t.key ? 'bg-white/30' : 'bg-slate-200')}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4 p-4 bg-blue-50/30">
             {tabGroups.length === 0 ? (
               <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
             ) : (
               tabGroups.map((group: any) => {
                 const isExpanded = expandedQuadGroupId === group.group_key;
                 const isTodayStr = group.reservation_date === todayStr;
                 const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual'))] || 'Individual')));
                 
                 return (
                   <div key={group.group_key} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden box-border">
                      <div className={cn("p-4 flex justify-between items-center cursor-pointer", isTodayStr ? "bg-blue-50/50" : "bg-white")} onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest">Cliente</span>
                            <span className="font-black text-blue-950 uppercase">{group.customer_name}</span>
                            <span className="text-[10px] font-bold text-blue-800">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                         </div>
                         <div className="flex items-center gap-3">
                            {isTodayStr && <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Hoje</span>}
                            <ChevronDown className={cn('w-5 h-5 text-blue-400 transition-transform', isExpanded && 'rotate-180')} />
                         </div>
                      </div>
                      
                      {isExpanded && (
                         <div className="p-4 bg-blue-50/30 border-t border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Modelos</span>
                                  <div className="flex flex-wrap gap-1">
                                     {(uniqueModels as string[]).map((m, i) => <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded text-[9px] font-black">{m}</span>)}
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Total</span>
                                  <span className="font-black text-blue-900 text-xs">{formatCurrency(group.total_price)}</span>
                               </div>
                            </div>
                            
                            <div className="space-y-2">
                               <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Horários Reservados</span>
                               {group.items.map((r: any, i: number) => (
                                 <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                       <Clock className="w-3.5 h-3.5 text-blue-500" />
                                       <span className="text-[11px] font-black text-blue-900">{r.time_slot}</span>
                                       <span className="text-[10px] font-bold text-blue-600/60">- {QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || 'individual')] || 'Individual'}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-blue-900">{r.quantity} un.</span>
                                 </div>
                               ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                               {group.items.some((r: any) => r.receipt_url) && (
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                   <FileText className="w-4 h-4" />
                                 </Button>
                               )}
                               <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => setEditingQuadItem(group.items[0])}><Pencil className="w-4 h-4" /></Button>
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
          <div className="hidden md:block">
            {tabGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                {quadSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : quadSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-[#0f172a] text-[10px] font-black uppercase text-blue-100/80 tracking-widest border-b-4 border-blue-900">
                  <tr>
                    <th className="px-6 py-4 w-8"></th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Modelos</th>
                    <th className="px-6 py-4 text-center">Total Quadriciclos</th>
                    <th className="px-6 py-4">Valor Total</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  {tabGroups.map((group: any) => {
                    const isExpanded = expandedQuadGroupId === group.group_key;
                    const isTodayStr = group.reservation_date === todayStr;
                    const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual'))] || 'Individual')));

                    return (
                      <React.Fragment key={group.group_key}>
                        <tr
                          className={cn(
                            'border-b-2 border-slate-100 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:z-10 relative',
                            isTodayStr ? 'bg-blue-50/40 hover:bg-blue-100/60' : 'bg-slate-50 hover:bg-white',
                            isExpanded && 'bg-blue-100/40 border-blue-300'
                          )}
                          onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}
                        >
                          <td className="px-4 py-4 text-center">
                            <ChevronDown className={cn('w-4 h-4 text-blue-600 transition-transform', isExpanded && 'rotate-180')} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 w-fit">
                              <span className={cn('font-black text-sm px-3 py-1 rounded-lg border', isTodayStr ? 'text-blue-900 border-blue-200 bg-white shadow-sm' : 'text-slate-700 border-slate-200 bg-white')}>
                                {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                              </span>
                              {isTodayStr && <span className="text-[9px] bg-blue-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit mx-auto shadow-sm">HOJE</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-slate-900 uppercase text-base">{group.customer_name}</span>
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">{group.items.length} horário(s) reservado(s)</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {(uniqueModels as string[]).map((m, i) => (
                                <Badge key={i} variant="outline" className="border-indigo-200 text-indigo-900 font-bold bg-indigo-50/80 px-2 py-0.5 text-[10px]">{m}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className="bg-blue-100 text-blue-950 border-2 border-blue-200 shadow-sm font-black px-3 py-1">{group.total_quantity} quadriciclos</Badge>
                          </td>
                          <td className="px-6 py-4 font-black text-lg text-blue-800">{formatCurrency(group.total_price)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                              {group.items.some((r: any) => r.receipt_url) && (
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all shadow-sm rounded-xl" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all" onClick={() => setEditingQuadItem(group.items[0])}><Pencil className="w-4 h-4" /></Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Reagendar"
                                onClick={() => {
                                  setRescheduleData({ type: 'quad', group });
                                  setRescheduleDate(parseISO(group.reservation_date));
                                }}
                              ><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => requestDelete(group.items[0], 'quad')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && group.items.map((r: any, idx: number) => {
                          const isEditing = editingId === r.id;
                          return (
                            <tr key={r.id} className={cn("bg-blue-50/30 border-b border-blue-100 transition-all", isEditing ? "bg-amber-50/40" : "")}>
                              <td className="px-4 py-2"></td>
                              <td className="px-6 py-2">
                                {isEditing ? (
                                  <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                     <SelectTrigger className="h-8 text-[11px] font-black w-32 border-blue-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                        {QUAD_TIMES.map(t => <SelectItem key={t} value={t} className="text-[11px] font-bold">{t}</SelectItem>)}
                                     </SelectContent>
                                  </Select>
                                ) : (
                                  <span className={cn(
                                    'text-[10px] font-black uppercase px-2 py-0.5 rounded-md w-fit inline-block border flex items-center gap-1.5 shadow-sm',
                                    (r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') 
                                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                      : 'bg-blue-50 text-blue-700 border-blue-100'
                                  )}>
                                    {(r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') ? (
                                      <>
                                        <AlertTriangle className="w-3 h-3" />
                                        {r.time_slot === 'INDIV' ? 'HORÁRIO NÃO DEFINIDO' : 'DUPLA (AGUARDANDO)'}
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3" />
                                        {r.time_slot}
                                      </>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-2 text-[11px] text-blue-700/60 font-black uppercase tracking-wider">Item #{idx + 1}</td>
                              <td className="px-6 py-2">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1 w-32">
                                    <Select value={editData.quad_type || 'individual'} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                       <SelectTrigger className="h-7 text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] border-blue-100 text-blue-700 bg-white/50 font-black tracking-widest px-2">
                                    {QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual'))] || 'Individual'}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-6 py-2 text-center">
                                {isEditing ? (
                                  <input
                                    type="number" min="1" max="20"
                                    className="w-16 h-8 text-[12px] font-black border-2 border-blue-300 rounded-lg px-2 text-center bg-white shadow-sm"
                                    value={editData.quantity ?? r.quantity ?? 1}
                                    onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})}
                                  />
                                ) : (
                                  <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                )}
                              </td>
                              <td className="px-6 py-2 text-[11px] font-extrabold text-blue-700">{formatCurrency(r.price || 0)}</td>
                              <td className="px-6 py-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isEditing ? (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200" onClick={() => saveEditing('quad')}>
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 bg-white hover:bg-slate-100 border border-slate-200" onClick={cancelEditing}>
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 flex items-center justify-center" onClick={(e: any) => { e.stopPropagation(); startEditing(r); }}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100" onClick={(e: any) => { e.stopPropagation(); requestDelete(r, 'quad'); }}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
