import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, UserCheck, Hash, ArrowRight, MessageCircle, Clock, Circle, Trash2 } from 'lucide-react';
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

const BR_HOLIDAYS_2026 = [
  "2026-01-01", // Ano Novo
  "2026-02-16", "2026-02-17", // Carnaval
  "2026-04-03", // Sexta-feira Santa
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-06-04", // Corpus Christi
  "2026-09-07", // Independência
  "2026-10-12", // Aparecida
  "2026-11-02", // Finados
  "2026-11-15", // Proclamação da República
  "2026-11-20", // Zumbi dos Palmares
  "2026-12-25", // Natal
];

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
         // Na Versão 3, o botão CANCELAR deve APENAS mudar o status.
         // A exclusão física é feita no botão APAGAR separadamente.
         const { error } = await supabase.from('orders').update({ 
           status: status === 'confirmed' ? 'paid' : status
         }).eq('id', bookingId).select('id');
         if (error) throw error;
      } else {
         const { error } = await supabase.from('bookings').update({ 
            status: status === 'confirmed' ? 'paid' : status
         }).eq('id', bookingId).select('id');
         if (error) throw error;
      }
      toast({ title: `✓ Status: ${status}` });
      fetchBookings();
    } catch (err: any) { 
      console.error(err);
      toast({ title: 'Erro de Conexão', description: 'Não foi possível atualizar status (RLS). Verifique permissões.', variant: 'destructive' }); 
    }
    finally { setUpdatingId(null); }
  };

  const handleReschedule = async (bookingId: string, newDate: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
        await supabase.from('orders').update({ visit_date: newDate }).eq('id', bookingId).select('id');
        await supabase.from('kiosk_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId).select('id');
        await supabase.from('quad_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId).select('id');
      } else {
        await supabase.from('bookings').update({ visit_date: newDate }).eq('id', bookingId).select('id');
      }
      toast({ title: '📅 Agenda Reagendada!' });
      fetchBookings();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleDelete = async (bookingId: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         await supabase.from('quad_reservations').delete().eq('order_id', bookingId).select('id');
         await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId).select('id');
         await supabase.from('payments').delete().eq('order_id', bookingId).select('id');
         await supabase.from('vouchers').delete().eq('order_id', bookingId).select('id');
         await supabase.from('order_items').delete().eq('order_id', bookingId).select('id');
         const { error } = await supabase.from('orders').delete().eq('id', bookingId).select('id');
         if (error) throw error;
      } else {
         const { error } = await supabase.from('bookings').delete().eq('id', bookingId).select('id');
         if (error) throw error;
      }
      
      toast({ title: '✓ Excluído permanentemente' });
      fetchBookings();
    } catch (err: any) {
      console.error('Delete Error:', err);
      toast({ title: 'Erro ao excluir', description: 'RLS impede acesso direto.', variant: 'destructive' });
    } finally { setUpdatingId(null); }
  };

  const handleRemoveItem = async (orderId: string, itemId: string, productId: string) => {
    try {
      // 1. Apagar da tabela de itens do pedido
      await supabase.from('order_items').delete().eq('id', itemId).select('id');
      
      // 2. Se for quiosque ou quadriciclo, apagar da tabela de inventário correspondente
      const name = productId.toLowerCase();
      if (name.includes('quiosque')) {
          const type = name.includes('maior') ? 'maior' : 'menor';
          await supabase.from('kiosk_reservations').delete().eq('order_id', orderId).eq('kiosk_type', type).select('id');
      } else if (name.includes('quad')) {
          const type = name.includes('dupla') ? 'dupla' : name.includes('individual') ? 'individual' : 'adulto-crianca';
          await supabase.from('quad_reservations').delete().eq('order_id', orderId).eq('quad_type', type).select('id');
      }
      
      toast({ title: 'Item removido da reserva' });
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Erro ao remover item', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddNote = async (bookingId: string, notes: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
          const { error } = await supabase.from('orders').update({ notes }).eq('id', bookingId).select('id');
          if (error) throw error;
      } else {
          const { error } = await supabase.from('bookings').update({ notes }).eq('id', bookingId).select('id');
          if (error) throw error;
      }
      toast({ title: '📝 Nota salva!' });
      fetchBookings();
    } catch (err: any) { 
      console.error('AddNote Error:', err);
      toast({ title: 'Erro ao salvar nota', description: 'RLS impediu salvamento.', variant: 'destructive' }); 
    }
  };

  const clearTestOrders = async () => {
    if (!confirm('Você deseja remover todos os pedidos PENDENTES com valor R$ 0,00?')) return;
    try {
       const { data: tests } = await supabase.from('orders').select('id').eq('status', 'pending').eq('total_amount', 0);
       if (!tests || tests.length === 0) {
         toast({ title: 'Nenhum teste encontrado' });
         return;
       }
       for (const t of tests) {
         await supabase.from('order_items').delete().eq('order_id', t.id);
         await supabase.from('orders').delete().eq('id', t.id);
       }
       toast({ title: `${tests.length} testes removidos!` });
       fetchOrders();
       fetchBookings();
    } catch (err: any) {
       toast({ title: 'Erro ao limpar', description: err.message, variant: 'destructive' });
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
    const targetDate = selectedDate || new Date();
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    const kOnDate = kioskUsage.filter(u => u.reservation_date === dateStr);
    const qOnDate = quadUsage.filter(u => u.reservation_date === dateStr);
    
    const smallCount = kOnDate.filter(k => k.kiosk_type === 'menor').reduce((s, k) => s + k.quantity, 0);
    const largeCount = kOnDate.filter(k => k.kiosk_type === 'maior').reduce((s, k) => s + k.quantity, 0);

    const kioskUnits = [
      { id: 'maior', name: 'Quiosque Grande', occupied: largeCount > 0 },
      { id: 'menor1', name: 'Quiosque 2', occupied: smallCount > 0 },
      { id: 'menor2', name: 'Quiosque 3', occupied: smallCount > 1 },
      { id: 'menor3', name: 'Quiosque 4', occupied: smallCount > 2 },
      { id: 'menor4', name: 'Quiosque 5', occupied: smallCount > 3 },
    ];

    const timeSlots = [
      { label: '09:00 - 10:30', key: '09:00' },
      { label: '10:30 - 12:00', key: '10:30' },
      { label: '13:00 - 14:30', key: '14:00' },
      { label: '14:30 - 16:00', key: '15:30' },
    ];

    return (
      <div className="grid lg:grid-cols-[1fr_380px] gap-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
        {/* LEFT: DAILY OPERATION */}
        <div className="bg-white rounded-[3.5rem] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100/50">
           <div className="flex items-center gap-6 mb-12">
              <div className="w-16 h-16 bg-[#1e4d2b] text-white rounded-[1.5rem] flex items-center justify-center font-black text-3xl shadow-lg shadow-green-900/20">
                {format(targetDate, 'dd')}
              </div>
              <div className="space-y-1">
                 <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Operação Diária</h3>
                 <p className="text-sm font-bold text-slate-400 capitalize">{format(targetDate, 'EEEE, yyyy', { locale: ptBR })}</p>
              </div>
           </div>
           
           <div className="bg-[#fffdf2] rounded-[3rem] border border-sun/20 shadow-sm overflow-hidden">
              <div className="p-8 bg-[#fffbe6] flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-sun/20 flex items-center justify-center text-sun-dark">
                    <TrendingUp className="w-5 h-5" />
                 </div>
                 <span className="font-black text-sun-dark uppercase text-lg tracking-tight">Resumo de {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              
              <div className="grid md:grid-cols-2 divide-x divide-sun/10">
                 {/* KIOSKS */}
                 <div className="p-10 space-y-8">
                    <h4 className="flex items-center gap-3 text-whatsapp font-black uppercase text-sm tracking-widest">
                       <Users className="w-5 h-5" /> Quiosques ({smallCount + largeCount}/5)
                    </h4>
                    <div className="space-y-3">
                       {kioskUnits.map((ku, idx) => (
                         <div key={idx} className={cn(
                           "p-5 border-2 rounded-[1.5rem] flex justify-between items-center transition-all",
                           ku.occupied ? "bg-whatsapp/5 border-whatsapp/20" : "bg-white border-slate-50 opacity-60"
                         )}>
                            <span className={cn("font-bold text-sm", ku.occupied ? "text-whatsapp font-black" : "text-slate-400")}>{ku.name}</span>
                            <span className={cn("italic text-[10px] font-black uppercase tracking-widest", ku.occupied ? "text-whatsapp opacity-100" : "text-slate-300 opacity-50")}>
                               {ku.occupied ? 'Ocupado' : 'Livre'}
                            </span>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* QUADS */}
                 <div className="p-10 space-y-8 bg-blue-50/10">
                    <h4 className="flex items-center gap-3 text-blue-600 font-black uppercase text-sm tracking-widest">
                       <RefreshCw className="w-5 h-5" /> Quadriciclos
                    </h4>
                    <div className="space-y-5">
                       {timeSlots.map((slot, idx) => {
                          const used = qOnDate.filter(q => q.time_slot === slot.key).reduce((s,q)=>s+q.quantity,0);
                          const slotUsage = qOnDate.filter(q => q.time_slot === slot.key);
                          return (
                            <div key={idx} className={cn(
                              "p-6 rounded-[2rem] border-2 transition-all",
                              used > 0 ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" : "bg-white border-blue-50"
                            )}>
                               <div className="flex justify-between items-center mb-3">
                                  <span className={cn("text-xs font-black uppercase tracking-wider", used > 0 ? "text-white" : "text-blue-900")}>{slot.label}</span>
                                  <span className={cn("text-[10px] font-bold", used > 0 ? "text-blue-100" : "text-blue-400")}>{used}/5 ocupados</span>
                               </div>
                               {slotUsage.length > 0 ? (
                                 <div className="space-y-1">
                                    {slotUsage.map((val, i) => (
                                      <p key={i} className="text-[10px] font-bold opacity-80 truncate">🏷️ {bookings.find(b => b.id === val.order_id)?.name || 'Cliente'}</p>
                                    ))}
                                 </div>
                               ) : (
                                 <p className="text-[10px] text-slate-300 italic text-center py-2 border border-dashed rounded-xl border-slate-100">Nenhuma reserva</p>
                               )}
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* RIGHT: SIDEBAR */}
        <div className="space-y-8">
           <div className="bg-white rounded-[3.5rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100/50">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-3 bg-whatsapp/5 rounded-2xl text-whatsapp"><CalendarCheck className="w-6 h-6" /></div>
                 <h3 className="font-black text-slate-800 text-xl tracking-tight">Resumo Geral</h3>
              </div>
              <p className="text-[11px] font-medium text-slate-400 leading-relaxed mb-10">Selecione uma data para organizar seu dia de operações no Balneário.</p>
              
              <div className="space-y-4 mb-12">
                 <div className="h-14 bg-whatsapp flex items-center justify-center rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-whatsapp/20">
                    ⛺ Quiosques Ocupados
                 </div>
                 <div className="h-14 bg-blue-600 flex items-center justify-center rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20">
                    🚜 Quadriciclos Alugados
                 </div>
              </div>
              
              <div className="border-t border-slate-50 pt-10">
                 <Calendar 
                    mode="single" 
                    selected={selectedDate} 
                    onSelect={(d) => { if(d) setSelectedDate(d); setDateFilter('all'); }} 
                    initialFocus 
                    locale={ptBR}
                    modifiers={{
                      booked: (date) => bookings.some(b => b.visit_date === format(date, 'yyyy-MM-dd')),
                      holiday: (date) => BR_HOLIDAYS_2026.includes(format(date, 'yyyy-MM-dd'))
                    }}
                    modifiersStyles={{
                      booked: { outline: '3px solid #22c55e', outlineOffset: '-3px', fontWeight: '900', borderRadius: '12px' },
                      holiday: { color: 'var(--sun-dark)', backgroundColor: 'rgba(255,183,1,0.1)' }
                    }}
                    className="w-full pointer-events-auto"
                 />
              </div>
           </div>
           
           <Card className="bg-whatsapp rounded-[3rem] p-8 border-none text-white overflow-hidden relative group cursor-pointer hover:scale-[1.02] transition-all" onClick={() => setActiveTab('reservas')}>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 opacity-70">Acesso Rápido</h4>
              <p className="text-2xl font-black leading-tight mb-4">Gerenciar<br/>Vouchers</p>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                 <ArrowRight className="w-6 h-6" />
              </div>
           </Card>
        </div>
      </div>
    );
  }, [kioskUsage, quadUsage, selectedDate, bookings]);

  const kiosksView = useMemo(() => {
    return (
      <div className="animate-in fade-in duration-700">
         <div className="bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/10">
               <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Listagem de Quiosques</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Inventário e Check-ins</p>
               </div>
               <Badge className="bg-[#14532d] text-white font-black px-4 py-2 rounded-xl">⛺ TOTAL: {kioskUsage.reduce((s,k)=>s+k.quantity,0)}</Badge>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                     <tr><th className="p-8">Check-in</th><th className="p-8">Cliente</th><th className="p-8">Tipo</th><th className="p-8">Qtd</th><th className="p-8">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {kioskUsage.map((k, i) => {
                       const b = bookings.find(book => book.id === k.order_id);
                       return (
                         <tr key={i} className="hover:bg-[#14532d]/5 transition-colors group">
                            <td className="p-8 text-sm font-black text-slate-600">{format(parseISO(k.reservation_date), 'dd/MM')}</td>
                            <td className="p-8">
                               <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-800 uppercase">{b?.name || '---'}</span>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">#{k.order_id?.slice(0,8)}</span>
                               </div>
                            </td>
                            <td className="p-8"><Badge variant="outline" className="text-[10px] font-black uppercase bg-white border-slate-100 rounded-lg">{k.kiosk_type === 'maior' ? 'Grande' : 'Pequeno'}</Badge></td>
                            <td className="p-8 text-sm font-black text-slate-900">{k.quantity}</td>
                            <td className="p-8">
                               <Dialog>
                                 <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold text-[10px] text-[#14532d] border-[#14532d]/20 hover:bg-[#14532d] hover:text-white uppercase tracking-widest transition-all">GERENCIAR</Button>
                                 </DialogTrigger>
                                 <DialogContent className="rounded-[2.5rem] p-10 max-w-md">
                                    <DialogHeader><DialogTitle className="text-xl font-black text-slate-800 uppercase text-center mb-6">Ações da Reserva</DialogTitle></DialogHeader>
                                    <div className="grid gap-3">
                                       <Button className="h-14 bg-whatsapp hover:bg-[#166534] text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleReschedule(k.order_id, k.reservation_date, true)}>📅 REAGENDAR DATA</Button>
                                       <Button className="h-14 bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleStatusChange(k.order_id, 'cancelled', true)}>❌ CANCELAR PEDIDO</Button>
                                       <Button className="h-14 bg-red-900 hover:bg-black text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleDelete(k.order_id, true)}>🗑️ EXCLUIR PERMANENTE</Button>
                                       <div className="mt-4 pt-4 border-t space-y-2">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexar Comprovante (URL)</p>
                                          <div className="flex gap-2">
                                             <Input placeholder="https://..." className="h-12 rounded-xl" />
                                             <Button className="h-12 bg-sun text-sun-dark font-black px-4 rounded-xl">SALVAR</Button>
                                          </div>
                                       </div>
                                    </div>
                                 </DialogContent>
                               </Dialog>
                            </td>
                         </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    );
  }, [kioskUsage, bookings, handleStatusChange, handleReschedule, handleDelete]);

  const quadsView = useMemo(() => {
    return (
      <div className="animate-in fade-in duration-700">
         <div className="bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/10">
               <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Frota de Quadriciclos</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Saídas e Horários</p>
               </div>
               <Badge className="bg-blue-800 text-white font-black px-4 py-2 rounded-xl">🚜 TOTAL: {quadUsage.reduce((s,q)=>s+q.quantity,0)}</Badge>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                     <tr><th className="p-8">Data</th><th className="p-8">Horário</th><th className="p-8">Cliente</th><th className="p-8">Modelo</th><th className="p-8">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {quadUsage.map((q, i) => {
                       const b = bookings.find(book => book.id === q.order_id);
                       return (
                         <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-8 text-sm font-black text-slate-600">{format(parseISO(q.reservation_date), 'dd/MM')}</td>
                            <td className="p-8 text-sm font-black text-blue-700">{q.time_slot}</td>
                            <td className="p-8 text-sm font-bold text-slate-800 uppercase">{b?.name || '---'}</td>
                            <td className="p-8"><Badge variant="outline" className="text-[10px] font-black uppercase bg-white border-blue-50 text-blue-500 rounded-lg">{q.quad_type}</Badge></td>
                            <td className="p-8">
                               <Dialog>
                                 <DialogTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-10 rounded-xl font-bold text-[10px] text-blue-700 border-blue-100 hover:bg-blue-700 hover:text-white uppercase tracking-widest transition-all">GERENCIAR</Button>
                                 </DialogTrigger>
                                 <DialogContent className="rounded-[2.5rem] p-10 max-w-md">
                                    <DialogHeader><DialogTitle className="text-xl font-black text-slate-800 uppercase text-center mb-6">Ações da Reserva</DialogTitle></DialogHeader>
                                    <div className="grid gap-3">
                                       <Button className="h-14 bg-whatsapp hover:bg-[#166534] text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleReschedule(q.order_id, q.reservation_date, true)}>📅 REAGENDAR DATA</Button>
                                       <Button className="h-14 bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleStatusChange(q.order_id, 'cancelled', true)}>❌ CANCELAR PEDIDO</Button>
                                       <Button className="h-14 bg-red-900 hover:bg-black text-white font-black uppercase text-[11px] rounded-2xl flex items-center gap-3" onClick={() => handleDelete(q.order_id, true)}>🗑️ EXCLUIR PERMANENTE</Button>
                                       <div className="mt-4 pt-4 border-t space-y-2">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexar Comprovante (URL)</p>
                                          <div className="flex gap-2">
                                             <Input placeholder="https://..." className="h-12 rounded-xl" />
                                             <Button className="h-12 bg-sun text-sun-dark font-black px-4 rounded-xl">SALVAR</Button>
                                          </div>
                                       </div>
                                    </div>
                                 </DialogContent>
                               </Dialog>
                            </td>
                         </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    );
  }, [quadUsage, bookings, handleStatusChange, handleReschedule, handleDelete]);

  if (!token) return <AdminLogin onLogin={(t) => setToken(t)} />;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-32">
      {/* BRAND HEADER */}
      <div className="bg-[#052e16] py-8 px-6 md:px-12 border-b-[6px] border-[#166534]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[40%] h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 bg-sun rounded-[1.5rem] flex items-center justify-center p-3 shadow-xl">
                <CalendarCheck className="w-full h-full text-sun-dark" />
             </div>
             <div className="text-center md:text-left">
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Balneário Lessa</h1>
                <p className="text-[#166534] font-black text-[12px] uppercase tracking-[0.4em] mt-2">Sistema de Reservas</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button size="lg" className="bg-[#166534] hover:bg-[#14532d] text-white font-black px-10 rounded-2xl shadow-xl shadow-green-900/40 border-b-4 border-green-800 transition-all active:translate-y-1 active:border-b-0 flex items-center gap-3" onClick={() => { fetchBookings(); fetchOrders(); toast({title:"Dados Sincronizados"}); }}>
               <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} /> ATUALIZAR
            </Button>
            <Button size="icon" variant="ghost" className="text-white h-14 w-14 rounded-2xl hover:bg-white/10" onClick={() => { localStorage.removeItem('admin_token'); setToken(null); }}>
               <LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 -translate-y-10">
        <div className="bg-white/90 backdrop-blur-3xl p-3 rounded-[3rem] shadow-2xl shadow-slate-200 border border-white flex flex-col md:flex-row gap-2 mb-12">
          {[
            { id: 'inventario', label: '📊 Visão Geral', color: 'bg-sun text-sun-dark shadow-sun/20' },
            { id: 'quiosques', label: '⛺ Quiosques', color: 'bg-whatsapp text-white shadow-whatsapp/20' },
            { id: 'quads', label: '🚜 Quadriciclos', color: 'bg-blue-600 text-white shadow-blue-600/20' },
            { id: 'reservas', label: '🕒 Agenda', color: 'bg-slate-800 text-white shadow-slate-800/20' },
            { id: 'pedidos', label: '💰 Vendas', color: 'bg-slate-800 text-white shadow-slate-800/20' },
          ].map((tab) => (
            <Button 
               key={tab.id}
               className={cn(
                 "flex-1 h-16 rounded-[2.5rem] font-bold text-xs uppercase tracking-widest transition-all", 
                 activeTab === tab.id ? `${tab.color} shadow-xl` : "bg-transparent text-slate-400 hover:text-slate-600"
               )}
               onClick={() => setActiveTab(tab.id as any)}
            >
               {tab.label}
            </Button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="space-y-10">
           {activeTab === 'inventario' ? inventoryView : activeTab === 'quiosques' ? kiosksView : activeTab === 'quads' ? quadsView : activeTab === 'pedidos' ? (
             <div className="space-y-6">
                <div className="relative group">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-[#1e4d2b] transition-colors" />
                   <Input 
                      placeholder="Buscar vendas por nome ou valor..." 
                      value={search} 
                      onChange={(e) => setSearch(e.target.value)} 
                      className="h-20 pl-16 rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-white font-bold text-lg placeholder:text-slate-200 focus:ring-4 focus:ring-primary/5 transition-all w-full" 
                   />
                </div>
                <div className="grid gap-4">
                   {orders.filter(o => !search || o.customer_name?.toLowerCase().includes(search.toLowerCase())).map(order => (
                     <Dialog key={order.id}>
                       <DialogTrigger asChild>
                         <Card className="cursor-pointer bg-white rounded-[2.5rem] border-none shadow-lg hover:shadow-2xl transition-all p-8 flex items-center justify-between group">
                            <div className="flex items-center gap-6">
                               <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                  <DollarSign className="w-6 h-6" />
                               </div>
                               <div>
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Venda #{order.id.slice(0, 8)}</span>
                                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter mt-1">{order.customer_name}</h4>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-2xl font-black text-primary tabular-nums tracking-tighter">{formatCurrency(order.total_amount)}</div>
                               <Badge className={cn(
                                 "mt-1 rounded-lg font-black text-[9px] px-3",
                                 order.status === 'paid' ? "bg-whatsapp/10 text-whatsapp border-whatsapp/20" : "bg-red-50 text-red-500 border-red-100"
                               )} variant="outline">
                                  {order.status === 'paid' ? 'CONCLUÍDO' : 'PENDENTE'}
                               </Badge>
                            </div>
                         </Card>
                       </DialogTrigger>
                       <DialogContent className="rounded-[3rem] p-10 border-none max-w-lg">
                          <DialogHeader><DialogTitle className="text-2xl font-black text-slate-800 uppercase text-center mb-6">Detalhamento Financeiro</DialogTitle></DialogHeader>
                          <div className="space-y-6">
                             {order.order_items?.map((item: any, id: number) => (
                                <div key={id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                   <div className="flex flex-col">
                                      <span className="text-sm font-black text-slate-800">{item.quantity}x {item.product_id}</span>
                                      <span className="text-[10px] font-bold text-slate-400 capitalize">Preço Unitário: {formatCurrency(item.unit_price)}</span>
                                   </div>
                                   <span className="font-black text-primary">{formatCurrency(item.unit_price * item.quantity)}</span>
                                </div>
                             ))}
                             <div className="bg-primary p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-xl shadow-primary/20">
                                <span className="font-black uppercase tracking-widest text-sm opacity-70">Total Recebido</span>
                                <span className="text-3xl font-black tabular-nums tracking-tighter">{formatCurrency(order.total_amount)}</span>
                             </div>
                             {order.status !== 'paid' && (
                               <Button className="w-full h-16 bg-sun text-sun-dark font-black text-lg rounded-2xl shadow-xl shadow-sun/20 border-b-4 border-sun-dark transition-all active:translate-y-1 active:border-b-0" onClick={() => markOrderAsPaid(order.id).then(() => { fetchOrders(); fetchBookings(); toast({title:"Pagamento Confirmado!"}); })}>
                                  EFETIVAR PAGAMENTO
                               </Button>
                             )}
                          </div>
                       </DialogContent>
                     </Dialog>
                   ))}
                </div>
             </div>
           ) : (
             <div className="space-y-12">
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Visitantes Hoje', val: stats.people, icon: Users, color: 'text-primary bg-primary/5 border-primary/10' },
                    { label: 'Rec. Quiosques', val: formatCurrency(stats.kioskRevenue), icon: TrendingUp, color: 'text-sun-dark bg-sun/5 border-sun/20' },
                    { label: 'Rec. Quadriciclos', val: formatCurrency(stats.quadRevenue), icon: DollarSign, color: 'text-sun-dark bg-sun/5 border-sun/20' },
                    { label: 'Check-ins', val: stats.checked, icon: UserCheck, color: 'text-whatsapp bg-whatsapp/5 border-whatsapp/10' },
                  ].map((s, i) => (
                    <Card key={i} className={cn("rounded-[2.5rem] border p-8 bg-white/80 backdrop-blur-md shadow-lg group transition-all hover:scale-[1.03]", s.color)}>
                       <div className="flex flex-col items-center gap-4 text-center">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-sm group-hover:shadow-md transition-all">
                             <s.icon className="w-6 h-6" />
                          </div>
                          <div>
                             <p className="text-2xl font-black tracking-tighter">{s.val}</p>
                             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">{s.label}</p>
                          </div>
                       </div>
                    </Card>
                  ))}
               </div>

               <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex bg-white rounded-[2.5rem] p-2 shadow-xl shadow-slate-200/50 border border-slate-100 flex-1">
                     {[{k:'today',l:'Hoje'},{k:'tomorrow',l:'Amanhã'},{k:'week',l:'Semana'},{k:'all',l:'Próximos'}].map(f=>(
                       <Button 
                          key={f.k} 
                          onClick={()=>{setDateFilter(f.k as any); setSelectedDate(undefined);}} 
                          variant={dateFilter===f.k?'default':'ghost'} 
                          className={cn("flex-1 h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all", dateFilter===f.k ? "bg-primary text-white shadow-lg" : "text-slate-400")}
                       >
                          {f.l}
                       </Button>
                     ))}
                  </div>
                  <div className="relative group flex-[1.5]">
                     <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-primary transition-colors" />
                     <Input 
                        placeholder="Buscar reserva por nome, código ou celular..." 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                        className="h-20 pl-16 rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-white font-bold text-lg placeholder:text-slate-200 focus:ring-4 focus:ring-primary/5 transition-all w-full" 
                     />
                  </div>
               </div>

               <div className="flex justify-end gap-3 px-4">
                  <Button onClick={clearTestOrders} variant="ghost" className="h-12 px-6 text-red-500 hover:bg-red-50 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 rounded-2xl border border-red-100/50">
                     <Trash2 className="w-4 h-4" /> ZERAR FILA DE TESTES (R$ 0,00)
                  </Button>
               </div>

               <div className="bg-white rounded-[3.5rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100/50 overflow-hidden">
                  <BookingTable bookings={filtered} onStatusChange={handleStatusChange} onAddNote={handleAddNote} onReschedule={handleReschedule} onDelete={handleDelete} onRemoveItem={handleRemoveItem} updatingId={updatingId} />
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
