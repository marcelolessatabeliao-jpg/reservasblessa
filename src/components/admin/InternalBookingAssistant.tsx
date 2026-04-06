import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar as CalendarIcon, CalendarPlus, User, Phone, Tag,
  Hash, ArrowRight, Loader2, Check, Bike, Accessibility, Gift, GraduationCap, X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBookedKioskIds, getQuadAvailability } from '@/lib/booking-service';
import { getQuadDiscount } from '@/lib/booking-types';

const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, type: 'Menor' }
];

export function InternalBookingAssistant({ 
  onCreated, 
  isAllowedDay, 
  isHoliday, 
  kioskReservations = [], 
  quadReservations = [] 
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({'09:00': 3, '10:30': 3, '14:00': 3, '15:30': 3});
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const { toast } = useToast();
  const [generatedPix, setGeneratedPix] = useState<any>(null);

  const QUAD_TIMES = ['09:00', '10:30', '14:00', '15:30'];

  const initialData = {
    name: '', phone: '', visit_date: '',
    adults_normal: 1, adults_half: 0, is_teacher: 0, is_student: 0, 
    is_server: 0, is_donor: 0, is_solidarity: 0, is_pcd: 0, is_tea: 0, 
    is_senior: 0, is_birthday: 0, children_free: 0,
    selected_kiosks: [] as number[],
    quads: [] as any[],
    manual_discount: 0,
    manual_discount_type: 'unit' as 'unit' | 'percent',
    status: 'pending'
  };

  const [newBookingData, setNewBookingData] = useState(initialData);

  useEffect(() => {
    const fetchCustomerInfo = async () => {
      const p = newBookingData.phone.replace(/\D/g, '');
      if (p.length >= 10 && !newBookingData.name) {
         const { data } = await supabase.from('orders').select('customer_name').eq('customer_phone', p).limit(1).maybeSingle();
         if (data?.customer_name) {
            setNewBookingData(prev => ({...prev, name: data.customer_name}));
         }
      }
    };
    fetchCustomerInfo();
  }, [newBookingData.phone]);

  useEffect(() => {
    const fetchOccupied = async () => {
      if (!newBookingData.visit_date) return;
      setIsFetchingAvail(true);
      const ids = await getBookedKioskIds(newBookingData.visit_date);
      setBookedIds(ids);

      const avail: any = {};
      for (const t of QUAD_TIMES) {
        const used = await getQuadAvailability(newBookingData.visit_date, t);
        avail[t] = Math.max(0, 3 - used);
      }
      setSlotAvailabilities(avail);
      setIsFetchingAvail(false);
    };
    fetchOccupied();
  }, [newBookingData.visit_date]);

  const handleCreateInternalBooking = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-internal-order', {
        body: {
          ...newBookingData,
          total_amount: calculateTotalRaw()
        }
      });

      if (error) throw error;
      
      if (newBookingData.status === 'pending' && data?.pix) {
          setGeneratedPix(data.pix);
      } else {
          toast({ title: 'Sucesso!', description: 'Reserva criada com sucesso.' });
          setIsOpen(false);
          onCreated();
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao criar reserva.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalRaw = () => {
    const { 
      adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, 
      selected_kiosks, quads, manual_discount, visit_date 
    } = newBookingData;
    
    let total = (adults_normal * 50) + 
      ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
      
    selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
    
    const qD = getQuadDiscount(visit_date);
    quads.forEach(q => {
      const b = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
      total += (b * (1 - qD)) * q.quantity;
    });
    
    const disc = newBookingData.manual_discount_type === 'percent' ? (total * (manual_discount / 100)) : manual_discount;
    return Math.max(0, total - disc);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (open) setNewBookingData(initialData); 
        setIsOpen(open);
        if (!open) {
          setGeneratedPix(null);
          setNewBookingData(initialData);
        }
    }}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 md:h-14 px-6 md:px-8 shadow-xl hover:scale-105 active:scale-95 transition-all border-0 text-xs md:text-sm uppercase tracking-wider flex items-center gap-3">
          <CalendarPlus className="w-5 h-5 flex-shrink-0" /> <span className="hidden sm:inline">Nova Reserva</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-4xl bg-slate-50 rounded-[2rem] border-4 border-emerald-200 overflow-hidden p-0 max-h-[95vh] flex flex-col shadow-3xl">
        <div className="bg-emerald-600 p-6 text-center shrink-0 border-b-4 border-emerald-700 shadow-lg relative overflow-hidden">
          <DialogTitle className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3">
             <CalendarPlus className="w-7 h-7" /> Assistente de Reserva Interna
          </DialogTitle>
          <p className="text-emerald-100 text-[10px] md:text-[11px] font-black uppercase mt-1.5 tracking-widest bg-emerald-700/50 inline-block px-4 py-1.5 rounded-full border border-emerald-500/30">LÓGICA INTEGRADA • SEM CPF</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {generatedPix ? (
             <div className="flex flex-col items-center py-10 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-2xl border-8 border-emerald-500/20">
                   <img src={`data:image/png;base64,${generatedPix.encodedImage}`} alt="QR" className="w-56 h-56" />
                </div>
                <Button onClick={() => { setIsOpen(false); setGeneratedPix(null); onCreated(); }} className="w-full max-w-sm h-16 bg-emerald-950 text-white hover:bg-emerald-900 rounded-2xl font-black transition-all">CONCLUÍDO - FECHAR</Button>
             </div>
          ) : (
             <>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Nome do Cliente
                   </label>
                   <Input 
                      value={newBookingData.name} 
                      onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                      className="h-12 rounded-2xl border border-emerald-200 font-bold bg-white text-sm" placeholder="Nome Completo"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Telefone
                   </label>
                   <Input 
                      value={newBookingData.phone} 
                      onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                      className="h-12 rounded-2xl border border-emerald-200 font-bold bg-white text-sm" placeholder="DDD + Número"
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" /> Data da Visita
                   </label>
                   <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                         <Button variant="outline" className={cn("h-12 w-full rounded-2xl border border-emerald-200 font-black text-sm", !newBookingData.visit_date && "text-emerald-500 border-emerald-300")} disabled={isFetchingAvail}>
                            {newBookingData.visit_date ? format(parseISO(newBookingData.visit_date), 'dd/MM/yyyy') : "DD/MM/AAAA"}
                            <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                         </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[1.5rem] border-emerald-100 shadow-2xl" align="start">
                         <Calendar
                            mode="single"
                            selected={newBookingData.visit_date ? parseISO(newBookingData.visit_date) : undefined}
                            onSelect={(date) => {
                               setNewBookingData({...newBookingData, visit_date: date ? format(date, 'yyyy-MM-dd') : ''});
                               setIsCalendarOpen(false);
                            }}
                            locale={ptBR}
                            disabled={(date) => {
                               const today = new Date();
                               today.setHours(0,0,0,0);
                               return date < today || !isAllowedDay(date);
                            }}
                            className="p-3"
                            classNames={{
                               day_today: "bg-emerald-100 text-emerald-900 font-bold rounded-lg",
                               day_selected: "bg-emerald-600 text-white font-bold hover:bg-emerald-600 hover:text-white rounded-lg",
                            }}
                            components={{
                              DayContent: ({ date }) => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const hasKiosk = (kioskReservations || []).some((r: any) => r.reservation_date === dateStr);
                                const hasQuad = (quadReservations || []).some((r: any) => r.reservation_date === dateStr);
                                const kiosksFull = (kioskReservations || []).filter((r: any) => r.reservation_date === dateStr).length >= 5;
                                const quadsFull = (quadReservations || []).filter((r: any) => r.reservation_date === dateStr).reduce((s: any, r: any) => s + (Number(r.quantity) || 1), 0) >= 20;
                                const isFull = kiosksFull && quadsFull;
                                return (
                                  <div className={cn("relative flex flex-col items-center p-0.5 rounded w-full h-full justify-center", isFull && "bg-red-50/50")}>
                                    <span className={cn("text-[11px]", isFull && "text-red-500 font-black")}>{date.getDate()}</span>
                                    <div className="flex gap-0.5 mt-0.5">
                                      {hasKiosk && <div className={cn("w-1 h-1 rounded-full", kiosksFull ? "bg-red-500" : "bg-emerald-500")} />}
                                      {hasQuad && <div className={cn("w-1 h-1 rounded-full", quadsFull ? "bg-red-500" : "bg-blue-500")} />}
                                    </div>
                                  </div>
                                );
                              }
                            }}
                         />
                         <div className="flex justify-between p-2 border-t border-emerald-50">
                            <Button variant="ghost" size="sm" onClick={() => setNewBookingData({...newBookingData, visit_date: ''})} className="text-[10px] uppercase font-black text-emerald-600 h-8">Limpar</Button>
                            <Button variant="ghost" size="sm" onClick={() => { setNewBookingData({...newBookingData, visit_date: format(new Date(), 'yyyy-MM-dd')}); setIsCalendarOpen(false); }} className="text-[10px] uppercase font-black text-emerald-600 h-8">Hoje</Button>
                         </div>
                      </PopoverContent>
                   </Popover>
                </div>
             </div>

             <div className="bg-white p-5 rounded-[2rem] border border-emerald-100 shadow-sm space-y-4">
                <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-50 pb-3">
                   <Users className="w-4 h-4" /> 1. Participantes
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                   {[
                      { k: 'adults_normal', l: 'Adulto Integral', p: 'R$ 50' },
                      { k: 'adults_half', l: 'Meia-Entrada', p: 'R$ 25' },
                      { k: 'is_teacher', l: 'Professor', p: 'R$ 25' },
                      { k: 'is_student', l: 'Estudante', p: 'R$ 25' },
                      { k: 'is_server', l: 'Servidor', p: 'R$ 25' },
                      { k: 'is_donor', l: 'Doador Sangue', p: 'R$ 25' },
                      { k: 'is_solidarity', l: 'Adulto Solidário', p: 'R$ 25' }
                   ].map(cat => (
                      <div key={cat.k} className="bg-white border border-emerald-100 rounded-[1.25rem] p-3 flex flex-col items-center justify-center text-center hover:shadow-md transition-all shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
                         <span className="text-[9px] sm:text-[10px] font-black text-emerald-800 uppercase tracking-tight mb-1">{cat.l}</span>
                         <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 mb-2.5">{cat.p}</span>
                         <div className="flex items-center justify-center gap-2 bg-emerald-50/50 rounded-full border border-emerald-100 p-0.5">
                            <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: Math.max(0, (newBookingData as any)[cat.k] - 1)})} className="w-6 h-6 rounded-full bg-white border border-emerald-200 text-emerald-700 font-black flex items-center justify-center text-xs hover:bg-emerald-100 shadow-sm">-</button>
                            <span className="w-5 text-center font-black text-sm text-emerald-950">{(newBookingData as any)[cat.k]}</span>
                            <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: (newBookingData as any)[cat.k] + 1})} className="w-6 h-6 rounded-full bg-white border border-emerald-200 text-emerald-700 font-black flex items-center justify-center text-xs hover:bg-emerald-100 shadow-sm">+</button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="space-y-6">
                {/* QUIOSQUES SECTION - SINGLE ROW ABOVE QUADS */}
                <div className="bg-white p-5 rounded-[2rem] border border-emerald-100 shadow-sm space-y-4">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-emerald-50">
                      <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
                         <Tag className="w-4 h-4" /> 2. Quiosques
                      </h4>
                      <p className="text-[9px] font-bold text-emerald-600/60 uppercase">Selecione o quiosque desejado</p>
                   </div>
                   <div className="flex flex-wrap md:flex-nowrap gap-2">
                      {KIOSKS.map(k => {
                         const isBooked = bookedIds.includes(k.id);
                         const isSelected = newBookingData.selected_kiosks.includes(k.id);
                         return (
                            <button key={k.id} disabled={isBooked} onClick={() => {
                               if (isSelected) setNewBookingData({...newBookingData, selected_kiosks: newBookingData.selected_kiosks.filter(id => id !== k.id)});
                               else setNewBookingData({...newBookingData, selected_kiosks: [...newBookingData.selected_kiosks, k.id]});
                            }} className={cn("flex-1 h-12 rounded-xl font-black text-[10px] md:text-xs transition-all border-2 flex items-center justify-center min-w-[60px]", isBooked ? "bg-slate-100 border-slate-200 text-slate-300" : isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-md scale-[1.02]" : "bg-white border-emerald-100 text-emerald-800 hover:border-emerald-300")}>
                                Q-{k.id}
                            </button>
                         );
                      })}
                   </div>
                </div>

                {/* QUADS SECTION */}
                <div className="bg-white p-5 rounded-[2rem] border border-emerald-100 shadow-sm space-y-4">
                   <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 pb-3 border-b border-emerald-50">
                      <Bike className="w-4 h-4" /> 3. Quadriciclos (Máx. 3 por horário)
                   </h4>
                   <div className="space-y-3">
                      {QUAD_TIMES.map(t => {
                         const dbRemaining = slotAvailabilities[t] ?? 3;
                         const localUsed = newBookingData.quads.filter(q => q.time === t).reduce((sum, q) => sum + (q.quantity || 0), 0);
                         const remaining = Math.max(0, dbRemaining - localUsed);
                         const isFull = remaining <= 0;

                         return (
                           <div key={t} className="flex flex-col xl:flex-row xl:items-center justify-between p-3 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/30 gap-3">
                              <div className="flex items-center gap-3">
                                 <div className="px-3.5 py-2 rounded-xl border border-emerald-200 font-black text-emerald-950 bg-white shadow-sm">
                                    {t}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-emerald-700 tracking-widest leading-none mb-1">Vagas Disponíveis</span>
                                    <div className="flex items-center gap-1.5">
                                       <div className="flex gap-0.5">
                                          {Array.from({length: 3}).map((_, i) => (
                                             <div key={i} className={cn("w-2 h-2 rounded-full", isFull ? "bg-red-400" : i < remaining ? "bg-emerald-500" : "bg-emerald-200")} />
                                          ))}
                                       </div>
                                       <span className={cn("text-[10px] font-black tracking-tight", isFull ? "text-red-600" : "text-emerald-800")}>{isFull ? "LOTADO" : `${remaining} RESTANTES`}</span>
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="flex gap-2">
                                  {['individual', 'dupla', 'adulto-crianca'].map(type => {
                                     const qItem = newBookingData.quads.find(q => q.type === type && q.time === t);
                                     const qty = qItem ? qItem.quantity : 0;
                                     const labels: any = { individual: 'IND.', dupla: 'DUPLA', 'adulto-crianca': 'ADULTO' };
                                     
                                     return (
                                        <div key={type} className="flex flex-col items-center flex-1 min-w-[50px]">
                                           <button onClick={() => {
                                               if (qty > 0) {
                                                  const newQuads = newBookingData.quads.map(q => q.type === type && q.time === t ? {...q, quantity: q.quantity - 1} : q).filter(q => q.quantity > 0);
                                                  setNewBookingData({...newBookingData, quads: newQuads});
                                               }
                                           }} disabled={qty === 0} className={cn("w-full h-5 flex items-center justify-center rounded-t-full border border-b-0 font-bold text-xs transition-colors", qty > 0 ? "bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200 cursor-pointer" : "bg-slate-50 border-slate-200 text-slate-300 opacity-60")}>-</button>
                                           <div className={cn("w-full h-8 flex items-center justify-center border font-black text-[9px] sm:text-[10px] leading-none transition-colors", qty > 0 ? "border-emerald-500 bg-emerald-600 text-white shadow-inner" : "border-slate-200 bg-white text-emerald-800")}>
                                              {qty > 0 ? `${qty}x ${labels[type]}` : labels[type]}
                                           </div>
                                           <button onClick={() => {
                                               if (remaining > 0) {
                                                  const existing = newBookingData.quads.find(q => q.type === type && q.time === t);
                                                  let newQuads = [...newBookingData.quads];
                                                  if (existing) {
                                                     newQuads = newQuads.map(q => q.type === type && q.time === t ? {...q, quantity: q.quantity + 1} : q);
                                                  } else {
                                                     newQuads.push({ type, time: t, quantity: 1 });
                                                  }
                                                  setNewBookingData({...newBookingData, quads: newQuads});
                                               }
                                           }} disabled={remaining <= 0} className={cn("w-full h-5 flex items-center justify-center rounded-b-full border border-t-0 font-bold text-xs transition-colors", remaining > 0 ? "bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200 cursor-pointer" : "bg-slate-50 border-slate-200 text-slate-300 opacity-60")}>+</button>
                                        </div>
                                     );
                                  })}
                              </div>
                           </div>
                         );
                      })}
                   </div>
                </div>
             </div>


             <div className="bg-[#114030] p-6 lg:p-8 rounded-[2rem] shadow-xl text-white mt-8">
                <h4 className="text-xs font-black text-emerald-100 uppercase tracking-widest flex items-center gap-2 pb-5 opacity-90">
                   <Tag className="w-4 h-4" /> Ajustes e Status
                </h4>
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-end">
                   <div className="flex-1 space-y-6 w-full">
                      <div className="space-y-2 flex flex-col">
                         <label className="text-[10px] font-black text-emerald-200 uppercase tracking-widest border-l-2 border-emerald-400 pl-2">
                           Desconto Manual ({newBookingData.manual_discount_type === 'percent' ? '%' : 'R$'})
                         </label>
                         <div className="flex gap-2">
                           <Select value={newBookingData.manual_discount_type} onValueChange={(v:any) => setNewBookingData({...newBookingData, manual_discount_type: v, manual_discount: 0})}>
                              <SelectTrigger className="w-[90px] h-14 bg-[#0a291f] border-[#185e46] text-white font-black text-sm rounded-xl focus:ring-emerald-500">
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[#114030] text-emerald-100 border-[#185e46]">
                                 <SelectItem value="unit" className="font-bold focus:bg-emerald-800">R$</SelectItem>
                                 <SelectItem value="percent" className="font-bold focus:bg-emerald-800">%</SelectItem>
                              </SelectContent>
                           </Select>
                           <Input 
                              type="number" min="0" step="0.01"
                              className="flex-1 h-14 bg-[#0a291f] border-[#185e46] text-white font-black text-xl rounded-xl focus-visible:ring-emerald-500 px-4 placeholder:text-emerald-800/80" 
                              placeholder="0,00"
                              value={newBookingData.manual_discount || ''}
                              onChange={(e) => setNewBookingData({...newBookingData, manual_discount: Number(e.target.value) || 0})}
                           />
                         </div>
                      </div>

                      <div className="space-y-2 flex flex-col">
                         <label className="text-[10px] font-black text-emerald-200 uppercase tracking-widest border-l-2 border-emerald-400 pl-2">Status de Pagamento</label>
                         <Select value={newBookingData.status} onValueChange={(v:any) => setNewBookingData({...newBookingData, status: v})}>
                            <SelectTrigger className="w-full h-14 bg-[#0a291f] border-[#185e46] text-white font-black text-sm rounded-xl focus:ring-emerald-500">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#114030] text-emerald-100 border-[#185e46]">
                               <SelectItem value="pending" className="font-bold focus:bg-emerald-800">Aguardando Pagamento</SelectItem>
                               <SelectItem value="paid" className="font-bold focus:bg-emerald-800">Confirmado / Pago Agora</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                   </div>

                   <div className="flex-[1.2] flex flex-col items-end w-full">
                      <div className="flex flex-col items-end mb-6">
                         <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 opacity-80 border-r-2 border-emerald-400 pr-2 pb-1">Total da Reserva</span>
                         <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-3xl font-black text-emerald-400 leading-none opacity-80">R$</span>
                            <span className="text-7xl lg:text-[5.5rem] font-black tracking-tighter leading-none text-white drop-shadow-lg">
                               {calculateTotalRaw().toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <span className="text-[9.5px] font-bold text-emerald-400 mt-3 italic tracking-wide opacity-70">* Cálculo automático incluindo descontos do dia</span>
                       </div>
                       
                       <Button onClick={handleCreateInternalBooking} disabled={loading || !newBookingData.name} className="w-full h-16 bg-[#8eb29c] hover:bg-white text-[#0a291f] rounded-2xl font-black text-[13px] uppercase shadow-xl transition-all active:scale-95 group overflow-hidden">
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 
                             <span className="flex items-center gap-2">
                                Concluir e Salvar Reserva
                                <Check className="w-5 h-5 group-hover:scale-125 transition-transform" />
                             </span>
                          }
                       </Button>
                    </div>
                 </div>
              </div>
              </>
           )}
         </div>
       </DialogContent>
     </Dialog>
   );
}
