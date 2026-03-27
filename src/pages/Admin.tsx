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

type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';
type TabType = 'reservas' | 'pedidos' | 'inventario';

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

  // Inventory logic
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
      
      // 1. Fetch Orders (Master) - Limited to 100 to stay fast and avoid query limits
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (ordersError) throw ordersError;

      // 2. Fetch Order Items for THESE orders only
      const orderIds = (ordersData || []).map(o => o.id);
      let itemsData: any[] = [];
      
      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        
        if (!itemsError) itemsData = items || [];
      }

      const itemsMap = itemsData.reduce((acc: any, item: any) => {
        if (!acc[item.order_id]) acc[item.order_id] = [];
        acc[item.order_id].push(item);
        return acc;
      }, {});

      // 3. Fetch Legacy Bookings
      const { data: legacyData } = await supabase
        .from('bookings' as any)
        .select('*')
        .order('visit_date', { ascending: true });

      const mappedOrders = (ordersData || []).map(o => {
        const items = itemsMap[o.id] || [];
        
        // Items that are NOT kiosks, quads or additions are likely people (entries)
        const entries = items.filter((i: any) => {
          const pid = i.product_id?.toLowerCase() || '';
          return !pid.includes('quiosque') && !pid.includes('quad') && !pid.includes('pesca') && !pid.includes('futebol');
        });
        
        const adultItems = entries.filter((i: any) => !i.product_id?.toLowerCase().includes('criança') && !i.product_id?.toLowerCase().includes('kids'));
        const childItems = entries.filter((i: any) => i.product_id?.toLowerCase().includes('criança') || i.product_id?.toLowerCase().includes('kids'));

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
          order_items: items,
          adults: adultItems.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || 0,
          children: childItems.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || 0,
          kiosks: items.filter((i: any) => i.product_id?.includes('Quiosque')).map((i: any) => ({ 
            type: i.product_id?.toLowerCase().includes('maior') ? 'maior' : 'menor', 
            quantity: i.quantity || 0 
          })),
          quads: items.filter((i: any) => i.product_id?.includes('Quad')).map((i: any) => ({ 
            type: i.product_id?.toLowerCase().includes('individual') ? 'individual' : i.product_id?.toLowerCase().includes('dupla') ? 'dupla' : 'adulto-crianca', 
            quantity: i.quantity || 0 
          }))
        };
      });

      const mappedLegacy = (legacyData || []).map(b => {
        // Create virtual items for legacy records so they aren't empty in Detail view
        const virtualItems: any[] = [];
        if (b.adults > 0) virtualItems.push({ id: `v-${b.id}-a`, product_id: 'Adulto (Legado)', quantity: b.adults, is_redeemed: b.status === 'checked-in' });
        if (Array.isArray(b.children) && b.children.length > 0) {
            virtualItems.push({ id: `v-${b.id}-c`, product_id: 'Criança (Legado)', quantity: b.children.length, is_redeemed: b.status === 'checked-in' });
        }

        return {
          ...b,
          is_order: false,
          adults: b.adults || 0,
          children: Array.isArray(b.children) ? b.children.length : 0,
          total_amount: Number(b.total_amount),
          status: b.status === 'confirmed' || b.status === 'paid' ? 'confirmed' : (b.status || 'pending'),
          order_items: virtualItems
        };
      });

      // Combined and sorted by sequence: confirmed/pending first, then visit date
      setBookings([...mappedOrders, ...mappedLegacy].sort((a, b) => {
          const dateA = new Date(a.visit_date).getTime();
          const dateB = new Date(b.visit_date).getTime();
          return dateA - dateB;
      }));
      
    } catch (err: any) {
      console.error('Admin sync error:', err);
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchInventory]);

  useEffect(() => {
    if (!token) return;
    fetchBookings();
    fetchOrders();

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchBookings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchBookings())
      .subscribe();

    const interval = setInterval(() => fetchBookings(), 60000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [token, fetchBookings, fetchOrders]);

  const handleStatusChange = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         await supabase.from('orders').update({ status: status === 'confirmed' ? 'paid' : status }).eq('id', bookingId);
         if (status === 'cancelled') {
           await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId);
           await supabase.from('quad_reservations').delete().eq('order_id', bookingId);
         }
      } else {
        await supabase.functions.invoke('update-booking-status', { body: { bookingId, status, adminToken: token } });
      }
      toast({ title: `✓ Atualizado` });
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setUpdatingId(null); }
  };

  const handleReschedule = async (bookingId: string, newDate: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
        await supabase.from('orders').update({ visit_date: newDate }).eq('id', bookingId);
        await supabase.from('kiosk_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId);
        await supabase.from('quad_reservations').update({ reservation_date: newDate }).eq('order_id', bookingId);
      }
      else await supabase.from('bookings').update({ visit_date: newDate }).eq('id', bookingId);
      toast({ title: '📅 Reagendado!' });
      fetchBookings();
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleDelete = async (bookingId: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
        // Cascade delete all related data
        await supabase.from('order_items').delete().eq('order_id', bookingId);
        await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId);
        await supabase.from('quad_reservations').delete().eq('order_id', bookingId);
        await supabase.from('orders').delete().eq('id', bookingId);
      } else {
        await supabase.from('bookings').delete().eq('id', bookingId);
      }
      
      // Update local state immediately for instant feedback
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      
      toast({ title: '🗑️ Registro excluído permanentemente.' });
      fetchBookings(); // Still fetch to be sure and refresh stats
    } catch (err: any) {
      console.error('CRITICAL: Delete failed!', err);
      toast({ 
        title: 'Erro ao excluir', 
        description: `Não foi possível remover do banco de dados: ${err.message}`, 
        variant: 'destructive' 
      });
      fetchBookings(); // Refresh to restore local state if delete failed
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddNote = async (bookingId: string, notes: string, isOrder?: boolean) => {
    try {
      if (isOrder) await supabase.from('orders').update({ notes }).eq('id', bookingId);
      else await supabase.functions.invoke('update-booking-status', { body: { bookingId, notes, adminToken: token } });
      fetchBookings();
    } catch { toast({ title: 'Erro ao salvar', variant: 'destructive' }); }
  };

  const [validationValue, setValidationValue] = useState('');
  const handleValidateVoucher = () => {
    if (!validationValue.trim()) return;
    const code = validationValue.trim().toUpperCase();
    const found = bookings.find(b => b.confirmation_code?.toUpperCase() === code);
    if (found) { setSearch(code); setActiveTab('reservas'); toast({ title: "Encontrado!" }); }
    else { toast({ title: "Não encontrado", variant: "destructive" }); }
  };

  const filtered = useMemo(() => {
    let result = bookings;
    if (dateFilter === 'today') result = result.filter(b => b.visit_date && isToday(parseISO(b.visit_date)));
    else if (dateFilter === 'tomorrow') result = result.filter(b => b.visit_date && isTomorrow(parseISO(b.visit_date)));
    else if (dateFilter === 'week') result = result.filter(b => b.visit_date && isThisWeek(parseISO(b.visit_date), { locale: ptBR }));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(b => (b.name || '').toLowerCase().includes(q) || (b.confirmation_code && b.confirmation_code.toLowerCase().includes(q)) || (b.phone && b.phone.includes(q)));
    }
    return result;
  }, [bookings, dateFilter, search]);

  const stats = useMemo(() => {
    const todayBookings = bookings.filter(b => b.visit_date && isToday(parseISO(b.visit_date)));
    const confirmed = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'paid' || b.status === 'checked-in');
    return {
      people: todayBookings.reduce((sum, b) => sum + (b.adults || 0) + (typeof b.children === 'number' ? b.children : (b.children?.length || 0)), 0),
      revenue: confirmed.reduce((sum, b) => sum + Number(b.total_amount), 0),
      count: todayBookings.length,
      checked: todayBookings.filter(b => b.status === 'checked-in').length
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

  if (!token) return <AdminLogin onLogin={(t) => setToken(t)} />;

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans pb-20">
      <div className="bg-primary text-primary-foreground p-4 md:p-6 sticky top-0 z-50 shadow-xl border-b-4 border-sun/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <CalendarCheck className="w-6 h-6 text-sun hidden sm:block" />
             <div><h1 className="font-display font-black text-xl md:text-2xl leading-none">Balneário Lessa</h1><p className="text-primary-foreground/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Management Portal v2.0</p></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={async () => {
              if (confirm('Limpar todos os dados de teste?')) {
                await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('bookings' as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('vouchers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('quad_reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabase.from('kiosk_reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                alert('Dashboard limpa!');
                fetchBookings(); 
                fetchOrders();
              }
            }}>LIMPAR TESTES</Button>
            <Button size="icon" variant="ghost" onClick={fetchBookings} disabled={loading}><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></Button>
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

        <div className="flex bg-white/60 backdrop-blur-md p-2 rounded-[2rem] gap-2 shadow-inner border border-white">
          <Button className="flex-1 rounded-xl font-bold" variant={activeTab === 'reservas' ? 'default' : 'ghost'} onClick={() => setActiveTab('reservas')}><CalendarCheck className="w-4 h-4 mr-2" /> Agenda</Button>
          <Button className="flex-1 rounded-xl font-bold" variant={activeTab === 'pedidos' ? 'default' : 'ghost'} onClick={() => setActiveTab('pedidos')}><DollarSign className="w-4 h-4 mr-2" /> Vendas</Button>
          <Button className="flex-1 rounded-xl font-bold" variant={activeTab === 'inventario' ? 'default' : 'ghost'} onClick={() => setActiveTab('inventario')}><TrendingUp className="w-4 h-4 mr-2" /> Inventário</Button>
        </div>

        {activeTab === 'inventario' ? inventoryView : activeTab === 'pedidos' ? (
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
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card><CardContent className="p-4 text-center"><Users className="w-5 h-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-black">{stats.people}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">Pessoas Hoje</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><UserCheck className="w-5 h-5 mx-auto mb-1 text-whatsapp" /><p className="text-2xl font-black">{stats.checked}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">Check-ins</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><CalendarCheck className="w-5 h-5 mx-auto mb-1 text-primary" /><p className="text-2xl font-black">{stats.count}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">Agendamentos</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><TrendingUp className="w-5 h-5 mx-auto mb-1 text-sun-dark" /><p className="text-lg font-black">{formatCurrency(stats.revenue)}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">Receita</p></CardContent></Card>
            </div>
            <div className="flex gap-2">
              {[
                { key: 'today', label: 'HOJE' },
                { key: 'tomorrow', label: 'AMANHÃ' },
                { key: 'week', label: 'SEMANA' },
                { key: 'all', label: 'TODAS' }
              ].map(f => (
                <Button key={f.key} size="sm" variant={dateFilter === f.key ? 'default' : 'outline'} onClick={() => setDateFilter(f.key as any)} className="flex-1 uppercase text-[10px] font-black">{f.label}</Button>
              ))}
            </div>
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Buscar reservas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <BookingTable bookings={filtered} onStatusChange={handleStatusChange} onAddNote={handleAddNote} onReschedule={handleReschedule} onDelete={handleDelete} updatingId={updatingId} />
          </div>
        )}
      </div>
    </div>
  );
}
