import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, UserCheck, Hash, ArrowRight, MessageCircle, Clock, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BookingTable } from '@/components/admin/BookingTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';

import { getAdminOrders, markOrderAsPaid } from '@/integrations/supabase/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type DateFilter = 'today' | 'tomorrow' | 'week' | 'month' | 'past' | 'all';
type TabType = 'reservas' | 'pedidos' | 'quiosques' | 'quads' | 'inventario';

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('reservas');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const { toast } = useToast();

  const [kioskUsage, setKioskUsage] = useState<any[]>([]);
  const [quadUsage, setQuadUsage] = useState<any[]>([]);

  const fetchInventory = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: kiosks } = await supabase.from('kiosk_reservations').select('*').gte('reservation_date', today).order('reservation_date');
    const { data: quads } = await supabase.from('quad_reservations').select('*').gte('reservation_date', today).order('reservation_date');
    setKioskUsage(kiosks || []);
    setQuadUsage(quads || []);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await getAdminOrders();
      setOrders(data || []);
    } catch {
      toast({ title: 'Erro ao carregar pedidos', variant: 'destructive' });
    } finally {
      setLoadingOrders(false);
    }
  }, [toast]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      fetchInventory();
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (ordersError) throw ordersError;

      const orderIds = (ordersData || []).map(o => o.id);
      let itemsData: any[] = [];
      if (orderIds.length > 0) {
        const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds);
        itemsData = items || [];
      }

      const itemsMap = itemsData.reduce((acc: any, item: any) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});

      const { data: legacyData } = await supabase
        .from('bookings' as any)
        .select('*')
        .order('visit_date', { ascending: true });

      const linkedBookingIds = new Set((ordersData || []).map((o: any) => o.booking_id).filter(id => id));
      const linkedCodes = new Set((ordersData || []).map((o: any) => o.confirmation_code?.toUpperCase()).filter(c => c));
      
      const mappedOrders = (ordersData || []).map(o => {
        let items = itemsMap[o.id] || [];
        const entries = items.filter((i: any) => {
          const pid = i.product_id?.toLowerCase() || '';
          return !pid.includes('quiosque') && !pid.includes('quad') && !pid.includes('pesca') && !pid.includes('futebol');
        });
        
        const adultItems = entries.filter((i: any) => !i.product_id?.toLowerCase().includes('criança') && !i.product_id?.toLowerCase().includes('kids'));
        const childItems = entries.filter((i: any) => i.product_id?.toLowerCase().includes('criança') || i.product_id?.toLowerCase().includes('kids'));

        let adultsCount = adultItems.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || 0;
        const childrenCount = childItems.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || 0;

        if (items.length === 0 && o.total_amount > 0) {
           items = [{ id: `v-${o.id}-u`, product_id: 'Entrada (Sem detalhes)', quantity: 1, unit_price: o.total_amount, is_redeemed: false }];
           adultsCount = 1;
        }

        // Se houver itens mas 0 adultos (ex: só escolheu quadriciclo), garantimos ao menos 1 adulto para visibilidade
        if (items.length > 0 && adultsCount === 0) {
            adultsCount = 1; 
        }

        return {
          id: o.id,
          name: o.customer_name,
          phone: o.customer_phone,
          visit_date: o.visit_date,
          status: o.status === 'paid' || o.status === 'confirmed' ? 'confirmed' : (o.status || 'pending'),
          total_amount: Number(o.total_amount),
          confirmation_code: o.confirmation_code,
          created_at: o.created_at,
          notes: o.notes,
          is_order: true,
          booking_id: o.booking_id,
          order_items: items,
          adults: adultsCount,
          children: childrenCount,
          kiosks: items.filter((i: any) => i.product_id?.includes('Quiosque')).map((i: any) => ({ 
            type: i.product_id?.toLowerCase().includes('maior') ? 'maior' : 'menor', 
            quantity: i.quantity || 0 
          })),
          quads: items.filter((i: any) => i.product_id?.includes('Quad')).map((i: any) => ({ 
            type: i.product_id?.toLowerCase().includes('individual') ? 'individual' : i.product_id?.toLowerCase().includes('dupla') ? 'dupla' : 'adulto-crianca', 
            quantity: i.quantity || 0 
          })),
          additionals: items.filter((i: any) => {
            const pid = i.product_id?.toLowerCase() || '';
            const isEntry = !pid.includes('quiosque') && !pid.includes('quad') && !pid.includes('pesca') && !pid.includes('futebol');
            return !pid.includes('quiosque') && !pid.includes('quad') && !isEntry;
          }).map((i: any) => ({
            name: i.product_id,
            quantity: i.quantity || 0
          }))
        };
      });

      const mappedLegacy = (legacyData || []).filter(b => !linkedBookingIds.has(b.id)).map(b => {
        const virtualItems: any[] = [];
        const adults = b.adults || 0;
        const kidsCount = Array.isArray(b.children) ? b.children.length : 0;
        if (kidsCount > 0) virtualItems.push({ id: `v-${b.id}-c`, product_id: 'Criança (Legado)', quantity: kidsCount, is_redeemed: b.status === 'checked-in' });
        
        // Map legacy quads/kiosks into virtual items for detail view
        const legacyKiosks = Array.isArray(b.kiosks) ? b.kiosks : [];
        const legacyQuads = Array.isArray(b.quads) ? b.quads : [];
        const legacyAdds = Array.isArray(b.additionals) ? b.additionals : [];
        
        legacyKiosks.forEach((k: any) => {
          if (k.quantity > 0) virtualItems.push({ id: `v-${b.id}-k-${k.type}`, product_id: `Quiosque ${k.type}`, quantity: k.quantity, is_redeemed: b.status === 'checked-in' });
        });
        legacyQuads.forEach((q: any) => {
          if (q.quantity > 0) virtualItems.push({ id: `v-${b.id}-q-${q.type}`, product_id: `Quad ${q.type}`, quantity: q.quantity, is_redeemed: b.status === 'checked-in' });
        });
        legacyAdds.forEach((a: any) => {
          if (a.quantity > 0) virtualItems.push({ id: `v-${b.id}-a-${a.type}`, product_id: a.type, quantity: a.quantity, is_redeemed: b.status === 'checked-in' });
        });

        return {
          ...b,
          is_order: false,
          adults,
          children: kidsCount,
          total_amount: Number(b.total_amount),
          status: b.status === 'confirmed' || b.status === 'paid' ? 'confirmed' : (b.status || 'pending'),
          order_items: virtualItems
        };
      });

      setBookings([...mappedOrders, ...mappedLegacy].filter(b => b.status !== 'cancelled').sort((a, b) => {
          const dateA = new Date(a.visit_date || '').getTime();
          const dateB = new Date(b.visit_date || '').getTime();
          return dateA - dateB;
      }));
    } catch (err: any) {
      console.error('Fetch Error:', err);
      toast({ title: 'Erro de sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchInventory]);

  useEffect(() => {
    if (!token) return;
    fetchBookings();
    fetchOrders();
    const ch = supabase.channel('adm').on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>fetchBookings()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [token, fetchBookings, fetchOrders]);

  const handleStatusChange = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         if (status === 'cancelled') {
             await supabase.from('quad_reservations').delete().eq('order_id', bookingId);
             await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId);
         }
         await supabase.from('orders').update({ status: status === 'confirmed' ? 'paid' : status }).eq('id', bookingId);
      } else {
         if (status === 'cancelled') {
             // Só temos o 'admin-delete' online pra legacy. update-booking-status retorna 404.
             const res = await supabase.functions.invoke('admin-delete', { body: { bookingId, isOrder: false, adminToken: token } });
             if (res.error) throw new Error(res.error.message || 'Erro ao cancelar reserva antiga.');
             setBookings(prev => prev.filter(b => b.id !== bookingId));
         } else {
             throw new Error("Atualizar status de reserva antiga está inativo no servidor. Apague e recrie.");
         }
      }
      toast({ title: `✓ Atualizado` });
      fetchBookings();
    } catch (err: any) { 
      console.error(err);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }); 
    }
    finally { setUpdatingId(null); }
  };

  const handleReschedule = async (bookingId: string, newDate: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
        await supabase.from('orders').update({ visit_date: newDate }).eq('id', bookingId);
        await supabase.from('kiosk_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId);
        await supabase.from('quad_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId);
      } else {
        throw new Error("Reagendar reservas antigas está inativo no servidor devido a regras RLS. Cancele e recrie.");
      }
      toast({ title: '📅 Reagendado!' });
      fetchBookings();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleDelete = async (bookingId: string, isOrder?: boolean) => {
    // A confirmação já foi feita no BookingTable.tsx, para não pedir duas vezes:
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         // Soft delete V3 order
         await supabase.from('quad_reservations').delete().eq('order_id', bookingId);
         await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId);
         const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', bookingId);
         if (error) throw error;
      } else {
         // Physical delete Legacy order using the Edge Function that works
         const { error } = await supabase.functions.invoke('admin-delete', {
           body: { bookingId, isOrder: false, adminToken: token }
         });
         if (error) throw error;
      }

      setBookings(prev => prev.filter(b => b.id !== bookingId));
      toast({ title: '🗑️ Registro expulso com sucesso!' });

      
      // Delay extra para o Supabase propagar
      setTimeout(() => fetchBookings(), 1000);
    } catch (err: any) {
      console.error('Delete Error:', err);
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally { setUpdatingId(null); }
  };

  const handleAddNote = async (bookingId: string, notes: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
          const { error } = await supabase.from('orders').update({ notes }).eq('id', bookingId);
          if (error) throw error;
      } else {
          // Legacy bookings update disabled on server (RLS)
          console.warn('Salvamento de notas em reservas legadas está inativo no servidor.');
      }
      fetchBookings();
    } catch (err: any) { 
      toast({ title: 'Erro ao salvar nota', description: err.message, variant: 'destructive' }); 
    }
  };

  const [validationValue, setValidationValue] = useState('');
  const handleValidateVoucher = () => {
    if (!validationValue.trim()) return;
    const code = validationValue.trim().toUpperCase();
    const found = bookings.find(b => b.confirmation_code?.toUpperCase() === code);
    if (found) { setSearch(code); setActiveTab('reservas'); toast({ title: "Encontrado!" }); }
    else { toast({ title: "Não encontrado", variant: "destructive" }); }
  };

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const filtered = useMemo(() => {
    let result = bookings;
    
    // First apply the specific date if selected via calendar
    if (selectedDate) {
      result = result.filter(b => b.visit_date === format(selectedDate, 'yyyy-MM-dd'));
      return result;
    }

    if (dateFilter === 'today') result = result.filter(b => b.visit_date && isToday(parseISO(b.visit_date)));
    else if (dateFilter === 'tomorrow') result = result.filter(b => b.visit_date && isTomorrow(parseISO(b.visit_date)));
    else if (dateFilter === 'week') result = result.filter(b => b.visit_date && isThisWeek(parseISO(b.visit_date), { locale: ptBR }));
    else if (dateFilter === 'past') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter(b => b.visit_date && parseISO(b.visit_date) < today);
    } else if (dateFilter === 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        result = result.filter(b => b.visit_date && parseISO(b.visit_date) >= today);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b => (b.name || '').toLowerCase().includes(q) || (b.confirmation_code && b.confirmation_code.toLowerCase().includes(q)) || (b.phone && b.phone.includes(q)));
    }
    return result;
  }, [bookings, dateFilter, search, selectedDate]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayBookings = bookings.filter(b => b.visit_date && isToday(parseISO(b.visit_date)));
    const confirmedToday = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'paid' || b.status === 'checked-in');
    
    // Receitas específicas
    let kRev = 0;
    let qRev = 0;
    bookings.forEach(b => {
      if ((b.status === 'confirmed' || b.status === 'paid' || b.status === 'checked-in') && b.is_order && b.order_items) {
        b.order_items.forEach((i: any) => {
          const pid = (i.product_id || '').toLowerCase();
          if (pid.includes('quiosque')) kRev += (i.unit_price * i.quantity);
          if (pid.includes('quad')) qRev += (i.unit_price * i.quantity);
        });
      }
    });

    return {
      people: todayBookings.reduce((sum, b) => sum + (b.adults || 0) + (b.children || 0), 0),
      revenue: confirmedToday.reduce((sum, b) => sum + Number(b.total_amount), 0),
      count: bookings.filter(b => b.visit_date && b.visit_date >= todayStr).length,
      checked: todayBookings.filter(b => b.status === 'checked-in').length,
      kioskRevenue: kRev,
      quadRevenue: qRev
    };
  }, [bookings]);

  const inventoryView = useMemo(() => {
    const dates = Array.from(new Set([...kioskUsage, ...quadUsage].map(u => u.reservation_date))).sort();
    return (
      <div className="space-y-6">
        {dates.length === 0 && <p className="text-center py-10 text-muted-foreground font-medium italic">Nenhuma reserva futura de Quiosque ou Quadriciclo encontrada.</p>}
        {dates.map(date => {
          const kiosksOnDate = kioskUsage.filter(u => u.reservation_date === date);
          const quadsOnDate = quadUsage.filter(u => u.reservation_date === date);
          const smallUsed = kiosksOnDate.filter(k => k.kiosk_type === 'menor').reduce((s, k) => s + k.quantity, 0);
          const largeUsed = kiosksOnDate.filter(k => k.kiosk_type === 'maior').reduce((s, k) => s + k.quantity, 0);
          return (
            <div key={date} className="bg-white rounded-[2rem] p-6 shadow-sm border border-primary/5 space-y-4">
              <h4 className="font-black text-primary uppercase border-b pb-3">{format(new Date(date + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</h4>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">Quiosques</p>
                   <div className="space-y-4">
                      <div><div className="flex justify-between text-xs font-bold mb-1"><span>Pequenos</span><span>{smallUsed} / 4</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className={cn("h-full", smallUsed >= 4 ? "bg-red-500" : "bg-sun")} style={{ width: `${(smallUsed/4)*100}%` }} /></div></div>
                      <div><div className="flex justify-between text-xs font-bold mb-1"><span>Grande</span><span>{largeUsed} / 1</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className={cn("h-full", largeUsed >= 1 ? "bg-red-500" : "bg-sun")} style={{ width: `${(largeUsed/1)*100}%` }} /></div></div>
                   </div>
                </div>
                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Quadriciclos (5 por horário)</p>
                   <div className="grid grid-cols-2 gap-4">
                      {['09:00', '10:30', '14:00', '15:30'].map(slot => {
                        const used = quadsOnDate.filter(q => q.time_slot === slot).reduce((s, q) => s + q.quantity, 0);
                        return (
                          <div key={slot} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-black"><span>{slot}</span><span className={used >= 5 ? "text-red-600" : ""}>{used}/5</span></div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className={cn("h-full", used >= 5 ? "bg-red-500" : "bg-primary")} style={{ width: `${(used/5)*100}%` }} /></div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [kioskUsage, quadUsage]);

  const kiosksView = useMemo(() => {
    return (
      <div className="space-y-6">
        {kioskUsage.length === 0 && <p className="text-center py-10 text-muted-foreground font-medium italic">Nenhuma reserva de Quiosque encontrada.</p>}
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-green-100">
           <table className="w-full text-left border-collapse">
              <thead className="bg-green-50">
                 <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-green-800 tracking-widest">📅 Data</th>
                    <th className="p-4 text-[10px] font-black uppercase text-green-800 tracking-widest">👤 Cliente</th>
                    <th className="p-4 text-[10px] font-black uppercase text-green-800 tracking-widest">🛖 Item</th>
                    <th className="p-4 text-[10px] font-black uppercase text-green-800 tracking-widest">🔢 Qtd</th>
                    <th className="p-4 text-[10px] font-black uppercase text-green-800 tracking-widest">💰 Valor</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                 {kioskUsage.sort((a,b) => a.reservation_date.localeCompare(b.reservation_date)).map((k, i) => {
                   const b = bookings.find(book => book.id === k.order_id);
                   return (
                     <tr key={i} className="hover:bg-green-50/50 transition-colors">
                        <td className="p-4 text-xs font-bold text-green-900">{format(new Date(k.reservation_date + 'T12:00:00'), "dd/MM")}</td>
                        <td className="p-4">
                           <div className="flex flex-col">
                             <span className="font-black text-xs uppercase text-green-950">{b?.name || '---'}</span>
                             <span className="text-[9px] font-bold text-green-600/60 uppercase">#{k.order_id?.slice(0, 8)}</span>
                           </div>
                        </td>
                        <td className="p-4"><Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 uppercase font-black text-[9px]">{k.kiosk_type === 'maior' ? 'Quiosque Maior' : 'Quiosque Menor'}</Badge></td>
                        <td className="p-4 text-xs font-black text-green-900">{k.quantity}x</td>
                        <td className="p-4 text-xs font-black text-green-900">{k.kiosk_type === 'maior' ? 'R$ 100,00' : 'R$ 75,00'}</td>
                     </tr>
                   );
                 })}
              </tbody>
           </table>
        </div>
      </div>
    );
  }, [kioskUsage, bookings]);

  const quadsView = useMemo(() => {
    return (
      <div className="space-y-6">
        {quadUsage.length === 0 && <p className="text-center py-10 text-muted-foreground font-medium italic">Nenhuma reserva de Quadriciclo encontrada.</p>}
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-blue-100">
           <table className="w-full text-left border-collapse">
              <thead className="bg-blue-50">
                 <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-blue-800 tracking-widest">📅 Data</th>
                    <th className="p-4 text-[10px] font-black uppercase text-blue-800 tracking-widest">🕒 Horário</th>
                    <th className="p-4 text-[10px] font-black uppercase text-blue-800 tracking-widest">👤 Cliente</th>
                    <th className="p-4 text-[10px] font-black uppercase text-blue-800 tracking-widest">🚜 Tipo</th>
                    <th className="p-4 text-[10px] font-black uppercase text-blue-800 tracking-widest">🔢 Qtd</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                 {quadUsage.sort((a,b) => a.reservation_date.localeCompare(b.reservation_date) || (a.time_slot||'').localeCompare(b.time_slot||'')).map((q, i) => {
                   const b = bookings.find(book => book.id === q.order_id);
                   return (
                     <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                        <td className="p-4 text-xs font-bold text-blue-900">{format(new Date(q.reservation_date + 'T12:00:00'), "dd/MM")}</td>
                        <td className="p-4"><div className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-black w-fit">{q.time_slot}</div></td>
                        <td className="p-4">
                           <div className="flex flex-col">
                             <span className="font-black text-xs uppercase text-blue-950">{b?.name || '---'}</span>
                             <span className="text-[9px] font-bold text-blue-600/60 uppercase">#{q.order_id?.slice(0, 8)}</span>
                           </div>
                        </td>
                        <td className="p-4"><Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 uppercase font-black text-[9px]">{q.quad_type}</Badge></td>
                        <td className="p-4 text-xs font-black text-blue-900">{q.quantity}x</td>
                     </tr>
                   );
                 })}
              </tbody>
           </table>
        </div>
      </div>
    );
  }, [quadUsage, bookings]);

  if (!token) return <AdminLogin onLogin={(t) => setToken(t)} />;

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans pb-20">
      <div className="bg-primary text-primary-foreground p-4 md:p-6 sticky top-0 z-50 shadow-xl border-b-4 border-sun/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <CalendarCheck className="w-6 h-6 text-sun hidden sm:block" />
             <div><h1 className="font-display font-black text-xl md:text-2xl leading-none">Balneário Lessa</h1><p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Management Portal v3.0</p></div>
           </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="bg-sun/20 text-sun border-sun/40 hover:bg-sun/40" onClick={() => window.open('/', '_blank')}>NOVA RESERVA</Button>
            <Button size="sm" variant="destructive" disabled={loading} onClick={async () => {
              if (confirm('Limpar TODOS os dados de teste na tela agora mesmo?')) {
                setLoading(true);
                try {
                  let deleted = 0;
                  for (const b of bookings) {
                    try {
                      if (b.is_order) {
                         await supabase.from('quad_reservations').delete().eq('order_id', b.id);
                         await supabase.from('kiosk_reservations').delete().eq('order_id', b.id);
                         await supabase.from('orders').update({ status: 'cancelled' }).eq('id', b.id);
                      } else {
                         await supabase.functions.invoke('admin-delete', { 
                           body: { bookingId: b.id, isOrder: false, adminToken: token } 
                         });
                      }
                      deleted++;
                    } catch (errInner) {
                      console.error("Falha ao remover item único:", b.id, errInner);
                    }
                  }
                  alert(`Sucesso! ${deleted} reservas foram expulsas.`);
                  fetchBookings(); 
                  fetchOrders();
                } catch(e: any) {
                  alert('Erro ao limpar testes: ' + e.message);
                } finally {
                  setLoading(false);
                }
              }
            }}>LIMPAR TESTES</Button>
            <Button size="icon" variant="ghost" onClick={() => { fetchBookings(); fetchOrders(); }} disabled={loading}><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></Button>
            <Button size="icon" variant="ghost" onClick={() => { localStorage.removeItem('admin_token'); setToken(null); }}><LogOut className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border-4 border-primary/5 flex flex-col md:flex-row items-center gap-4">
           <div className="flex-1 space-y-1 w-full text-center md:text-left"><h3 className="text-lg font-black text-primary uppercase">Validação de Entrada</h3><p className="text-xs text-muted-foreground font-medium">Digite o código do voucher.</p></div>
           <div className="flex w-full md:w-auto gap-2">
              <Input placeholder="E31357" className="h-14 rounded-2xl border-2 border-primary/10 font-mono font-bold text-lg uppercase pl-4" value={validationValue} onChange={(e) => setValidationValue(e.target.value)} />
              <Button onClick={handleValidateVoucher} className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary-dark text-white font-black">VALIDAR</Button>
           </div>
        </div>

        <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-[2rem] gap-1 shadow-inner border border-white overflow-x-auto no-scrollbar">
          <Button className="flex-1 rounded-xl font-bold whitespace-nowrap px-3 text-xs" variant={activeTab === 'reservas' ? 'default' : 'ghost'} onClick={() => setActiveTab('reservas')}><Users className="w-3.5 h-3.5 mr-1.5" /> Agenda</Button>
          <Button className="flex-1 rounded-xl font-bold whitespace-nowrap px-3 text-xs" variant={activeTab === 'quiosques' ? 'default' : 'ghost'} onClick={() => setActiveTab('quiosques')}>⛺ Quiosques</Button>
          <Button className="flex-1 rounded-xl font-bold whitespace-nowrap px-3 text-xs" variant={activeTab === 'quads' ? 'default' : 'ghost'} onClick={() => setActiveTab('quads')}>🚜 Quads</Button>
          <Button className="flex-1 rounded-xl font-bold whitespace-nowrap px-3 text-xs" variant={activeTab === 'pedidos' ? 'default' : 'ghost'} onClick={() => setActiveTab('pedidos')}><DollarSign className="w-3.5 h-3.5 mr-1.5" /> Vendas</Button>
          <Button className="flex-1 rounded-xl font-bold whitespace-nowrap px-3 text-xs" variant={activeTab === 'inventario' ? 'default' : 'ghost'} onClick={() => setActiveTab('inventario')}><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Mapa</Button>
        </div>

        {activeTab === 'inventario' ? inventoryView : activeTab === 'quiosques' ? kiosksView : activeTab === 'quads' ? quadsView : activeTab === 'pedidos' ? (
          <div className="space-y-4">
             <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar pedidos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
             <div className="grid gap-3">
                {orders.filter(o => !search || o.customer_name?.toLowerCase().includes(search.toLowerCase())).map(order => (
                  <Dialog key={order.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer">
                        <CardContent className="p-4 flex justify-between items-center">
                          <div className="flex flex-col"><span className="text-[10px] font-black text-muted-foreground">#{order.id.slice(0, 8)}</span><span className="text-sm font-bold">{order.customer_name}</span></div>
                          <div className="text-right"><div className="text-lg font-black text-primary">{formatCurrency(order.total_amount)}</div><Badge variant={order.status === 'paid' ? 'default' : 'outline'}>{order.status === 'paid' ? 'Pago' : 'Pendente'}</Badge></div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent>
                       <DialogHeader><DialogTitle>Itens do Pedido</DialogTitle></DialogHeader>
                       <div className="space-y-2 pt-4">
                          {order.order_items?.map((item: any, id: number) => (
                             <div key={id} className="flex justify-between text-sm"><span>{item.quantity}x {item.product_id}</span><span>{formatCurrency(item.unit_price * item.quantity)}</span></div>
                          ))}
                          <div className="border-t pt-2 mt-2 font-black text-lg flex justify-between"><span>Total</span><span>{formatCurrency(order.total_amount)}</span></div>
                          {order.status !== 'paid' && <Button className="w-full mt-4 bg-sun text-white font-bold" onClick={() => markOrderAsPaid(order.id).then(() => { fetchOrders(); fetchBookings(); })}>Confirmar Pagamento</Button>}
                       </div>
                    </DialogContent>
                  </Dialog>
                ))}
             </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white/80 backdrop-blur-md border-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all duration-300 rounded-[2.5rem] overflow-hidden group">
                 <CardContent className="p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                       <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex flex-col">
                       <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.people}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Visitantes Hoje</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-md border-blue-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all duration-300 rounded-[2.5rem] overflow-hidden group">
                 <CardContent className="p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                       <Badge className="bg-blue-600 scale-125">🚜</Badge>
                    </div>
                    <div className="flex flex-col">
                       <p className="text-3xl font-black text-slate-900 tabular-nums">{quadUsage.length}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Quads Ativos</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-md border-sun/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all duration-300 rounded-[2.5rem] overflow-hidden group">
                 <CardContent className="p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sun/5 flex items-center justify-center group-hover:bg-sun/10 transition-colors">
                       <TrendingUp className="w-6 h-6 text-sun-dark" />
                    </div>
                    <div className="flex flex-col">
                       <p className="text-2xl font-black text-sun-dark tabular-nums">{formatCurrency(stats.kioskRevenue)}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Rec. Quiosques</p>
                    </div>
                 </CardContent>
              </Card>
              <Card className="bg-white/80 backdrop-blur-md border-sun/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-xl transition-all duration-300 rounded-[2.5rem] overflow-hidden group">
                 <CardContent className="p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sun/5 flex items-center justify-center group-hover:bg-sun/10 transition-colors">
                       <DollarSign className="w-6 h-6 text-sun-dark" />
                    </div>
                    <div className="flex flex-col">
                       <p className="text-2xl font-black text-sun-dark tabular-nums">{formatCurrency(stats.quadRevenue)}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Rec. Quadriciclos</p>
                    </div>
                 </CardContent>
              </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-100 flex-1">
                {[{k:'today',l:'Hoje'},{k:'tomorrow',l:'Amanhã'},{k:'past',l:'Histórico'}].map(f=>(
                  <Button key={f.k} onClick={()=>{setDateFilter(f.k as any); setSelectedDate(undefined);}} variant={dateFilter===f.k?'default':'ghost'} className={cn("flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest h-10 transition-all", dateFilter===f.k && "shadow-lg shadow-primary/20")}>{f.l}</Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className={cn("flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest h-10 gap-2", selectedDate && "text-primary bg-primary/5")}>
                      <CalendarCheck className="w-4 h-4" />
                      {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Calendário'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setDateFilter('all'); }} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="relative flex-[1.5]">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input 
                  placeholder="Busque por nome do cliente ou código..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="h-14 pl-14 pr-6 rounded-2xl border-none bg-white/80 backdrop-blur-md shadow-sm focus:ring-2 focus:ring-primary/20 font-medium placeholder:text-slate-300" 
                />
              </div>
            </div>

            <BookingTable bookings={filtered} onStatusChange={handleStatusChange} onAddNote={handleAddNote} onReschedule={handleReschedule} onDelete={handleDelete} updatingId={updatingId} />
          </div>
        )}
      </div>
    </div>
  );
}
