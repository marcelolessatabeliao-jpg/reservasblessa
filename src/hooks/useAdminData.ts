import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isBefore, startOfDay, isToday } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getAdminOrders, markOrderAsPaid } from '@/integrations/supabase/orders';
import { formatCurrency } from '@/lib/booking-types';

export function useAdminData() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [kioskReservations, setKioskReservations] = useState<any[]>([]);
  const [quadReservations, setQuadReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await getAdminOrders();
      const { data: bks } = await supabase
        .from('bookings')
        .select('*')
        .neq('status', 'awaiting_payment')
        .order('visit_date', { ascending: false });
      
      const { data: kiosks } = await (supabase.from('kiosk_reservations') as any)
        .select('*, orders!inner(customer_name, status, visit_date), bookings(name)')
        .neq('orders.status', 'awaiting_payment')
        .order('reservation_date', { ascending: false });
        
      const { data: quads } = await (supabase.from('quad_reservations') as any)
        .select('*, orders!inner(customer_name, status, visit_date), bookings(name)')
        .neq('orders.status', 'awaiting_payment')
        .order('reservation_date', { ascending: false });
      
      const { data: creds } = await supabase
        .from('internal_credits')
        .select('*')
        .order('created_at', { ascending: false });
      
      setCredits(creds || []);

      // Mapping reservations to include customer names correctly
      let parsedKiosks = (kiosks || []).map((k: any) => ({
         ...k,
         customer_name: k.customer_name || k.orders?.customer_name || k.bookings?.name || 'Reserva Direta'
      }));
      
      let parsedQuads = (quads || []).map((q: any) => ({
         ...q,
         customer_name: q.customer_name || q.orders?.customer_name || q.bookings?.name || 'Reserva Direta'
      }));

      // Enrich from orders (virtual items)
      if (orderData) {
        orderData.forEach((o: any) => {
          if (o.status === 'awaiting_payment') return;
          const resDate = o.visit_date || o.created_at.split('T')[0];
          const customerName = o.customer_name || 'Venda Loja';
          
          (o.order_items || []).forEach((item: any) => {
            const pId = (item.product_id || '').toLowerCase();
            const pName = (item.product_name || '').toLowerCase();
            
            if ((pId.includes('quiosque') || pName.includes('quiosque')) && !parsedKiosks.some(pk => pk.order_id === o.id)) {
              parsedKiosks.push({
                id: `order-${o.id}-k`,
                kiosk_id: (pId.includes('maior') || pName.includes('maior')) ? 1 : 'MENOR',
                reservation_date: resDate,
                customer_name: customerName,
                price: item.unit_price,
                order_id: o.id,
                is_from_order: true
              });
            }

            if ((pId.includes('quad') || pName.includes('quad')) && !parsedQuads.some(pq => pq.order_id === o.id)) {
              parsedQuads.push({
                id: `order-${o.id}-q`,
                time_slot: '10:30', // Fallback
                quad_type: pName.includes('dupla') ? 'dupla' : 'individual',
                quantity: item.quantity,
                reservation_date: resDate,
                customer_name: customerName,
                price: item.quantity * item.unit_price,
                order_id: o.id,
                is_from_order: true
              });
            }
          });
        });
      }

      setBookings(bks || []);
      setKioskReservations(parsedKiosks);
      setQuadReservations(parsedQuads);
      setOrders(orderData || []);
    } catch (err) {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("admin_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const confirmDelete = async (item: any, type: string) => {
    setLoading(true);
    try {
      const tableMap: any = { kiosk: 'kiosk_reservations', quad: 'quad_reservations', order: 'orders', reservas: 'bookings' };
      const table = tableMap[type];
      await supabase.from(table).delete().eq('id', item.id);
      toast({ title: "Removido com sucesso" });
      fetchData();
      return true;
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleConfirm = async (type: 'kiosk' | 'quad', group: any, date: Date) => {
    const newDateStr = format(date, 'yyyy-MM-dd');
    setLoading(true);
    try {
      const table = type === 'kiosk' ? 'kiosk_reservations' : 'quad_reservations';
      await Promise.all(group.items.map((r: any) =>
        supabase.from(table).update({ reservation_date: newDateStr }).eq('id', r.id)
      ));
      toast({ title: '✓ Reagendado com sucesso' });
      fetchData();
      return true;
    } catch (err) {
      toast({ title: 'Erro ao reagendar', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const convertToCredit = async (item: any, type: 'reservas' | 'order') => {
    const amount = type === 'order' ? item.total_amount : (item.total_price || 0);
    const name = item.customer_name || item.name;
    const phone = item.customer_phone || item.phone;
    const cpf = item.customer_cpf || item.cpf;
    
    if (confirm(`Deseja cancelar esta reserva e gerar um crédito de ${formatCurrency(amount)} para ${name}?`)) {
      setLoading(true);
      try {
        await supabase.from('internal_credits').insert({
          customer_name: name,
          customer_phone: phone,
          customer_cpf: cpf,
          amount: amount,
          notes: `Gerado a partir do pedido #${item.id.slice(0,8)}`
        });
        const table = type === 'order' ? 'orders' : 'bookings';
        await supabase.from(table).update({ status: 'cancelled', notes: (item.notes || '') + ' [Convertido em Crédito]' }).eq('id', item.id);
        toast({ title: "Sucesso!", description: "Crédito gerado e reserva cancelada." });
        fetchData();
        return true;
      } catch (e: any) {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
        return false;
      } finally {
        setLoading(false);
      }
    }
    return false;
  };

  return {
    loading,
    bookings,
    kioskReservations,
    quadReservations,
    orders,
    credits,
    targetDate,
    setTargetDate,
    fetchData,
    confirmDelete,
    handleRescheduleConfirm,
    convertToCredit
  };
}
