import { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
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
        .from('bookings')
        .select('*')
        .order('visit_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch {
      toast({ title: 'Erro ao carregar reservas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load bookings on mount + subscribe to realtime
  useEffect(() => {
    if (!token) return;
    fetchBookings();
    fetchOrders();

    const bookingChannel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    const orderChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [token, fetchBookings, fetchOrders]);

  const handleStatusChange = async (bookingId: string, status: string) => {
    setUpdatingId(bookingId);
    try {
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

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status, ...(status === 'checked-in' ? { checked_in_at: new Date().toISOString() } : {}) } : b))
      );

      const statusLabels: Record<string, string> = { confirmed: 'Confirmada', 'checked-in': 'Check-in realizado', cancelled: 'Cancelada', pending: 'Pendente' };
      toast({ title: `✅ ${statusLabels[status] || 'Atualizado'}` });
    } catch {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddNote = async (bookingId: string, notes: string) => {
    try {
      const { error } = await supabase.functions.invoke('update-booking-status', {
        body: { bookingId, notes, adminToken: token },
      });
      if (error) throw error;
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
      result = result.filter((b) => isToday(parseISO(b.visit_date)));
    } else if (dateFilter === 'tomorrow') {
      result = result.filter((b) => isTomorrow(parseISO(b.visit_date)));
    } else if (dateFilter === 'week') {
      result = result.filter((b) => isThisWeek(parseISO(b.visit_date), { locale: ptBR }));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        (b.confirmation_code && b.confirmation_code.toLowerCase().includes(q)) ||
        (b.phone && b.phone.includes(q))
      );
    }
    return result;
  }, [bookings, dateFilter, search]);

  const stats = useMemo(() => {
    const todayBookings = bookings.filter((b) => isToday(parseISO(b.visit_date)));
    const confirmedOrChecked = todayBookings.filter(b => b.status === 'confirmed' || b.status === 'checked-in');
    return {
      todayCount: todayBookings.length,
      todayPeople: todayBookings.reduce((sum, b) => {
        const childrenCount = Array.isArray(b.children) ? b.children.length : 0;
        return sum + b.adults + childrenCount;
      }, 0),
      todayRevenue: confirmedOrChecked.reduce((sum, b) => sum + Number(b.total_amount), 0),
      checkedIn: todayBookings.filter((b) => b.status === 'checked-in').length,
      confirmed: todayBookings.filter((b) => b.status === 'confirmed').length,
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
    } catch {
      toast({ title: 'Erro ao processar pagamento', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div>
          <h1 className="font-display font-bold text-lg">Painel de Reservas</h1>
          <p className="text-primary-foreground/70 text-xs">Balneário Lessa</p>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={fetchBookings} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/20" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex bg-white/50 p-1 rounded-xl gap-1">
          <Button 
            className="flex-1" 
            variant={activeTab === 'reservas' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('reservas')}
          >
            Reservas
          </Button>
          <Button 
            className="flex-1" 
            variant={activeTab === 'pedidos' ? 'default' : 'ghost'} 
            onClick={() => setActiveTab('pedidos')}
          >
            Pedidos & Vouchers
          </Button>
        </div>

        {activeTab === 'reservas' ? (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Users className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold text-foreground">{stats.todayPeople}</p>
                  <p className="text-xs text-muted-foreground">Pessoas hoje</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <UserCheck className="w-5 h-5 mx-auto text-whatsapp mb-1" />
                  <p className="text-2xl font-bold text-foreground">{stats.checkedIn}<span className="text-sm text-muted-foreground">/{stats.todayCount}</span></p>
                  <p className="text-xs text-muted-foreground">Check-ins</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <CalendarCheck className="w-5 h-5 mx-auto text-sun mb-1" />
                  <p className="text-2xl font-bold text-foreground">{stats.confirmed}</p>
                  <p className="text-xs text-muted-foreground">Confirmadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="text-lg font-bold text-foreground">{formatCurrency(stats.todayRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Receita hoje</p>
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

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              {filtered.length} reserva(s) encontrada(s)
            </p>

            {/* Booking list */}
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
              <h2 className="text-xl font-bold">Vendas & Vouchers</h2>
              <Button size="icon" variant="ghost" onClick={fetchOrders} disabled={loadingOrders}>
                <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {loadingOrders ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="animate-spin mb-4" />
                <p>Carregando vendas...</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8">Nenhum pedido encontrado.</p>
                ) : (
                  orders.map(order => (
                    <Dialog key={order.id}>
                      <DialogTrigger asChild>
                        <Card className="cursor-pointer hover:border-primary/50 transition-colors border-2 border-transparent">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-muted-foreground">Pedido #{order.id.slice(0, 8)}</span>
                              <span className="text-sm font-bold truncate max-w-[150px]">{order.customer_name || 'Cliente'}</span>
                              <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd/MM/yy HH:mm')}</span>
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
                              <p className="font-medium">{format(new Date(order.created_at), "dd 'de' MMMM", { locale: ptBR })}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Itens Comprados</p>
                            <div className="bg-muted/30 rounded-2xl p-4 space-y-3 border border-muted">
                              {order.order_items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-xl border font-bold text-primary">
                                      {item.quantity}x
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm leading-tight">{item.product_id}</p>
                                      <p className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)} unid.</p>
                                    </div>
                                  </div>
                                  <p className="font-black">{formatCurrency(item.unit_price * item.quantity)}</p>
                                </div>
                              ))}
                              <div className="pt-3 border-t flex justify-between items-center">
                                <span className="font-bold">Total</span>
                                <span className="text-xl font-black text-primary">{formatCurrency(order.total_amount)}</span>
                              </div>
                            </div>
                          </div>

                          {order.vouchers && order.vouchers.length > 0 ? (
                            <div className="bg-primary/5 rounded-2xl p-5 border-2 border-primary/10 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase">Voucher de Acesso</p>
                                  <p className="text-3xl font-mono font-black tracking-widest text-primary">{order.vouchers[0].code}</p>
                                </div>
                                {order.vouchers[0].qr_code_url && (
                                  <img src={order.vouchers[0].qr_code_url} alt="QR" className="w-20 h-20 bg-white p-2 rounded-xl shadow-sm" />
                                )}
                              </div>
                              
                              <div className="flex gap-2 mb-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 font-bold gap-2"
                                  onClick={() => {
                                    const itemsList = order.order_items?.map((item: any) => `- ${item.quantity}x ${item.product_id}`).join('\n') || '';
                                    const msg = `Olá! Aqui está seu voucher:\n\nCódigo: ${order.vouchers[0].code}\n\nServiços:\n${itemsList}\n\nApresente na entrada.`;
                                    navigator.clipboard.writeText(msg);
                                    toast({ title: '✅ Mensagem copiada para transferência!' });
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copiar
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 font-bold gap-2 text-whatsapp border-whatsapp/50 hover:bg-whatsapp hover:text-white"
                                  onClick={() => {
                                    const itemsList = order.order_items?.map((item: any) => `- ${item.quantity}x ${item.product_id}`).join('\n') || '';
                                    const msg = `Olá! Aqui está seu voucher:\n\nCódigo: ${order.vouchers[0].code}\n\nServiços:\n${itemsList}\n\nApresente na entrada.`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                  }}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  WhatsApp
                                </Button>
                              </div>

                              <div className="flex items-center gap-2 pt-2">
                                {order.vouchers[0].is_redeemed ? (
                                  <div className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive p-4 rounded-xl font-black">
                                    <CheckCircle2 className="w-5 h-5" />
                                    VOUCHER JÁ UTILIZADO
                                  </div>
                                ) : (
                                  <Button 
                                    className="w-full h-14 bg-whatsapp hover:bg-whatsapp-light text-white font-black text-lg gap-2 rounded-xl shadow-lg shadow-whatsapp/20"
                                    onClick={async () => {
                                      try {
                                        await redeemVoucher(order.vouchers[0].id);
                                        toast({ title: '✅ Voucher utilizado!', description: 'Entrada liberada com sucesso.' });
                                        fetchOrders();
                                      } catch {
                                        toast({ title: 'Erro ao validar voucher', variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    <CheckCircle2 className="w-6 h-6" />
                                     MARCAR COMO UTILIZADO
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-6 text-center bg-sun/10 rounded-2xl border-2 border-sun/20">
                              <p className="text-sun-dark font-bold mb-3">Pagamento ainda não confirmado.</p>
                              <Button 
                                onClick={() => handleMarkAsPaid(order.id)}
                                className="w-full bg-sun hover:bg-sun-light text-foreground font-black"
                              >
                                Confirmar Pagamento agora
                              </Button>
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
