import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, UserCheck } from 'lucide-react';
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
import { CheckCircle2, Circle, Eye, Copy, MessageCircle } from 'lucide-react';
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
      // First try to fetch from 'orders' (the new unified source of truth)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Orders fetch failed, trying legacy bookings:', error);
        // Fallback to legacy 'bookings' if 'orders' unification hasn't happened yet
        const { data: legacyData, error: legacyError } = await supabase
          .from('bookings' as any)
          .select('*')
          .order('visit_date', { ascending: true });
        
        if (legacyError) throw legacyError;
        setBookings(legacyData || []);
      } else {
        // Map 'orders' format back to what the UI expects for 'bookings'
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
    // Real-time subscription for orders
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          console.log('Real-time update detected, refetching...');
          fetchBookings();
          fetchOrders();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(() => {
        fetchBookings();
        fetchOrders();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchBookings, fetchOrders]);

  // Load bookings on mount + subscribe to realtime
  useEffect(() => {
    if (!token) return;
    fetchBookings();
    fetchOrders();

    const bookingChannel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings(); // Both tables update the same view now
        fetchOrders();
      })
      .subscribe();

    const orderChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchBookings(); // Both tables update the same view now
        fetchOrders();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [token, fetchBookings, fetchOrders]);

  const handleStatusChange = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      if (isOrder) {
         // Direct update for orders
         const { error } = await supabase.from('orders').update({ 
           status: status === 'confirmed' ? 'paid' : status,
           updated_at: new Date().toISOString()
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

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status, ...(status === 'checked-in' ? { checked_in_at: new Date().toISOString() } : {}) } : b))
      );

      const statusLabels: Record<string, string> = { confirmed: 'Confirmada', 'checked-in': 'Check-in realizado', cancelled: 'Cancelada', pending: 'Pendente' };
      toast({ title: `✅ ${statusLabels[status] || 'Atualizado'}` });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
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
        const childrenCount = Array.isArray(b.children) ? b.children.length : (b.children || 0);
        return sum + (b.adults || 0) + (typeof childrenCount === 'number' ? childrenCount : 0);
      }, 0),
      todayRevenue: confirmedOrChecked.reduce((sum, b) => sum + Number(b.total_amount), 0),
      checkedIn: todayBookings.filter((b) => b.status === 'checked-in').length,
      confirmed: todayBookings.filter((b) => b.status === 'confirmed' || b.status === 'paid').length,
      pending: todayBookings.filter((b) => b.status === 'pending').length,
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

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      await markOrderAsPaid(orderId);
      toast({ title: '✅ Pedido pago e Voucher gerado!' });
      fetchOrders();
      fetchBookings();
    } catch {
      toast({ title: 'Erro ao processar pagamento', variant: 'destructive' });
    }
  };

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
    <div className="min-h-screen bg-muted font-sans">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div>
          <h1 className="font-display font-bold text-lg">Painel Lessa Reservas</h1>
          <p className="text-primary-foreground/70 text-xs font-medium">Controle de Acesso & Vendas</p>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={() => { fetchBookings(); fetchOrders(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Tab Selector */}
        <div className="flex bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl gap-2 shadow-sm border border-white">
          <Button 
            className={`flex-1 rounded-xl font-bold transition-all ${activeTab === 'reservas' ? 'shadow-md scale-[1.02]' : ''}`} 
            variant={activeTab === 'reservas' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('reservas')}
          >
            <CalendarCheck className="w-4 h-4 mr-2" />
            Agenda de Visitas
          </Button>
          <Button 
            className={`flex-1 rounded-xl font-bold transition-all ${activeTab === 'pedidos' ? 'shadow-md scale-[1.02]' : ''}`} 
            variant={activeTab === 'pedidos' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('pedidos')}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Vendas Diretas
          </Button>
        </div>

        {activeTab === 'reservas' ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                    <Users className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stats.todayPeople}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pessoas Hoje</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-whatsapp/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-whatsapp">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stats.checkedIn}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Check-ins</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black text-foreground">{stats.todayCount}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Agendamentos</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white/80">
                <CardContent className="p-4 text-center">
                  <div className="bg-sun/10 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 text-sun-dark">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-black text-foreground">{formatCurrency(stats.todayRevenue)}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Receita</p>
                </CardContent>
              </Card>
            </div>

            {/* Date filter */}
            <div className="flex gap-2">
              {DATE_FILTERS.map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={activeTab === 'reservas' && (dateFilter as any) === f.key ? 'default' : 'outline'}
                  onClick={() => setDateFilter(f.key as any)}
                  className="flex-1"
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {filtered.length} reserva(s) encontrada(s)
            </p>

            <BookingTable
              bookings={filtered}
              onStatusChange={handleStatusChange}
              onAddNote={handleAddNote}
              updatingId={updatingId}
            />
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold">Vendas & Vouchers</h2>
                <p className="text-xs text-muted-foreground">Total de {orders.length} pedidos registrados</p>
              </div>
              <Button size="icon" variant="ghost" onClick={fetchOrders} disabled={loadingOrders}>
                <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido por nome, código ou ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="animate-spin mb-4" />
                <p>Carregando vendas...</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8">Nenhum pedido encontrado.</p>
                ) : (
                  filteredOrders.map(order => (
                    <Dialog key={order.id}>
                      <DialogTrigger asChild>
                        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-2 border-transparent">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-muted-foreground">Pedido #{order.id.slice(0, 8)}</span>
                              <span className="text-sm font-bold truncate max-w-[150px]">{order.customer_name || 'Cliente'}</span>
                              <span className="text-xs text-muted-foreground">{order.created_at ? format(new Date(order.created_at), 'dd/MM/yy HH:mm') : '00/00/00'}</span>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className="text-lg font-black text-primary">{formatCurrency(order.total_amount)}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                order.status === 'paid' ? 'bg-whatsapp/20 text-whatsapp' : 'bg-sun/20 text-sun'
                              }`}>
                                {order.status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex justify-between items-center">
                            <span>Detalhes do Pedido</span>
                            <span className="text-xs font-mono text-muted-foreground">#{order.id.slice(0, 8)}</span>
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          <div className="flex justify-between border-b pb-4">
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase">Cliente</p>
                              <p className="font-bold text-lg">{order.customer_name || 'Desconhecido'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-muted-foreground uppercase">Data</p>
                              <p className="font-medium">{order.created_at ? format(new Date(order.created_at), "dd 'de' MMMM", { locale: ptBR }) : '-'}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Itens Comprados</p>
                            <div className="bg-muted/30 rounded-2xl p-4 space-y-4 border border-muted">
                              {order.order_items?.map((item: any, idx: number) => (
                                <div key={idx} className={item.is_redeemed ? "opacity-60 flex justify-between" : "flex justify-between"}>
                                  <div>
                                    <p className="font-bold text-sm">{item.quantity}x {item.product_id}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatCurrency(item.unit_price)} unit.</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                                    <Button
                                      size="sm"
                                      variant={item.is_redeemed ? "ghost" : "outline"}
                                      className="h-8 w-8 p-0"
                                      onClick={async () => {
                                        const { error } = await supabase.from('order_items').update({ is_redeemed: !item.is_redeemed, redeemed_at: !item.is_redeemed ? new Date().toISOString() : null }).eq('id', item.id);
                                        if (!error) fetchOrders();
                                      }}
                                    >
                                      <CheckCircle2 className={cn("h-4 w-4", item.is_redeemed ? "text-green-600" : "text-muted-foreground")} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 border-t flex justify-between items-center font-black">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                              </div>
                            </div>
                          </div>

                          {order.vouchers?.[0] ? (
                            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-bold uppercase text-muted-foreground">Código Voucher</p>
                                  <p className="text-2xl font-black text-primary">{order.vouchers[0].code}</p>
                                </div>
                                {order.vouchers[0].qr_code_url && <img src={order.vouchers[0].qr_code_url} className="w-16 h-16 bg-white p-1 rounded-lg" />}
                              </div>
                              <Button 
                                className="w-full h-12 bg-primary text-white font-bold rounded-xl"
                                onClick={async () => {
                                  const itemIds = order.order_items?.map((i: any) => i.id) || [];
                                  await supabase.from('order_items').update({ is_redeemed: true, redeemed_at: new Date().toISOString() }).in('id', itemIds);
                                  if (order.vouchers?.[0]) await redeemVoucher(order.vouchers[0].id);
                                  fetchOrders();
                                }}
                              >
                                MARCAR TUDO COMO USADO
                              </Button>
                            </div>
                          ) : order.status === 'paid' ? (
                             <p className="text-center text-xs text-muted-foreground">Gerando voucher...</p>
                          ) : (
                            <div className="p-4 text-center bg-sun/10 rounded-xl">
                              <p className="text-sun-dark font-bold mb-2">Aguardando Pagamento</p>
                              <Button size="sm" onClick={() => handleMarkAsPaid(order.id)} className="bg-sun text-foreground font-bold w-full">Confirmar Manualmente</Button>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
