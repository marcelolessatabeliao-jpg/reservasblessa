import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar as CalendarIcon, 
  CalendarPlus, 
  User, 
  Phone, 
  Tag,
  Hash,
  ArrowRight,
  Loader2,
  Check
} from 'lucide-react';
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
import { saveBooking, getBookedKioskIds } from '@/lib/booking-service';
import { getQuadDiscount } from '@/lib/booking-types';

const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, type: 'Menor' }
];

export function InternalBookingAssistant({ onCreated, isHoliday, isAllowedDay }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const { toast } = useToast();
  const [generatedPix, setGeneratedPix] = useState<any>(null);

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

  // Auto-fetch occupied kiosks when date changes
  useEffect(() => {
    const fetchOccupied = async () => {
      if (!newBookingData.visit_date) return;
      setIsFetchingAvail(true);
      const ids = await getBookedKioskIds(newBookingData.visit_date);
      setBookedIds(ids);
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
    const { adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, selected_kiosks, quads, manual_discount, visit_date } = newBookingData;
    let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
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
        if (!open) setGeneratedPix(null);
    }}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 md:h-14 px-6 md:px-8 shadow-xl hover:scale-105 active:scale-95 transition-all border-0 text-xs md:text-sm uppercase tracking-wider flex items-center gap-3">
          <CalendarPlus className="w-5 h-5 flex-shrink-0" /> <span className="hidden sm:inline">Nova Reserva</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-3xl bg-slate-50 rounded-[2rem] border-4 border-emerald-200 overflow-hidden p-0 max-h-[95vh] flex flex-col shadow-3xl">
        <div className="bg-emerald-600 p-8 text-center shrink-0 border-b-4 border-emerald-700 shadow-lg relative overflow-hidden">
          <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3">
             <CalendarPlus className="w-8 h-8" /> Assistente de Reserva Interna
          </DialogTitle>
          <p className="text-emerald-100 text-[11px] font-black uppercase mt-1.5 tracking-widest bg-emerald-700/50 inline-block px-4 py-1.5 rounded-full border border-emerald-500/30">Lógica Integrada - Sem CPF</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {generatedPix ? (
             <div className="flex flex-col items-center py-10 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-2xl border-8 border-emerald-500/20">
                   <img src={`data:image/png;base64,${generatedPix.encodedImage}`} alt="QR" className="w-56 h-56" />
                </div>
                <Button onClick={() => { setIsOpen(false); setGeneratedPix(null); onCreated(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">CONCLUÍDO - FECHAR</Button>
             </div>
          ) : (
             <>
             {/* SECTION 1: CLIENTE E DATA */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Nome do Cliente
                   </label>
                   <Input 
                      value={newBookingData.name} 
                      onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                      className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white" placeholder="Nome Completo"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Telefone
                   </label>
                   <Input 
                      value={newBookingData.phone} 
                      onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                      className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white" placeholder="DDD + Número"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" /> Data da Visita
                   </label>
                   <Popover>
                      <PopoverTrigger asChild>
                         <Button variant="outline" className={cn("h-14 w-full rounded-2xl border-2 border-emerald-100 font-black", !newBookingData.visit_date && "text-emerald-400")} disabled={isFetchingAvail}>
                            {newBookingData.visit_date ? format(parseISO(newBookingData.visit_date), 'dd/MM/yyyy') : "DD/MM/AAAA"}
                         </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 border-0" align="start">
                         <Calendar
                            mode="single"
                            selected={newBookingData.visit_date ? parseISO(newBookingData.visit_date) : undefined}
                            onSelect={(date) => setNewBookingData({...newBookingData, visit_date: date ? format(date, 'yyyy-MM-dd') : ''})}
                            locale={ptBR}
                            disabled={(date) => !isAllowedDay(date)}
                            fromDate={new Date()}
                         />
                      </PopoverContent>
                   </Popover>
                </div>
             </div>

             {/* SECTION 2: PARTICIPANTES */}
             <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm space-y-4">
                <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 border-b-2 border-emerald-50 pb-4">
                   <Users className="w-4 h-4" /> 1. Participantes
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                   {[
                      { k: 'adults_normal', l: 'Adulto Integral', p: 'R$ 50' },
                      { k: 'adults_half', l: 'Meia-Entrada', p: 'R$ 25' },
                      { k: 'is_pcd', l: 'PCD', p: 'Grátis' },
                      { k: 'children_free', l: 'Kids', p: 'Grátis' }
                   ].map(cat => (
                      <div key={cat.k} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center space-y-2">
                         <p className="text-[9px] font-black text-emerald-800/60 uppercase">{cat.l}</p>
                         <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: Math.max(0, (newBookingData as any)[cat.k] - 1)})} className="w-8 h-8 rounded-lg bg-white border border-emerald-200 font-black">-</button>
                            <span className="w-8 font-black text-lg">{(newBookingData as any)[cat.k]}</span>
                            <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: (newBookingData as any)[cat.k] + 1})} className="w-8 h-8 rounded-lg bg-white border border-emerald-200 font-black">+</button>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             {/* SECTION 3: QUIOSQUES & QUADS */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border-2 border-emerald-100 shadow-sm space-y-4">
                   <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 pb-2 border-b">
                      <Tag className="w-4 h-4" /> 2. Quiosques
                   </h4>
                   <div className="grid grid-cols-5 gap-2">
                      {KIOSKS.map(k => {
                         const isBooked = bookedIds.includes(k.id);
                         const isSelected = newBookingData.selected_kiosks.includes(k.id);
                         return (
                            <button key={k.id} disabled={isBooked} onClick={() => {
                               if (isSelected) setNewBookingData({...newBookingData, selected_kiosks: newBookingData.selected_kiosks.filter(id => id !== k.id)});
                               else setNewBookingData({...newBookingData, selected_kiosks: [...newBookingData.selected_kiosks, k.id]});
                            }} className={cn("h-10 rounded-xl font-black text-[10px] transition-all border-2", isBooked ? "bg-slate-100 border-slate-200 text-slate-300" : isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-md scale-105" : "bg-white border-emerald-50 text-emerald-800")}>
                               Q-{k.id}
                            </button>
                         );
                      })}
                   </div>
                </div>

                <div className="flex flex-col justify-end items-end space-y-2">
                   <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-emerald-200/60 leading-none">R$</span>
                      <span className="text-6xl font-black tracking-tighter leading-none text-emerald-950">
                         {calculateTotalRaw().toFixed(2).replace('.', ',')}
                      </span>
                   </div>
                   <Button onClick={handleCreateInternalBooking} disabled={loading || !newBookingData.name} className="w-full h-16 bg-emerald-600 text-white rounded-3xl font-black text-lg uppercase shadow-2xl">
                      {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : 'CONCLUIR RESERVA'}
                   </Button>
                </div>
             </div>
             </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
