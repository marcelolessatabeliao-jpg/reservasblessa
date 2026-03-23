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

type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

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

    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token, fetchBookings]);

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
              variant={dateFilter === f.key ? 'default' : 'outline'}
              onClick={() => setDateFilter(f.key)}
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
      </div>
    </div>
  );
}
