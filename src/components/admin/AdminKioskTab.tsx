import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  FileText, 
  Trash2, 
  Pencil, 
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { formatCurrency } from '@/lib/booking-types';
import { KIOSKS } from '@/lib/admin-constants';

interface AdminKioskTabProps {
  kioskReservations: any[];
  kioskSubTab: 'hoje' | 'futuras' | 'historico';
  setKioskSubTab: (tab: 'hoje' | 'futuras' | 'historico') => void;
  setEditingKioskGroup: (group: any) => void;
  setRescheduleData: (data: any) => void;
  setRescheduleDate: (date: Date) => void;
  requestDelete: (item: any, type: string) => void;
}

export function AdminKioskTab({
  kioskReservations,
  kioskSubTab,
  setKioskSubTab,
  setEditingKioskGroup,
  setRescheduleData,
  setRescheduleDate,
  requestDelete,
}: AdminKioskTabProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const allGroups = Object.values((kioskReservations || []).reduce((acc, curr) => {
    const key = `${curr.reservation_date}_${curr.customer_name || 'Venda'}`;
    if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Venda', items: [], total_price: 0 };
    acc[key].items.push(curr);
    acc[key].total_price += (curr.price || (KIOSKS.find(k => k.id === Number(curr.kiosk_id))?.price || 75));
    return acc;
  }, {} as Record<string, any>));

  const groupsByTab: Record<string, any[]> = {
    hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
    futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
    historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
  };
  const tabGroups = groupsByTab[kioskSubTab];

  const resolveGroup = (group: any) => {
    const dayKiosks = (kioskReservations || []).filter(k => k.reservation_date === group.reservation_date);
    const resolved = group.items.map((r: any) => {
      const bid = r.kiosk_id;
      if (bid === 1 || bid === '1' || bid === 'MAIOR') return KIOSKS.find(k => k.id === 1);
      if (bid === 'MENOR') {
        const menors = dayKiosks.filter(dk => dk.kiosk_id === 'MENOR');
        const idx = menors.findIndex(dk => dk.id === r.id);
        return KIOSKS.find(k => k.id === idx + 2) || { id: 99, name: 'Quiosque Extra', capacity: 'Até 15 pessoas' };
      }
      return KIOSKS.find(k => k.id === Number(bid)) || { id: 99, name: `Q-${bid}`, capacity: 'Até 15 pessoas' };
    });
    const names = resolved.map((k: any) => k?.name.replace('Quiosque ', 'Q-').replace('QUIOSQUE - ', 'Q-')).join(', ');
    return { names };
  };

  const subTabConfig = [
    { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-emerald-600 text-white' },
    { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
    { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
        <div className="p-6 border-b-2 border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold text-primary">Reservas de Quiosques</h3>
              <p className="text-xs text-muted-foreground">Gerencie todas as reservas por status</p>
            </div>
            <div className="flex flex-row overflow-x-auto gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
              {subTabConfig.map(t => (
                <button
                  key={t.key}
                  onClick={() => setKioskSubTab(t.key as any)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0',
                    kioskSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',
                    t.key === 'historico' && 'col-span-2 md:col-auto'
                  )}
                >
                  {t.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', kioskSubTab === t.key ? 'bg-white text-slate-800' : 'bg-slate-200 text-slate-600')}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
            {tabGroups.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
            ) : (
              tabGroups.map((group: any) => {
                const { names } = resolveGroup(group);
                const isTodayStr = group.reservation_date === todayStr;
                return (
                  <div key={group.group_key} className="bg-white rounded-2xl border-2 border-emerald-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                    <div className={cn("p-4 border-b border-emerald-100 flex justify-between items-center", isTodayStr ? "bg-emerald-50" : "bg-white")}>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Data da Visita</span>
                          <span className="font-black text-emerald-900">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                       </div>
                       {isTodayStr && <span className="bg-emerald-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm">Hoje</span>}
                    </div>
                    <div className="p-4 space-y-3">
                       <div>
                          <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Cliente</span>
                          <span className="font-black text-emerald-950 uppercase text-sm block">{group.customer_name}</span>
                          <span className="text-[10px] text-emerald-700 font-bold">{group.items.length} reserva(s) - {formatCurrency(group.total_price)}</span>
                       </div>
                       <div>
                          <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Quiosques</span>
                          <div className="flex flex-wrap gap-1.5">
                             {(names.split(', ') as string[]).map((n, i) => (
                               <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black border border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">{n}</span>
                             ))}
                          </div>
                       </div>
                       <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-50">
                          {group.items.some((r: any) => r.receipt_url) && (
                             <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
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
          <div className="hidden md:block">
            {tabGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                {kioskSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : kioskSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-[#0b2b24] text-[10px] font-black uppercase text-emerald-100/80 tracking-widest border-b-4 border-emerald-900">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Quiosques</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  {tabGroups.map((group: any) => {
                    const { names } = resolveGroup(group);
                    const isTodayStr = group.reservation_date === todayStr;
                    return (
                      <tr key={group.group_key} className={cn(
                        'border-b-2 border-slate-100 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:z-10 relative cursor-pointer',
                        isTodayStr ? 'bg-emerald-50/50 hover:bg-emerald-100' : 'bg-slate-50 hover:bg-white'
                      )}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 w-fit">
                            <span className={cn('font-black text-sm px-3 py-1 rounded-lg border', isTodayStr ? 'text-emerald-900 border-emerald-200 bg-white shadow-sm' : 'text-slate-700 border-slate-200 bg-white')}>
                              {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                            </span>
                            {isTodayStr && <span className="text-[9px] bg-emerald-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit mx-auto shadow-sm">HOJE</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-slate-900 uppercase text-base">{group.customer_name}</span>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">{group.items.length} reserva(s)</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-emerald-100 text-emerald-900 border-2 border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors font-bold px-3 py-1 shadow-sm">{names}</Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-lg text-emerald-700">{formatCurrency(group.total_price)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {group.items.some((r: any) => r.receipt_url) && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Alterar Quiosque"
                                onClick={() => setEditingKioskGroup(group)}
                              ><Pencil className="w-4 h-4" /></Button>
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Reagendar Data"
                                onClick={() => {
                                  setRescheduleData({ type: 'kiosk', group });
                                  setRescheduleDate(parseISO(group.reservation_date));
                                }}
                              ><CalendarClock className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => requestDelete(group.items[0], 'kiosk')}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
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
