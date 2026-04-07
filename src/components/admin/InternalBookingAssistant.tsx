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
import { getBookedKioskIds, getQuadAvailability, getGlobalSetting } from '@/lib/booking-service';
import { getQuadDiscount } from '@/lib/booking-types';

const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, type: 'Menor' }
];

export function InternalBookingAssistant({ 
  onBookingComplete, 
  isAllowedDay, 
  isHoliday, 
  kioskReservations = [], 
  quadReservations = [] 
}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const [maxQuads, setMaxQuads] = useState(3);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const { toast } = useToast();
  const [generatedPix, setGeneratedPix] = useState<any>(null);

  const QUAD_TIMES = ['09:00', '10:30', '14:00', '15:30'];

  // Fetch max quads on mount
  useEffect(() => {
    async function fetchConfig() {
      const total = await getGlobalSetting('total_quads', 3);
      setMaxQuads(Number(total));
      // Initialize slot availabilities with the fetched max quads
      const initialAvail: Record<string, number> = {};
      QUAD_TIMES.forEach(t => {
        initialAvail[t] = Number(total);
      });
      setSlotAvailabilities(initialAvail);
    }
    fetchConfig();
  }, []);

  const initialData = {
    name: '', phone: '', cpf: '', visit_date: '',
    adults_normal: 0, adults_half: 0, is_teacher: 0, is_student: 0, 
    is_server: 0, is_donor: 0, is_solidarity: 0, is_pcd: 0, is_tea: 0, 
    is_senior: 0, is_birthday: 0, children_free: 0,
    selected_kiosks: [] as number[],
    quads: [] as any[],
    additionals: [] as any[],
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
        avail[t] = Math.max(0, maxQuads - used);
      }
      setSlotAvailabilities(avail);
      setIsFetchingAvail(false);
    };
    fetchOccupied();
  }, [newBookingData.visit_date, maxQuads]);

  const handleCreateInternalBooking = async () => {
    if (!newBookingData.name || !newBookingData.visit_date) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, preencha o nome e a data.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      console.log('Sending internal booking request:', newBookingData);
      
      const { data, error } = await supabase.functions.invoke('create-internal-order', {
        body: {
          ...newBookingData,
          total_amount: calculateTotalRaw()
        }
      });

      if (error) {
        console.error('Edge Function Error:', error);
        throw new Error(error.message || 'Erro na comunicação com o servidor.');
      }
      
      if (data?.success === false) {
        throw new Error(data.error || 'Falha ao criar reserva.');
      }

      if (newBookingData.status === 'pending' && data?.pix) {
          setGeneratedPix(data.pix);
          toast({ title: 'Sucesso!', description: 'Reserva criada e PIX gerado.' });
      } else {
          toast({ title: 'Sucesso!', description: 'Reserva criada com sucesso.' });
          setIsOpen(false);
          onBookingComplete();
      }
    } catch (err: any) {
      console.error('Internal Booking Catch:', err);
      
      const errorDetail = err?.context?.status 
        ? `Status: ${err.context.status}` 
        : err.message || 'Erro de rede ou CORS.';

      toast({ 
        title: 'ERRO CRÍTICO: FALHA DE CONEXÃO', 
        description: `Não foi possível alcançar o servidor. Detalhe: ${errorDetail}. Verifique se a Edge Function está publicada.`, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCredit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('internal_credits').insert({
          customer_name: newBookingData.name,
          customer_phone: newBookingData.phone,
          customer_cpf: newBookingData.cpf,
          amount: calculateTotalRaw(),
          notes: `Crédito gerado no Assistente (Orçamento avulso)`
      });

      if (error) throw error;
      
      toast({ title: 'Sucesso!', description: 'Crédito interno gerado com sucesso.' });
      setIsOpen(false);
      onBookingComplete();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao gerar crédito.', variant: 'destructive' });
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

    newBookingData.additionals.forEach(a => {
      const price = a.type === 'pesca' ? 20 : 10;
      total += price * a.quantity;
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
      
      <DialogContent className="sm:max-w-4xl bg-slate-50/95 backdrop-blur-xl rounded-[2.5rem] border-0 overflow-hidden p-0 max-h-[96vh] flex flex-col shadow-[0_32px_100px_-20px_rgba(0,0,0,0.3)]">
        <div className="bg-gradient-to-tr from-emerald-700 via-emerald-600 to-emerald-500 p-8 text-center shrink-0 border-b border-white/10 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400/20 blur-3xl rounded-full -ml-16 -mb-16" />
          
          <DialogTitle className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-4 drop-shadow-sm">
             <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30 shadow-inner">
                <CalendarPlus className="w-8 h-8" />
             </div>
             Assistente de Reserva Interna
          </DialogTitle>
          <div className="flex items-center justify-center gap-2 mt-4">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-50 bg-emerald-950/40 px-5 py-2 rounded-full border border-white/10 backdrop-blur-md">Gestão Privilegiada</span>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-950 bg-emerald-300 px-5 py-2 rounded-full border border-emerald-400/50 shadow-sm">Modo Balcão</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {generatedPix ? (
             <div className="flex flex-col items-center py-10 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-2xl border-8 border-emerald-500/20">
                   <img src={`data:image/png;base64,${generatedPix.encodedImage}`} alt="QR" className="w-56 h-56" />
                </div>
                <Button onClick={() => { setIsOpen(false); setGeneratedPix(null); onBookingComplete(); }} className="w-full max-w-sm h-16 bg-emerald-950 text-white hover:bg-emerald-900 rounded-2xl font-black transition-all">CONCLUÍDO - FECHAR</Button>
             </div>
          ) : (
             <>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-4 space-y-2">
                   <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 ml-1">
                      <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center"><User className="w-2.5 h-2.5 text-emerald-700" /></div>
                      Nome Completo
                   </label>
                   <Input 
                      value={newBookingData.name} 
                      onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                      className="h-14 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-0 font-bold bg-white text-base shadow-sm transition-all" 
                      placeholder="Ex: João da Silva"
                   />
                </div>
                <div className="md:col-span-3 space-y-2">
                   <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 ml-1">
                      <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center"><Phone className="w-2.5 h-2.5 text-emerald-700" /></div>
                      WhatsApp
                   </label>
                   <Input 
                      value={newBookingData.phone} 
                      onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                      className="h-14 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-0 font-bold bg-white text-base shadow-sm transition-all text-emerald-900" 
                      placeholder="(DD) 99999-9999"
                   />
                </div>
                <div className="md:col-span-2 space-y-2">
                   <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 ml-1">
                      <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center"><Hash className="w-2.5 h-2.5 text-emerald-700" /></div>
                      CPF (Opcional)
                   </label>
                   <Input 
                      value={newBookingData.cpf} 
                      onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value})}
                      className="h-14 rounded-2xl border-2 border-emerald-100 focus:border-emerald-500 focus:ring-0 font-bold bg-white text-base shadow-sm transition-all text-emerald-900" 
                      placeholder="000.000.000-00"
                   />
                </div>
                <div className="md:col-span-3 space-y-2">
                   <label className="text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 ml-1">
                      <div className="w-4 h-4 rounded-md bg-emerald-100 flex items-center justify-center"><CalendarIcon className="w-2.5 h-2.5 text-emerald-700" /></div>
                      Data
                   </label>
                   <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                         <Button variant="outline" className={cn(
                            "h-14 w-full rounded-2xl border-2 border-emerald-100 font-black text-base shadow-sm transition-all",
                            !newBookingData.visit_date ? "text-emerald-300 border-emerald-50" : "text-emerald-900 border-emerald-200 bg-white hover:bg-emerald-50"
                         )} disabled={isFetchingAvail}>
                            {newBookingData.visit_date ? format(parseISO(newBookingData.visit_date), 'dd/MM/yyyy') : "DD/MM/AA"}
                            <ArrowRight className="ml-auto h-4 w-4 opacity-30" />
                         </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[2rem] border-emerald-100 shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden" align="end">
                         <div className="bg-emerald-600 p-4 text-white">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Calendário de Reservas</span>
                            <h4 className="text-sm font-black mt-1">Selecione o dia da visita</h4>
                         </div>
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

              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2.5rem] border-2 border-emerald-50 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-emerald-100/50 pb-4">
                   <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-3">
                      <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><Users className="w-4 h-4" /></div>
                      1. Participantes e Categorias
                   </h4>
                   <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">Múltiplas Categorias</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                   {[
                      { k: 'adults_normal', l: 'Adulto', p: '50', icon: User, color: 'bg-blue-500' },
                      { k: 'adults_half', l: 'Meia', p: '25', icon: GraduationCap, color: 'bg-amber-500' },
                      { k: 'is_teacher', l: 'Prof', p: '25', icon: GraduationCap, color: 'bg-emerald-500' },
                      { k: 'is_student', l: 'Estud.', p: '25', icon: GraduationCap, color: 'bg-indigo-500' },
                      { k: 'is_server', l: 'Serv.', p: '25', icon: Accessibility, color: 'bg-rose-500' },
                      { k: 'is_donor', l: 'Doad.', p: '25', icon: Gift, color: 'bg-red-500' },
                      { k: 'is_solidarity', l: 'Solid.', p: '25', icon: Gift, color: 'bg-orange-500' }
                   ].map(cat => {
                      const Icon = cat.icon;
                      const val = (newBookingData as any)[cat.k];
                      return (
                        <div key={cat.k} className={cn(
                          "group relative bg-white border-2 rounded-[1.75rem] p-4 flex flex-col items-center justify-between transition-all duration-300",
                          val > 0 ? "border-emerald-500 shadow-md scale-[1.02]" : "border-slate-100 hover:border-emerald-200"
                        )}>
                           <div className={cn(
                             "w-8 h-8 rounded-full flex items-center justify-center text-white mb-2 shadow-sm transition-transform group-hover:scale-110",
                             cat.color
                           )}>
                              <Icon className="w-4 h-4" />
                           </div>
                           <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight text-center">{cat.l}</span>
                           <span className="text-[10px] font-bold text-emerald-600 mb-3">R$ {cat.p}</span>
                           
                           <div className="flex items-center w-full justify-between bg-slate-50 rounded-2xl p-1 gap-1 border border-slate-100 group-hover:bg-white transition-colors">
                              <button 
                                onClick={() => setNewBookingData({...newBookingData, [cat.k]: Math.max(0, val - 1)})} 
                                className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-xs font-black shadow-sm">-</button>
                              <span className="text-sm font-black text-slate-900 tabular-nums">{val}</span>
                              <button 
                                onClick={() => setNewBookingData({...newBookingData, [cat.k]: val + 1})} 
                                className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-xs font-black shadow-sm">+</button>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>

             <div className="flex flex-col gap-6">
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2.5rem] border-2 border-emerald-50 shadow-sm space-y-5">
                   <div className="flex items-center justify-between border-b border-emerald-100/50 pb-4">
                      <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-3">
                         <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><Tag className="w-4 h-4" /></div>
                         2. Quiosques
                      </h4>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unidades 1-5</span>
                   </div>
                   <div className="grid grid-cols-5 gap-3">
                      {KIOSKS.map(k => {
                         const isBooked = bookedIds.includes(k.id);
                         const isSelected = newBookingData.selected_kiosks.includes(k.id);
                         return (
                            <button 
                              key={k.id} 
                              disabled={isBooked} 
                              onClick={() => {
                                if (isSelected) setNewBookingData({...newBookingData, selected_kiosks: newBookingData.selected_kiosks.filter(id => id !== k.id)});
                                else setNewBookingData({...newBookingData, selected_kiosks: [...newBookingData.selected_kiosks, k.id]});
                              }} 
                              className={cn(
                                "group relative h-20 rounded-2xl font-black transition-all duration-300 border-2 flex flex-col items-center justify-center gap-1",
                                isBooked ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50" : 
                                isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-lg scale-[1.05] -translate-y-1" : 
                                "bg-emerald-50/50 border-emerald-200 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100"
                              )}
                            >
                                <span className="text-[9px] font-black uppercase opacity-70 tracking-widest leading-none mb-0.5">Quiosque</span>
                                <span className="text-2xl leading-none font-black">{k.id}</span>
                                {isSelected && <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-md border-2 border-emerald-600"><Check className="w-2.5 h-2.5" /></div>}
                            </button>
                         );
                      })}
                   </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2.5rem] border-2 border-emerald-50 shadow-sm space-y-5">
                   <div className="flex items-center justify-between border-b border-emerald-100/50 pb-4">
                      <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-3">
                         <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><Bike className="w-4 h-4" /></div>
                         3. Quadriciclos
                      </h4>
                      <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full">
                         <div className="w-2 h-2 rounded-full bg-emerald-500" />
                         <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Limite: {maxQuads}</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {QUAD_TIMES.map(t => {
                         const dbRemaining = slotAvailabilities[t] ?? maxQuads;
                         const localUsed = newBookingData.quads.filter(q => q.time === t).reduce((sum, q) => sum + (q.quantity || 0), 0);
                         const remaining = Math.max(0, dbRemaining - localUsed);
                         const isFull = remaining <= 0;

                         return (
                           <div key={t} className={cn(
                             "flex flex-col p-2.5 rounded-xl border-2 transition-all",
                             localUsed > 0 ? "bg-emerald-50/30 border-emerald-200" : "bg-white border-slate-100"
                           )}>
                              <div className="flex items-center justify-between mb-2">
                                 <div className="flex items-center gap-2">
                                    <div className="px-2 h-6 rounded-lg bg-emerald-950 text-white flex items-center justify-center text-[10px] font-black shadow-sm tracking-tighter">{t}</div>
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-black uppercase text-slate-800 leading-none mb-1">Vagas</span>
                                       <div className="flex gap-1">
                                          {Array.from({length: maxQuads}).map((_, i) => (
                                             <div key={i} className={cn("w-2 h-2 rounded-full border border-black/10", isFull ? "bg-rose-500 shadow-sm" : i < remaining ? "bg-emerald-500 shadow-sm" : "bg-slate-200 shadow-inner")} />
                                          ))}
                                       </div>
                                    </div>
                                 </div>
                                 {isFull && <span className="text-[7.5px] font-black text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100 tracking-wider">Lotado</span>}
                              </div>
                              
                              <div className="grid grid-cols-3 gap-1">
                                  {['individual', 'dupla', 'adulto-crianca'].map(type => {
                                     const qItem = newBookingData.quads.find(q => q.type === type && q.time === t);
                                     const qty = qItem ? qItem.quantity : 0;
                                     const labels: any = { individual: 'IND.', dupla: 'DUPLA', 'adulto-crianca': 'ADUL.' };
                                     
                                     return (
                                        <div key={type} className="flex flex-col gap-1">
                                           <div className={cn(
                                             "h-7 rounded-lg border flex items-center justify-center font-black text-[8.5px] transition-all",
                                             qty > 0 ? "bg-emerald-600 border-emerald-700 text-white shadow-inner" : "bg-white border-slate-300 text-slate-600"
                                           )}>
                                              {qty > 0 ? `${qty}x` : labels[type]}
                                           </div>
                                           <div className="flex gap-1">
                                              <button 
                                                onClick={() => {
                                                   if (qty > 0) {
                                                      const newQuads = newBookingData.quads.map(q => q.type === type && q.time === t ? {...q, quantity: q.quantity - 1} : q).filter(q => q.quantity > 0);
                                                      setNewBookingData({...newBookingData, quads: newQuads});
                                                   }
                                                }} 
                                                disabled={qty === 0} 
                                                className="flex-1 h-6 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-[10px] font-black shadow-sm disabled:opacity-30">-</button>
                                              <button  
                                                onClick={() => {
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
                                                }} 
                                                disabled={remaining <= 0} 
                                                className="flex-1 h-6 rounded-md bg-white border border-slate-300 text-slate-800 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-[10px] font-black shadow-sm disabled:opacity-30">+</button>
                                           </div>
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

             <div className="bg-[#114030] p-6 lg:p-8 rounded-[2rem] shadow-xl text-white">
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
                       
                       <div className="flex flex-col gap-2 w-full">
                         <Button onClick={handleCreateInternalBooking} disabled={loading || !newBookingData.name} className="w-full h-16 bg-emerald-300 hover:bg-white text-emerald-950 rounded-2xl font-black text-base uppercase shadow-xl transition-all active:scale-95 group overflow-hidden border-2 border-emerald-400">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 
                               <div className="flex items-center justify-center gap-3">
                                  <span>Concluir Reserva</span>
                                  <div className="w-8 h-8 bg-emerald-950 text-emerald-300 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                     <Check className="w-5 h-5" />
                                  </div>
                               </div>
                            }
                         </Button>
                         <Button onClick={handleCreateCredit} disabled={loading || !newBookingData.name} variant="outline" className="w-full h-14 bg-white hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-200 rounded-2xl font-black text-xs uppercase shadow-sm transition-all active:scale-95 group">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 
                               <div className="flex items-center justify-center gap-2">
                                  <Gift className="w-4 h-4 text-emerald-600" />
                                  <span>Adicionar aos Créditos</span>
                               </div>
                            }
                         </Button>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-white/70 backdrop-blur-sm p-6 rounded-[2.5rem] border-2 border-emerald-50 shadow-sm space-y-5">
                 <div className="flex items-center justify-between border-b border-emerald-100/50 pb-4">
                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-3">
                       <div className="p-2 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-200"><Tag className="w-4 h-4" /></div>
                       4. Outros Serviços
                    </h4>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'pesca', label: 'Pesca Esportiva', price: 20, description: 'Acesso ao lago de pesca' },
                      { id: 'futebol-sabao', label: 'Futebol de Sabão', price: 10, description: '30 min de diversão' }
                    ].map(service => {
                       const item = newBookingData.additionals.find(a => a.type === service.id);
                       const qty = item ? item.quantity : 0;
                       return (
                          <div key={service.id} className={cn(
                            "group relative md:col-span-1 bg-white border-2 rounded-2xl p-4 flex items-center justify-between transition-all",
                            qty > 0 ? "border-emerald-500 shadow-md" : "border-slate-100"
                          )}>
                             <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-900 uppercase">{service.label}</span>
                                <span className="text-[10px] font-bold text-emerald-600">R$ {service.price},00</span>
                                <span className="text-[9px] text-slate-400 mt-0.5">{service.description}</span>
                             </div>
                             <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                                <button 
                                  onClick={() => {
                                    const newAdd = newBookingData.additionals.map(a => a.type === service.id ? {...a, quantity: Math.max(0, a.quantity - 1)} : a).filter(a => a.quantity > 0);
                                    setNewBookingData({...newBookingData, additionals: newAdd});
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-black hover:bg-rose-500 hover:text-white">-</button>
                                <span className="w-6 text-center text-sm font-black tabular-nums">{qty}</span>
                                <button 
                                  onClick={() => {
                                    const existing = newBookingData.additionals.find(a => a.type === service.id);
                                    let newAdd = [...newBookingData.additionals];
                                    if (existing) {
                                       newAdd = newAdd.map(a => a.type === service.id ? {...a, quantity: a.quantity + 1} : a);
                                    } else {
                                       newAdd.push({ type: service.id, quantity: 1 });
                                    }
                                    setNewBookingData({...newBookingData, additionals: newAdd});
                                  }}
                                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-black hover:bg-emerald-500 hover:text-white">+</button>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
             </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
