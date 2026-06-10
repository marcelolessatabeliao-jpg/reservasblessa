import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar as CalendarIcon, User, Phone, Tag,
  Bike, Accessibility, Gift, GraduationCap, Loader2, Check, Minus, Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBookedKioskIds, getQuadAvailability, getGlobalSetting } from '@/lib/booking-service';
import { getQuadDiscount, QUAD_PRICES } from '@/lib/booking-types';
import { parseToRODate } from '@/utils/date-utils';

const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, type: 'Menor' },
  { id: 6, name: 'QUIOSQUE - 06', price: 100, type: 'Maior' },
  { id: 7, name: 'QUIOSQUE - 07', price: 100, type: 'Maior' },
  { id: 8, name: 'QUIOSQUE - 08', price: 100, type: 'Maior' }
];

export function AddItemsToBookingDialog({ 
  booking,
  isOpen,
  setIsOpen,
  onAdded
}: {
  booking: any;
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  onAdded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const [maxQuads, setMaxQuads] = useState(3);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  
  const { toast } = useToast();

  const QUAD_TIMES = ['09:00', '10:30', '14:00', '15:30'];

  const initialData = {
    adults_normal: 0, 
    is_teacher: 0, is_student: 0, is_server: 0, is_solidarity: 0, 
    is_pcd: 0, is_tea: 0, is_senior: 0, is_birthday: 0, 
    children_free: 0,
    selected_kiosks: [] as number[],
    quads: [] as any[],
    additionals: [] as any[],
    no_quad_discount: false
  };

  const [newData, setNewData] = useState(initialData);

  useEffect(() => {
    if (isOpen) {
      setNewData(initialData);
      setBookedIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    async function fetchConfig() {
      const total = await getGlobalSetting('total_quads', 3);
      setMaxQuads(Number(total));
    }
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchOccupied = async () => {
      if (!booking.visit_date || !isOpen) return;
      setIsFetchingAvail(true);
      const visitDateStr = typeof booking.visit_date === 'string' && booking.visit_date.includes('T') 
        ? booking.visit_date.split('T')[0] 
        : booking.visit_date;

      const ids = await getBookedKioskIds(visitDateStr);
      setBookedIds(ids);

      const avail: any = {};
      for (const t of QUAD_TIMES) {
        const used = await getQuadAvailability(visitDateStr, t);
        avail[t] = Math.max(0, maxQuads - used);
      }
      setSlotAvailabilities(avail);
      setIsFetchingAvail(false);
    };
    fetchOccupied();
  }, [booking.visit_date, maxQuads, isOpen]);

  const calculateTotalRaw = () => {
    const { 
      adults_normal, is_teacher, is_student, is_server, is_solidarity, 
      selected_kiosks, quads
    } = newData;
    
    let total = (adults_normal * 50) + 
      ((is_teacher + is_student + is_server + is_solidarity) * 25);
      
    selected_kiosks.forEach(id => {
      const kiosk = KIOSKS.find(k => k.id === id);
      total += (kiosk?.price || 75);
    });
    
    const visitDateStr = typeof booking.visit_date === 'string' && booking.visit_date.includes('T') 
        ? booking.visit_date.split('T')[0] 
        : booking.visit_date;
        
    const qDate = parseToRODate(visitDateStr);
    const day = qDate.getDay();
    const qD = getQuadDiscount(qDate);
    
    let finalQuadDiscount = (day === 1 || day === 5) ? 0.2 : qD;
    
    if (newData.no_quad_discount) {
      finalQuadDiscount = 0;
    }

    quads.forEach(q => {
      const basePrice = QUAD_PRICES[q.type as keyof typeof QUAD_PRICES] || 150;
      total += (basePrice * (1 - finalQuadDiscount)) * q.quantity;
    });

    newData.additionals.forEach(a => {
      const price = a.type === 'pesca' ? 20 : 10;
      total += price * a.quantity;
    });
    
    return Math.max(0, total);
  };

  const handleAddItems = async (updateTotalAmount: boolean) => {
    setLoading(true);
    try {
      const orderId = booking.id;
      const visitDateStr = typeof booking.visit_date === 'string' && booking.visit_date.includes('T') 
        ? booking.visit_date.split('T')[0] 
        : booking.visit_date;

      const orderItems: any[] = [];
      const kioskReservations: any[] = [];
      const quadReservations: any[] = [];

      const addProduct = (name: string, price: number, qty: number) => {
        if (qty > 0) {
          orderItems.push({
            order_id: orderId,
            product_id: name,
            quantity: qty,
            unit_price: price
          });
        }
      };

      addProduct('Adulto', 50, newData.adults_normal);
      addProduct('Adulto', 25, newData.is_solidarity);
      addProduct('Meia-Entrada (Professor)', 25, newData.is_teacher);
      addProduct('Meia-Entrada (Estudante)', 25, newData.is_student);
      addProduct('Meia-Entrada (Servidor Público)', 25, newData.is_server);
      addProduct('Lessa Kids', 0, newData.children_free);

      newData.selected_kiosks.forEach(kId => {
        const kiosk = KIOSKS.find(k => k.id === kId);
        if (kiosk) {
          orderItems.push({
            order_id: orderId,
            product_id: `Quiosque ${kiosk.type === 'Maior' ? 'Maior' : 'Menor'}`,
            quantity: 1,
            unit_price: kiosk.price
          });
          kioskReservations.push({
            order_id: orderId,
            kiosk_id: kiosk.id,
            kiosk_type: kiosk.type.toLowerCase(),
            reservation_date: visitDateStr,
            quantity: 1
          });
        }
      });

      newData.quads.forEach(q => {
        const baseMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
        const labelMap: Record<string, string> = { individual: 'Individual', dupla: 'Dupla', 'adulto-crianca': 'Adulto + Criança' };
        
        const qDate = parseToRODate(visitDateStr);
        const day = qDate.getDay();
        const qD = getQuadDiscount(qDate);
        let finalQuadDiscount = (day === 1 || day === 5) ? 0.2 : qD;
        if (newData.no_quad_discount) finalQuadDiscount = 0;
        
        const finalPrice = (baseMap[q.type] || 0) * (1 - finalQuadDiscount);

        orderItems.push({
          order_id: orderId,
          product_id: `Quadriciclo ${labelMap[q.type]}`,
          quantity: q.quantity,
          unit_price: finalPrice,
          metadata: { time: q.time }
        });
        
        quadReservations.push({
          order_id: orderId,
          quad_type: q.type,
          reservation_date: visitDateStr,
          time_slot: q.time,
          quantity: q.quantity
        });
      });

      newData.additionals.forEach(a => {
        const labelMap: Record<string, string> = { 'pesca': 'Pesca Esportiva', 'futebol-sabao': 'Futebol de Sabão' };
        const priceMap: Record<string, number> = { 'pesca': 20, 'futebol-sabao': 10 };
        orderItems.push({
          order_id: orderId,
          product_id: labelMap[a.type] || a.type,
          quantity: a.quantity,
          unit_price: priceMap[a.type] || 0
        });
      });

      // Concurrency check before inserting
      const currentBookedKiosks = await getBookedKioskIds(visitDateStr);
      for (const kId of newData.selected_kiosks) {
        if (currentBookedKiosks.includes(kId)) {
          throw new Error(`O Quiosque ${kId} já não está mais disponível.`);
        }
      }

      for (const q of newData.quads) {
        if (q.quantity > 0) {
          const used = await getQuadAvailability(visitDateStr, q.time);
          if ((used + q.quantity) > maxQuads) {
            throw new Error(`Não há vagas suficientes para Quadriciclos no horário ${q.time}. Disponível: ${Math.max(0, maxQuads - used)}`);
          }
        }
      }

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;
      }
      if (kioskReservations.length > 0) {
        const { error: kioskError } = await supabase.from('kiosk_reservations').insert(kioskReservations);
        if (kioskError) throw kioskError;
      }
      if (quadReservations.length > 0) {
        const { error: quadError } = await supabase.from('quad_reservations').insert(quadReservations);
        if (quadError) throw quadError;
      }

      if (updateTotalAmount) {
        const addedTotal = calculateTotalRaw();
        const newTotal = (booking.total_amount || 0) + addedTotal;
        const table = booking.is_order || booking.id.length < 36 ? 'orders' : 'bookings';
        
        const { error: updateError } = await supabase.from(table).update({ total_amount: newTotal }).eq('id', booking.id);
        if (updateError) throw updateError;
      }

      toast({ title: 'Sucesso!', description: 'Itens adicionados à reserva.' });
      setIsOpen(false);
      onAdded();

    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao adicionar itens', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalAdded = calculateTotalRaw();
  const hasItems = totalAdded > 0 || newData.children_free > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-4xl bg-slate-50/95 backdrop-blur-xl rounded-[2.5rem] border-0 overflow-hidden p-0 max-h-[96vh] flex flex-col shadow-2xl">
        <div className="bg-gradient-to-tr from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-center shrink-0 border-b border-white/10 relative overflow-hidden">
          <DialogTitle className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-3 drop-shadow-sm">
             <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-md border border-white/30 shadow-inner">
                <Plus className="w-6 h-6" />
             </div>
             Adicionar Itens à Reserva
          </DialogTitle>
          <div className="mt-2 text-emerald-100 text-sm font-bold">
            Reserva #{booking.confirmation_code || booking.id.slice(0,8)} - {booking.name || booking.customer_name}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          
          {/* Participantes */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-[2rem] border-2 border-emerald-50 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-100/50 pb-3">
               <div className="p-1.5 bg-emerald-600 rounded-lg text-white shadow-md"><Users className="w-3.5 h-3.5" /></div>
               Pessoas
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 max-w-4xl mx-auto w-full">
               {[
                  { k: 'adults_normal', l: 'Adulto', p: '50', icon: User, color: 'bg-blue-500' },
                  { k: 'is_solidarity', l: 'Solid.', p: '25', icon: Gift, color: 'bg-orange-500' },
                  { k: 'is_teacher', l: 'Prof', p: '25', icon: GraduationCap, color: 'bg-emerald-500' },
                  { k: 'is_student', l: 'Estud.', p: '25', icon: GraduationCap, color: 'bg-indigo-500' },
                  { k: 'is_server', l: 'Serv.', p: '25', icon: Accessibility, color: 'bg-rose-500' },
                  { k: 'children_free', l: 'Grátis', p: '0', icon: User, color: 'bg-slate-500' }
               ].map(cat => {
                  const Icon = cat.icon;
                  const val = (newData as any)[cat.k];
                  return (
                    <div key={cat.k} className={cn(
                      "group relative bg-white border-2 rounded-2xl p-3 flex flex-col items-center justify-between transition-all w-full h-full",
                      val > 0 ? "border-emerald-500 shadow-sm scale-[1.02]" : "border-slate-100 hover:border-emerald-200"
                    )}>
                       <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white mb-2 shadow-sm", cat.color)}>
                          <Icon className="w-4 h-4" />
                       </div>
                       <div className="text-center flex-1 flex flex-col justify-center">
                          <span className="text-[10px] font-black text-emerald-950 uppercase tracking-tight">{cat.l}</span>
                          <span className="text-[9px] font-bold text-emerald-600 mt-0.5">R$ {cat.p}</span>
                       </div>
                       
                       <div className="flex items-center w-full justify-between bg-emerald-50/50 rounded-xl p-1 gap-1 mt-2 border border-emerald-100/50">
                          <button onClick={() => setNewData({...newData, [cat.k]: Math.max(0, val - 1)})} className="w-6 h-6 rounded-lg bg-white border border-emerald-100 text-emerald-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-xs font-black shadow-sm">-</button>
                          <span className="text-xs font-black text-emerald-950 tabular-nums px-1">{val}</span>
                          <button onClick={() => setNewData({...newData, [cat.k]: val + 1})} className="w-6 h-6 rounded-lg bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-xs font-black shadow-sm">+</button>
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>

          {/* Quiosques */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-[2rem] border-2 border-emerald-50 shadow-sm space-y-4">
             <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-100/50 pb-3">
                <div className="p-1.5 bg-emerald-600 rounded-lg text-white shadow-md"><Tag className="w-3.5 h-3.5" /></div>
                Quiosques
             </h4>
             <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {KIOSKS.map(k => {
                   const isBooked = bookedIds.includes(k.id);
                   const isSelected = newData.selected_kiosks.includes(k.id);
                   return (
                      <button 
                        key={k.id} 
                        disabled={isBooked} 
                        onClick={() => {
                          if (isSelected) setNewData({...newData, selected_kiosks: newData.selected_kiosks.filter(id => id !== k.id)});
                          else setNewData({...newData, selected_kiosks: [...newData.selected_kiosks, k.id]});
                        }} 
                        className={cn(
                          "group relative h-16 rounded-xl font-black transition-all border-2 flex flex-col items-center justify-center gap-0.5",
                          isBooked ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50" : 
                          isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-md scale-[1.02]" : 
                          "bg-emerald-50/50 border-emerald-200 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-100"
                        )}
                      >
                         <span className="text-[8px] font-black uppercase opacity-70 tracking-widest leading-none">Quiosque</span>
                          <span className="text-lg leading-none font-black">{k.id}</span>
                          {isSelected && <div className="absolute -top-1 -right-1 w-3 h-3 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-md border border-emerald-600"><Check className="w-1.5 h-1.5" /></div>}
                      </button>
                   );
                })}
             </div>
          </div>

          {/* Quadriciclos */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-[2rem] border-2 border-emerald-50 shadow-sm space-y-4">
             <div className="flex items-center justify-between border-b border-emerald-100/50 pb-3">
                <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">
                   <div className="p-1.5 bg-emerald-600 rounded-lg text-white shadow-md"><Bike className="w-3.5 h-3.5" /></div>
                   Quadriciclos
                </h4>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {QUAD_TIMES.map(t => {
                   const dbRemaining = slotAvailabilities[t] ?? maxQuads;
                   const localUsed = newData.quads.filter(q => q.time === t).reduce((sum, q) => sum + (q.quantity || 0), 0);
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
                              <span className="text-[10px] font-black uppercase text-slate-700">Disponível: {remaining}</span>
                           </div>
                           {isFull && <span className="text-[7.5px] font-black text-rose-500 uppercase bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">Lotado</span>}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1">
                            {['individual', 'dupla', 'adulto-crianca'].map(type => {
                               const qItem = newData.quads.find(q => q.type === type && q.time === t);
                               const qty = qItem ? qItem.quantity : 0;
                               const labels: any = { individual: 'IND.', dupla: 'DUPLA', 'adulto-crianca': 'ADUL + KIDS' };
                               
                               return (
                                  <div key={type} className="flex flex-col gap-1">
                                     <div className={cn(
                                       "h-8 rounded-md border flex items-center justify-center font-black text-[9px] transition-all px-1 text-center",
                                       qty > 0 ? "bg-emerald-600 border-emerald-700 text-white shadow-inner" : "bg-white border-slate-300 text-slate-600"
                                     )}>
                                        {qty > 0 ? `${qty}x` : labels[type]}
                                     </div>
                                     <div className="flex gap-1">
                                        <button onClick={() => {
                                             if (qty > 0) {
                                                const newQuads = newData.quads.map(q => q.type === type && q.time === t ? {...q, quantity: q.quantity - 1} : q).filter(q => q.quantity > 0);
                                                setNewData({...newData, quads: newQuads});
                                             }
                                          }} disabled={qty === 0} 
                                          className="flex-1 h-6 rounded bg-white border border-slate-300 text-slate-800 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-[10px] font-black disabled:opacity-30">-</button>
                                        <button onClick={() => {
                                             if (remaining > 0) {
                                                const existing = newData.quads.find(q => q.type === type && q.time === t);
                                                let newQuads = [...newData.quads];
                                                if (existing) {
                                                   newQuads = newQuads.map(q => q.type === type && q.time === t ? {...q, quantity: q.quantity + 1} : q);
                                                } else {
                                                   newQuads.push({ type, time: t, quantity: 1 });
                                                }
                                                setNewData({...newData, quads: newQuads});
                                             }
                                          }} disabled={remaining <= 0} 
                                          className="flex-1 h-6 rounded bg-white border border-slate-300 text-slate-800 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center text-[10px] font-black disabled:opacity-30">+</button>
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

          {/* Adicionais */}
          <div className="bg-white/70 backdrop-blur-sm p-5 rounded-[2rem] border-2 border-emerald-50 shadow-sm space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'pesca', label: 'Pesca Esportiva', price: 20 },
                  { id: 'futebol-sabao', label: 'Futebol de Sabão', price: 20 }
                ].map(service => {
                   const item = newData.additionals.find(a => a.type === service.id);
                   const qty = item ? item.quantity : 0;
                   return (
                      <div key={service.id} className={cn(
                        "group relative bg-white border-2 rounded-2xl p-3 flex items-center justify-between transition-all",
                        qty > 0 ? "border-emerald-500 shadow-sm" : "border-slate-100"
                      )}>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-900 uppercase">{service.label}</span>
                            <span className="text-[9px] font-bold text-emerald-600">R$ {service.price},00</span>
                         </div>
                         <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button onClick={() => {
                                const newAdd = newData.additionals.map(a => a.type === service.id ? {...a, quantity: Math.max(0, a.quantity - 1)} : a).filter(a => a.quantity > 0);
                                setNewData({...newData, additionals: newAdd});
                              }} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-black hover:bg-rose-500 hover:text-white">-</button>
                            <span className="w-4 text-center text-xs font-black tabular-nums">{qty}</span>
                            <button onClick={() => {
                                const existing = newData.additionals.find(a => a.type === service.id);
                                let newAdd = [...newData.additionals];
                                if (existing) {
                                   newAdd = newAdd.map(a => a.type === service.id ? {...a, quantity: a.quantity + 1} : a);
                                } else {
                                   newAdd.push({ type: service.id, quantity: 1 });
                                }
                                setNewData({...newData, additionals: newAdd});
                              }} className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-black hover:bg-emerald-500 hover:text-white">+</button>
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#114030] p-4 lg:p-6 rounded-t-3xl shadow-xl mt-auto z-10 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex flex-col text-white">
              <span className="text-[10px] font-black uppercase text-emerald-300 tracking-widest">Subtotal Novos Itens</span>
              <div className="flex items-baseline gap-1">
                 <span className="text-xl font-bold text-emerald-400">R$</span>
                 <span className="text-3xl font-black text-white">{totalAdded.toFixed(2).replace('.', ',')}</span>
              </div>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Button 
                variant="outline"
                className="h-12 bg-transparent border-emerald-400 text-emerald-100 hover:bg-emerald-800 hover:text-white font-black text-[10px] uppercase rounded-xl"
                disabled={!hasItems || loading}
                onClick={() => handleAddItems(false)}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apenas Adicionar (Já Pago)"}
              </Button>
              <Button 
                className="h-12 bg-emerald-500 hover:bg-emerald-400 text-[#114030] font-black text-[10px] uppercase rounded-xl"
                disabled={!hasItems || loading}
                onClick={() => handleAddItems(true)}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Somar ao Total
              </Button>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
