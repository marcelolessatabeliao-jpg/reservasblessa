import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, UserCheck, Hash, ArrowRight, MessageCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BookingTable } from '@/components/admin/BookingTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/booking-types';

import { getAdminOrders, markOrderAsPaid, redeemVoucher } from '@/integrations/supabase/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle2, Circle, Eye, Copy } from 'lucide-react';
import { cn } from "@/lib/utils";

type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';
type TabType = 'reservas' | 'pedidos';

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
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: legacyData, error: legacyError } = await supabase
          .from('bookings' as any)
          .select('*')
          .order('visit_date', { ascending: true });
        
        if (legacyError) throw legacyError;
        setBookings(legacyData || []);
      } else {
        const mapped = data?.map(o => {
          const items = o.order_items || [];
          return {
            id: o.id,
            name: o.customer_name,
            phone: o.customer_phone,
            visit_date: o.visit_date,
            status: o.status === 'paid' ? 'confirmed' : o.status,
            total_amount: o.total_amount,
            confirmation_code: o.confirmation_code,
            created_at: o.created_at,
            is_order: true,
            order_items: items,
            adults: items.filter((i: any) => i.product_id?.includes('Adulto') || i.product_id?.includes('Professor') || i.product_id?.includes('Estudante') || i.product_id?.includes('Servidor') || i.product_id?.includes('Vitalício') || i.product_id?.includes('Inclusão')).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0,
            children: items.filter((i: any) => i.product_id?.includes('Criança') || i.product_id?.includes('Kids')).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0,
            kiosks: items.filter((i: any) => i.product_id?.includes('Quiosque')).map((i: any) => ({ type: i.product_id?.toLowerCase().includes('maior') ? 'maior' : 'menor', quantity: i.quantity || 0 })),
            quads: items.filter((i: any) => i.product_id?.includes('Quad')).map((i: any) => ({ type: i.product_id?.toLowerCase().includes('individual') ? 'individual' : i.product_id?.toLowerCase().includes('dupla') ? 'dupla' : 'adulto-crianca', quantity: i.quantity || 0 })),
            additionals: items.filter((i: any) => i.product_id?.includes('Pesca') || i.product_id?.includes('Futebol')).map((i: any) => ({ type: i.product_id?.toLowerCase().includes('pesca') ? 'pesca' : 'futebol-sabao', quantity: i.quantity || 0 }))
          };
        });
        setBookings(mapped || []);
      }
    } catch (err: any) {
      console.error('Admin fetch error:', err);
      toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchBookings();
        fetchOrders();
      })
      .subscribe();

    const orderItemsChannel = supabase
      .channel('admin-order-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchBookings();
        fetchOrders();
      })
      .subscribe();

    const interval = setInterval(() => {
        fetchBookings();
        fetchOrders();
    }, 45000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(orderItemsChannel);
      clearInterval(interval);
    };
  }, [fetchBookings, fetchOrders]);

  useEffect(() => {
    if (!token) return;
    fetchBookings();
    fetchOrders();
  }, [token, fetchBookings, fetchOrders]);

  const handleStatusChange = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         const { error } = await supabase.from('orders').update({ 
           status: status === 'confirmed' ? 'paid' : status
         }).eq('id', bookingId);
         if (error) throw error;
      } else {
        const { data, error } = await supabase.functions.invoke('update-booking-status', {
          body: { bookingId, status, adminToken: token },
        });

        if (error || !data?.success) {
          if (data?.error === 'Token inválido' || data?.error === 'Não autorizado') {
            localStorage.removeItem('admin_token');
            setToken(null);
            return;
          }
          throw new Error(data?.error || 'Erro');
        }
      }

      const statusLabels: Record<string, string> = { confirmed: 'Confirmada', 'checked-in': 'Check-in realizado', cancelled: 'Cancelada', pending: 'Pendente' };
      toast({ title: `✅ ${statusLabels[status] || 'Atualizado'}` });
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReschedule = async (bookingId: string, newDate: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
        await supabase.from('orders').update({ visit_date: newDate }).eq('id', bookingId);
      } else {
        const { error } = await supabase.from('bookings').update({ visit_date: newDate }).eq('id', bookingId);
        if (error) throw error;
      }
      toast({ title: '📅 Reserva Reagendada!' });
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Erro ao reagendar', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddNote = async (bookingId: string, notes: string, isOrder?: boolean) => {
    try {
      if (isOrder) {
        await supabase.from('orders').update({ notes }).eq('id', bookingId);
      } else {
        const { error } = await supabase.functions.invoke('update-booking-status', {
          body: { bookingId, notes, adminToken: token },
        });
        if (error) throw error;
      }
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, notes } : b));
    } catch {
      toast({ title: 'Erro ao salvar observação', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  const [validationValue, setValidationValue] = useState('');
  
  const handleValidateVoucher = () => {
    if (!validationValue.trim()) return;
    const code = validationValue.trim().toUpperCase();
    const found = bookings.find(b => b.confirmation_code?.toUpperCase() === code);
    
    if (found) {
      setSearch(code);
      setActiveTab('reservas');
      window.scrollTo({ top: 300, behavior: 'smooth' });
      toast({ title: "Reserva Encontrada!", description: `Cliente: ${found.name}` });
    } else {
      toast({ title: "Voucher não encontrado", description: "Verifique o código ou tente novamente.", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    let result = bookings;
    if (dateFilter === 'today') {
      result = result.filter((b) => b.visit_date && isToday(parseISO(b.visit_date)));
    } else if (dateFilter === 'tomorrow') {
      result = result.filter((b) => b.visit_date && isTomorrow(parseISO(b.visit_date)));
    } else if (dateFilter === 'week') {
      result = result.filter((b) => b.visit_date && isThisWeek(parseISO(b.visit_date), { locale: ptBR }));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.confirmation_code && b.confirmation_code.toLowerCase().includes(q)) ||
        (b.phone && b.phone.includes(q))
      );
    }
    return result;
  }, [bookings, dateFilter, search]);

  const stats = useMemo(() => {
    const todayBookings = bookings.filter((b) => b.visit_date && isToday(parseISO(b.visit_date)));
    const confirmedOrChecked = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in' || b.status === 'paid');
    return {
      todayCount: todayBookings.length,
      todayPeople: todayBookings.reduce((sum, b) => {
        const childrenCount = typeof b.children === 'number' ? b.children : (Array.isArray(b.children) ? b.children.length : 0);
        return sum + (b.adults || 0) + childrenCount;
      }, 0),
      todayRevenue: confirmedOrChecked.reduce((sum, b) => sum + Number(b.total_amount), 0),
      checkedIn: todayBookings.filter((b) => b.status === 'checked-in').length,
    };
  }, [bookings]);

  if (!token) {
    return <AdminLogin onLogin={(t) => setToken(t)} />;
  }

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: 'tomorrow', label: 'Amanhã' },
    { key: 'week', label: 'Semana' },
    { key: 'all', label: 'Todas' },
  ];

  const filteredOrders = orders.filter(order => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (order.customer_name || '').toLowerCase().includes(q) ||
      (order.id || '').toLowerCase().includes(q) ||
      (order.confirmation_code || '').toLowerCase().includes(q) ||
      (order.customer_phone || '').includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#f1f5f9] font-sans pb-20">
      <div className="bg-primary text-primary-foreground px-4 py-4 md:py-6 sticky top-0 z-50 shadow-2xl border-b-4 border-sun/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20 hidden sm:block">
                <CalendarCheck className="w-6 h-6 text-sun" />
             </div>
             <div>
               <h1 className="font-display font-black text-xl md:text-2xl leading-none tracking-tight">Balneário Lessa</h1>
               <p className="text-primary-foreground/60 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] mt-1">Management Portal v2.0</p>
             </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:flex bg-white/10 rounded-full px-4 py-1.5 items-center gap-2 border border-white/10">
               <div className="w-2 h-2 bg-sun animate-pulse rounded-full" />
               <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/80">Live Server</span>
            </div>
            <div className="flex gap-1 md:gap-2">
              <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={() => { fetchBookings(); fetchOrders(); }} disabled={loading}>
                <RefreshCw className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={handleLogout}>
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border-4 border-primary/5 flex flex-col md:flex-row items-center gap-4">
           <div className="flex-1 space-y-1 w-full text-center md:text-left">
              <h3 className="text-lg font-black text-primary uppercase tracking-tight">Validação de Entrada</h3>
              <p className="text-xs text-muted-foreground font-medium">Digite o código ou escaneie o voucher do cliente.</p>
           </div>
           <div className="flex w-full md:w-auto gap-2">
              <div className="relative flex-1 md:w-64">
                 <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                 <Input 
                   placeholder="Código (Ex: E31357)" 
                   className="pl-9 h-14 rounded-2xl border-2 border-primary/10 focus:border-primary font-mono font-bold text-lg uppercase"
                   value={validationValue}
                   onChange={(e) => setValidationValue(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleValidateVoucher()}
                 />
              </div>
              <Button onClick={handleValidateVoucher} className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary-dark text-white font-black shadow-lg shadow-primary/20 flex gap-2">
                VALIDAR <ArrowRight className="w-5 h-5" />
              </Button>
           </div>
        </div>

        <div className="flex bg-white/60 backdrop-blur-md p-2 rounded-[2rem] gap-2 shadow-inner border border-white">
          <Button className={`flex-1 rounded-xl font-bold transition-all ${activeTab === 'reservas' ? 'shadow-md scale-[1.02]' : ''}`} variant={activeTab === 'reservas' ? 'default' : 'ghost'} onClick={() => setActiveTab('reservas')}>
            <CalendarCheck className="w-4 h-4 mr-2" /> Agenda de Visitas
          </Button>
          <Button className={`flex-1 rounded-xl font-bold transition-all ${activeTab === 'pedidos' ? 'shadow-md scale-[1.02]' : ''}`} variant={activeTab === 'pedidos' ? 'default' : 'ghost'} onClick={() => setActiveTab('pedidos')}>
            <DollarSign className="w-4 h-4 mr-2" /> Vendas Diretas
          </Button>
        </div>

        {activeTab === 'reservas' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-primary"><Users className="w-4 h-4" /></div>
                  <p className="text-2xl font-black text-foreground">{stats.todayPeople}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pessoas Hoje</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-whatsapp/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-whatsapp"><UserCheck className="w-4 h-4" /></div>
                  <p className="text-2xl font-black text-foreground">{stats.checkedIn}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Check-ins</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-primary"><CalendarCheck className="w-4 h-4" /></div>
                  <p className="text-2xl font-black text-foreground">{stats.todayCount}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agendamentos</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-sun/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sun-dark"><TrendingUp className="w-4 h-4" /></div>
                  <p className="text-xl font-black text-foreground">{formatCurrency(stats.todayRevenue)}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Receita</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2">
              {DATE_FILTERS.map((f) => (
                <Button key={f.key} size="sm" variant={dateFilter === f.key ? 'default' : 'outline'} onClick={() => setDateFilter(f.key)} className="flex-1">{f.label}</Button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, código ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            <p className="text-sm text-muted-foreground">{filtered.length} reserva(s) encontrada(s)</p>

            <BookingTable
              bookings={filtered}
              onStatusChange={handleStatusChange}
              onAddNote={handleAddNote}
              onReschedule={handleReschedule}
              updatingId={updatingId}
            />
          </>
        ) : (
          /* Pedidos Tab */
          <div className="space-y-4">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar pedido por nome, código ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {loadingOrders ? <div className="p-12 text-center text-muted-foreground">Carregando...</div> : (
              <div className="grid gap-3">
                {filteredOrders.map(order => (
                  <Dialog key={order.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted-foreground">#{order.id.slice(0, 8)}</span>
                            <span className="text-sm font-bold">{order.customer_name || 'Cliente'}</span>
                            <span className="text-xs text-muted-foreground">{order.created_at ? format(new Date(order.created_at), 'dd/MM/yy HH:mm') : ''}</span>
                          </div>
                          <div className="text-right">
                             <div className="text-lg font-black text-primary">{formatCurrency(order.total_amount)}</div>
                             <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase", order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                                {order.status === 'paid' ? 'Pago' : 'Pendente'}
                             </span>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent>
                       <DialogHeader><DialogTitle>Detalhes do Pedido</DialogTitle></DialogHeader>
                       <div className="space-y-4 pt-4">
                          <div className="bg-muted/50 p-4 rounded-2xl">
                             <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Itens</p>
                             {order.order_items?.map((item: any, id: number) => (
                               <div key={id} className="flex justify-between items-center py-2 border-b last:border-0 border-black/5">
                                  <span className="text-sm font-bold">{item.quantity}x {item.product_id}</span>
                                  <span className="font-black text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                               </div>
                             ))}
                             <div className="mt-3 flex justify-between font-black text-lg"><span>Total</span><span>{formatCurrency(order.total_amount)}</span></div>
                          </div>
                          
                          {order.status !== 'paid' && (
                             <Button className="w-full bg-sun text-white font-bold" onClick={() => markOrderAsPaid(order.id).then(() => { fetchOrders(); fetchBookings(); toast({title: "Pago!"}); })}>
                                Confirmar Pagamento Manual
                             </Button>
                          )}
                       </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
