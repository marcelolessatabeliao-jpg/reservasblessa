import React from 'react';
import { format, isToday, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Bike, 
  Tent, 
  CalendarCheck, 
  AlertTriangle,
  HelpCircle,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { cn } from "@/lib/utils";
import { KIOSKS } from '@/lib/admin-constants';

interface AdminDashboardTabProps {
  targetDate: Date;
  setTargetDate: (date: Date) => void;
  kioskReservations: any[];
  quadReservations: any[];
  bookings: any[];
  orders: any[];
  isAllowedDay: (date: Date) => boolean;
  isHoliday: (date: Date) => boolean;
  totalQuads?: number;
}

export function AdminDashboardTab({
  targetDate,
  setTargetDate,
  kioskReservations,
  quadReservations,
  bookings,
  orders,
  isAllowedDay,
  isHoliday,
  totalQuads = 3
}: AdminDashboardTabProps) {
  
  const matchDate = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const s1 = typeof d1 === 'string' ? d1.split('T')[0] : format(d1, 'yyyy-MM-dd');
    const s2 = typeof d2 === 'string' ? d2.split('T')[0] : format(d2, 'yyyy-MM-dd');
    return s1 === s2;
  };

  const dayKiosks = (kioskReservations || []).filter(r => {
    try {
      const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
      return matchDate(d, targetDate);
    } catch { return false; }
  });
  
  const dayQuads = (quadReservations || []).filter(r => {
    try {
      const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
      return matchDate(d, targetDate);
    } catch { return false; }
  });

  const dayBookings = bookings.filter(b => 
    matchDate(b.visit_date, targetDate) && 
    b.status !== 'awaiting_payment' && 
    b.status !== 'pending' &&
    b.status !== 'cancelled'
  );

  // Add virtual items from bookings to visual map
  dayBookings.forEach(b => {
    const bItems = b.order_items || [];
    
    bItems.forEach((item: any) => {
      const pNameLower = (item.product_name || '').toLowerCase();
      if (pNameLower.includes('quiosque') || pNameLower.includes('camping')) {
         const kioskIdMatch = pNameLower.match(/quiosque\s*(\d+)/i);
         const kId = kioskIdMatch ? parseInt(kioskIdMatch[1], 10) : (pNameLower.includes('maior') ? 1 : 'MENOR');

         if (!dayKiosks.some(dk => dk.order_item_id === item.id || (dk.id === b.id && dk.kiosk_id === kId))) {
            dayKiosks.push({
               id: b.id + '-' + item.id,
               kiosk_id: kId,
               customer_name: b.customer_name || b.name || 'Cliente',
               reservation_date: b.visit_date,
               status: b.status,
               order_item_id: item.id
            });
         }
      }
    });
    
    const quadKeywords = ['quadri', 'passeio', 'quadriciclo'];
    const quadItems = bItems.filter((i: any) => quadKeywords.some(k => (i.product_name || '').toLowerCase().includes(k)));
    
    quadItems.forEach((qi: any) => {
       const qiId = b.id + '-' + qi.id;
       const pName = (qi.product_name || '').toLowerCase();
       let qType = 'individual';
       if (pName.includes('dupla')) qType = 'dupla';
       else if (pName.includes('crian')) qType = 'adulto-crianca';
       
       if (!dayQuads.some(dq => dq.order_item_id === qi.id || dq.id === qiId)) {
          dayQuads.push({
             id: qiId,
             customer_name: b.customer_name || b.name || 'Cliente',
             reservation_date: b.visit_date,
             time_slot: qi.metadata?.time || b.quad_time_slot || '10:30',
             quantity: qi.quantity || 1,
             status: b.status,
             order_item_id: qi.id,
             quad_type: qType
          });
       }
    });
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8 animate-in fade-in duration-500 max-w-full overflow-hidden">
      <div className="space-y-8 min-w-0">
        <Card className="bg-transparent border-none text-emerald-950 shadow-none p-0">
           <div className="rounded-[1.5rem] border-2 border-amber-300 bg-amber-100/50 overflow-hidden mb-0 shadow-lg backdrop-blur-sm">
              <div className="p-3 md:p-5 border-b border-amber-300 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-4 border-r-0 md:border-r border-amber-300/50 pr-4">
                    <div className="w-12 h-12 bg-emerald-800 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-sm border border-emerald-400/30">
                       {targetDate.getDate()}
                    </div>
                     <div>
                        <h3 className="text-2xl md:text-3xl font-black text-emerald-950 tracking-tight leading-tight">Operação Diária</h3>
                        <p className="text-[10px] md:text-xs font-black text-emerald-950/60 uppercase tracking-widest">{format(targetDate, "EEEE, yyyy", { locale: ptBR })}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 md:ml-4">
                    <HelpCircle className="w-4 h-4 text-amber-800 opacity-50" />
                    <h4 className="font-black text-amber-950 text-lg md:text-xl tracking-tight">Resumo de {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}</h4>
                  </div>
               </div>
               <div className="grid grid-cols-1 xl:grid-cols-2">
                  {/* Left: Quiosques */}
                  <div className="p-4 md:p-6 border-b xl:border-b-0 xl:border-r border-amber-300 bg-emerald-100/40 space-y-4">
                     <h4 className="text-[14px] font-black text-emerald-800 flex items-center gap-3">
                        <Users className="w-5 h-5 text-emerald-700" /> Quiosques ({dayKiosks.length}/5)
                     </h4>
                     
                     <div className="flex flex-col gap-2.5">
                       {KIOSKS.map(k => {
                        const booking = dayKiosks.find(b => {
                          const bid = b.kiosk_id;
                          if (bid === 1 || bid === '1' || bid === 'MAIOR') return k.id === 1;
                          if (bid === 'MENOR') {
                             const dayOrderMenors = dayKiosks.filter(dk => dk.kiosk_id === 'MENOR');
                             const orderIdx = dayOrderMenors.findIndex(dk => dk.id === b.id);
                             if (k.id === orderIdx + 2) return true;
                          }
                          return Number(bid) === k.id;
                        });
                        
                        return (
                          <div key={k.id} className="bg-white rounded-xl p-3 shadow-sm border border-emerald-200 flex items-center justify-between group hover:bg-emerald-800 transition-all cursor-default">
                             <span className="font-black text-emerald-950 text-[12px] md:text-[13px] group-hover:text-white transition-colors">{k.name}</span>
                             {booking ? (
                               <span className="text-emerald-700 font-bold italic text-[12px] md:text-[13px] text-right group-hover:text-emerald-100 transition-colors truncate max-w-[140px]">
                                  {booking.customer_name}
                               </span>
                             ) : (
                               <span className="text-emerald-800/80 italic font-bold text-[12px] md:text-[13px] group-hover:text-emerald-200/50 transition-colors">Livre</span>
                             )}
                          </div>
                        );
                      })}
                   </div>
                  </div>

                  {/* Right: Quadriciclos */}
                  <div className="p-4 md:p-6 bg-blue-100/30 space-y-4">
                     <h4 className="text-[14px] font-black text-blue-800 flex items-center gap-3">
                        <Bike className="w-5 h-5 text-blue-700" /> Quadriciclos
                     </h4>
                  
                     <div className="flex flex-col gap-2.5">
                        {[
                          { start: '09:00', end: '10:30' },
                          { start: '10:30', end: '12:00' },
                          { start: '14:00', end: '15:30' },
                          { start: '15:30', end: '17:00' }
                        ].map(slot => {
                          const slotBookings = dayQuads.filter(b => {
                              const bSlot = (b.time_slot || '').split('(')[0].toUpperCase().replace(/H/g, ':').trim();
                              const target = slot.start.toUpperCase();
                              return bSlot === target || (bSlot.length > 2 && target.includes(bSlot)) || (target.length > 2 && bSlot.includes(target));
                          });
                          const count = slotBookings.reduce((s, r) => s + (Number(r.quantity) || 1), 0);
                          
                          return (
                            <div key={slot.start} className="bg-white rounded-[1.25rem] p-3 shadow-sm border border-blue-200/80 space-y-2">
                               <div className="flex items-center justify-between px-1">
                                  <span className="font-black text-blue-900 text-[12px] md:text-[13px]">{slot.start} - {slot.end}</span>
                                  <span className="text-blue-600 font-bold text-[10px] md:text-[11px]">{count}/{totalQuads} ocupados</span>
                               </div>
                               
                               <div className="rounded-xl border border-blue-50 bg-blue-50/20 p-2 min-h-[36px] flex items-center justify-center">
                                  {slotBookings.length > 0 ? (
                                    <div className="flex flex-col gap-2 w-full">
                                       {Object.values(slotBookings.reduce((acc, curr) => {
                                           const name = curr.customer_name || 'Cliente';
                                           const type = curr.quad_type || 'individual';
                                           const typeLabel = type === 'dupla' ? 'Dupla' : (type === 'adulto-crianca' ? 'Kids' : 'Indiv.');
                                           const key = `${name}_${type}`;
                                           if (!acc[key]) acc[key] = { name, quantity: 0, typeLabel };
                                           acc[key].quantity += (Number(curr.quantity) || 1);
                                           return acc;
                                        }, {} as any)).map((b: any, bi) => (
                                          <div key={bi} className="bg-white/80 p-2 rounded-lg border border-blue-100 flex items-center justify-between shadow-sm group hover:bg-blue-600 transition-all cursor-default">
                                             <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-blue-900 font-extrabold text-[13px] group-hover:text-white capitalize truncate">
                                                  {b.name}
                                                </span>
                                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-black group-hover:bg-white/20 group-hover:text-white shrink-0">
                                                  {b.typeLabel}
                                                </span>
                                             </div>
                                             <span className="text-blue-600 font-bold text-[11px] bg-blue-50 px-2 py-0.5 rounded-full group-hover:bg-blue-500 group-hover:text-white ml-2">({b.quantity})</span>
                                          </div>
                                        ))}
                                    </div>
                                  ) : (
                                    <span className="text-blue-400/50 italic font-black text-[11px]">Nenhuma reserva</span>
                                  )}
                               </div>
                            </div>
                          );
                        })}
                     </div>
                  </div>
               </div>

              <div className="p-3 md:p-5 border-t border-amber-300 bg-amber-100/60 flex items-center justify-center text-center">
                 <p className="text-amber-900 font-black uppercase tracking-[0.1em] text-[11px]">
                    Total de Reservas no Dia: {dayKiosks.length + dayQuads.length}
                 </p>
              </div>
           </div>
        </Card>
      </div>

      <div className="space-y-6">
         <Card className="bg-white border-2 border-emerald-100 shadow-sm rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-emerald-100 bg-emerald-50/50">
               <div className="flex items-center gap-3 mb-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-800" />
                  <h4 className="text-lg font-black text-emerald-950 tracking-tight">Resumo Geral</h4>
               </div>
               <p className="text-[11px] font-bold text-emerald-800/70 leading-relaxed mb-6">
                  Selecione uma data para organizar seu dia de operações.
               </p>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-800 text-white rounded-xl text-[9px] font-black uppercase tracking-wider">
                     <Tent className="w-3.5 h-3.5" /> Quiosques
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider">
                     <Bike className="w-3.5 h-3.5" /> Quads
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2 px-3 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider">
                     <Users className="w-3.5 h-3.5" /> Reservas (Entrada)
                  </div>
               </div>
            </div>

            <div className="p-4 bg-white">
              <Calendar
                mode="single"
                selected={targetDate}
                onSelect={(d) => d && setTargetDate(d)}
                className="p-0 pointer-events-auto"
                locale={ptBR}
                toDate={new Date(2030, 11, 31)}
                fromDate={new Date(2024, 0, 1)}
                classNames={{
                  months: "w-full flex flex-col",
                  month: "w-full space-y-6",
                  caption: "relative flex items-center justify-between w-full h-14 bg-emerald-800 rounded-2xl border-2 border-emerald-900 shadow-xl mb-4 px-3",
                  caption_label: "text-[10px] md:text-[12px] font-black text-white uppercase tracking-[0.2em] flex-1 text-center",
                  nav: "absolute inset-x-0 inset-y-0 flex items-center justify-between px-2 pointer-events-none z-30",
                  nav_button: "h-7 w-7 md:h-9 md:w-9 bg-emerald-500 text-white border border-emerald-400 hover:bg-emerald-400 shadow-lg rounded-[0.5rem] transition-all pointer-events-auto flex items-center justify-center",
                  nav_button_previous: "relative",
                  nav_button_next: "relative",
                  table: "w-full border-collapse table-fixed",
                  head_cell: "text-emerald-900 font-extrabold text-[10px] md:text-[11px] uppercase tracking-[0.1em] md:tracking-[0.2em] w-[14.28%] py-4 text-center",
                  cell: "h-10 md:h-14 w-[14.28%] text-center p-0 relative focus-within:z-20",
                  day: cn(
                    "h-12 w-12 p-0 font-black text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto",
                    "flex flex-col items-center justify-center gap-1"
                  ),
                  day_selected: "!bg-emerald-800 !text-white hover:!bg-emerald-700 !border-emerald-800 shadow-xl shadow-emerald-900/30 !opacity-100 rounded-full",
                  day_today: "bg-yellow-400 text-emerald-950 border-yellow-500 shadow-lg font-black ring-2 ring-yellow-200 ring-offset-2 rounded-full",
                  day_outside: "text-emerald-900/60 font-bold opacity-30 bg-transparent shadow-none border-transparent",
                  day_disabled: "opacity-25 cursor-not-allowed bg-transparent border-transparent shadow-none",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const selectedStr = format(targetDate, 'yyyy-MM-dd');
                    const isSelected = dateStr === selectedStr;
                    const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                    const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                    const hasAnyBooking = (bookings || []).some(b => {
                      const bDate = typeof b.visit_date === 'string' ? b.visit_date.split('T')[0] : format(new Date(b.visit_date), 'yyyy-MM-dd');
                      return bDate === dateStr;
                    }) || (orders || []).some(o => {
                      const oDate = o.visit_date || (o.created_at ? o.created_at.split('T')[0] : '');
                      return oDate === dateStr && o.status !== 'cancelled' && o.status !== 'awaiting_payment';
                    });
                    
                    const isSimpleBooking = hasAnyBooking && !hasKiosk && !hasQuad;
                    const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                    const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= (totalQuads * 4);
                    const isDayToday = isToday(date);
                    const isFull = kiosksFull && quadsFull;
                    const isClosed = !isAllowedDay(date);

                    return (
                      <div className={cn(
                        "relative flex flex-col items-center rounded-full w-full h-full justify-center transition-all", 
                        isFull && !isSelected && "bg-red-50/50 border border-red-100",
                        isClosed && !isSelected && "opacity-25 grayscale-[0.5]"
                      )}>
                        <span className={cn(
                          "font-black",
                          isSelected ? "text-white" : isDayToday ? "text-emerald-950" : "",
                          isFull && !isSelected && "text-red-600",
                          isClosed && !isSelected && "text-emerald-900/40"
                        )}>{date.getDate()}</span>
                        <div className="flex gap-1 mt-0.5">
                          {hasKiosk && <div className={cn("w-2 h-2 rounded-full shadow-md border border-white/40", kiosksFull ? "bg-red-600" : "bg-emerald-600")} />}
                          {hasQuad && <div className={cn("w-2 h-2 rounded-full shadow-md border border-white/40", quadsFull ? "bg-red-600" : "bg-blue-600")} />}
                          {isSimpleBooking && <div className="w-2 h-2 rounded-full bg-red-500 shadow-md border border-white/40" />}
                        </div>
                      </div>
                    );
                  }
                }}
                modifiers={{
                  holiday: (day) => isHoliday(day),
                }}
                modifiersStyles={{
                  holiday: { border: '2px dashed #10b981', color: '#059669' }
                }}
              />
            </div>
         </Card>
      </div>
    </div>
  );
}
