import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, 
  UserCheck, Hash, ArrowRight, MessageCircle, Clock, Circle, Trash2,
  Tent, Bike, History, ChevronDown, ChevronUp, AlertTriangle, FileText,
  Pencil, X, Check, Upload, FileCheck, Loader2, LayoutDashboard, ShoppingBag, HelpCircle,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';
import { BookingTable } from '@/components/admin/BookingTable';
import { getAdminOrders, markOrderAsPaid } from '@/integrations/supabase/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Constants from common types
const KIOSKS = [
  { id: 1, name: 'Quiosque 1 (Grande)', price: 100, capacity: 'Até 15 pessoas', type: 'Maior' },
  { id: 2, name: 'Quiosque 2', price: 75, capacity: 'Até 6 pessoas', type: 'Menor' },
  { id: 3, name: 'Quiosque 3', price: 75, capacity: 'Até 6 pessoas', type: 'Menor' },
  { id: 4, name: 'Quiosque 4', price: 75, capacity: 'Até 6 pessoas', type: 'Menor' },
  { id: 5, name: 'Quiosque 5', price: 75, capacity: 'Até 6 pessoas', type: 'Menor' }
];

const QUAD_TIMES = ['09:00', '10:30', '14:00', '15:30'];
const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX / Transferência' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'cash', label: 'Dinheiro (Local)' }
];

const QUAD_MODELS_LABELS: Record<string, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança',
  'INDIV': 'Individual',
  'DUPLA': 'Dupla'
};

type TabType = 'painel' | 'reservas' | 'quiosques' | 'quads' | 'vendas';

const BR_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-05", 
  "2026-04-21", "2026-05-01", "2026-05-14", "2026-05-24", "2026-06-04", 
  "2026-07-09", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", 
  "2026-11-20", "2026-12-25"
];

const isHoliday = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return BR_HOLIDAYS_2026.includes(dateStr);
};

const isAllowedDay = (date: Date) => {
  const day = date.getDay();
  // 0: Dom, 1: Seg, 5: Sex, 6: Sab
  const isOperating = day === 5 || day === 6 || day === 0 || day === 1;
  return isOperating || isHoliday(date);
};

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [activeTab, setActiveTab] = useState<TabType>('painel');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Data States
  const [bookings, setBookings] = useState<any[]>([]);
  const [kioskReservations, setKioskReservations] = useState<any[]>([]);
  const [quadReservations, setQuadReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  // Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // History States
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      // Map reservations to include customer names correctly from either source
      let parsedKiosks = (kiosks || []).map(k => ({
         ...k,
         customer_name: k.customer_name || k.orders?.customer_name || k.bookings?.name || 'Reserva Direta'
      }));
      
      let parsedQuads = (quads || []).map(q => ({
         ...q,
         customer_name: q.customer_name || q.orders?.customer_name || q.bookings?.name || 'Reserva Direta'
      }));

      if (orderData) {
         orderData.forEach((o: any) => {
            if (!o.order_items) return;
            const resDate = o.visit_date || o.created_at.split('T')[0];
            const customerName = o.customer_name || 'Venda Loja';
            
            o.order_items.forEach((item: any) => {
               const pId = (item.product_id || '').toLowerCase();
               const pName = (item.product_name || '').toLowerCase();
               
               // Only add Kiosks from orders if NOT already in parsedKiosks (via order_id)
               if ((pId.includes('quiosque') || pName.includes('quiosque')) && !parsedKiosks.some(pk => pk.order_id === o.id)) {
                 for(let i=0; i<item.quantity; i++) {
                   parsedKiosks.push({
                     id: `order-${o.id}-k-${i}`,
                     kiosk_id: (pId.includes('maior') || pName.includes('maior')) ? 1 : 'MENOR',
                     reservation_date: resDate,
                     customer_name: customerName,
                     price: item.unit_price,
                     is_from_order: true
                   });
                 }
               }

               // Only add Quads from orders if NOT already in parsedQuads (via order_id)
               if ((pId.includes('quad') || pName.includes('quad')) && !parsedQuads.some(pq => pq.order_id === o.id)) {
                  // Try to find a time slot (HH:MM or HHhMM) in name or metadata
                  const searchStr = `${pName} ${pId} ${JSON.stringify(item.metadata || {})} ${o.notes || ''}`.toUpperCase();
                  const timeMatch = searchStr.match(/(\d{2}[:H]\d{2})/);
                  let finalSlot = timeMatch ? timeMatch[1].replace('H', ':') : null;
                  
                  if (!finalSlot) {
                    const standardSlot = QUAD_TIMES.find(t => searchStr.includes(t));
                    finalSlot = standardSlot || (searchStr.includes('DUPLA') ? 'DUPLA' : 'INDIV');
                  }

                  parsedQuads.push({
                     id: `order-${o.id}-q-${item.id}`,
                     time_slot: finalSlot,
                     quad_type: searchStr.includes('DUPLA') ? 'dupla' : (searchStr.includes('CRIANCA') ? 'adulto-crianca' : 'individual'),
                     quantity: item.quantity,
                     reservation_date: resDate,
                     customer_name: customerName,
                     price: item.quantity * item.unit_price,
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
      console.error(err);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  // --- ACTIONS ---
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEditing = async (type: 'kiosk' | 'quad') => {
    try {
      const table = type === 'kiosk' ? 'kiosk_reservations' : 'quad_reservations';
      const payload: any = {};
      const fields = type === 'kiosk' 
        ? ['kiosk_id', 'reservation_date', 'notes', 'price', 'receipt_url', 'customer_name'] 
        : ['time_slot', 'quad_type', 'quantity', 'reservation_date', 'notes', 'price', 'receipt_url', 'customer_name'];
      
      fields.forEach(f => {
        if (editData[f] !== undefined) payload[f] = editData[f];
      });

      // Se for uma reserva virtual extraída de um pedido, precisa virar real no banco
      if (typeof editingId === 'string' && editingId.startsWith('order-')) {
        const orderId = editingId.split('-')[1];
        payload.order_id = orderId;
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).update(payload).eq('id', editingId);
        if (error) throw error;
      }
      
      toast({ title: "✓ Alterações salvas" });
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      setEditData((prev: any) => ({ ...prev, receipt_url: publicUrl }));
      toast({ title: "Comprovante enviado!" });
    } catch (err) {
      toast({ title: "Erro no upload", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const requestDelete = (item: any, type: 'kiosk' | 'quad' | 'order' | 'reservas') => {
    setDeleteTarget({ ...item, type });
    setDeleteDialogOpen(true);
  };

  const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: "✓ Status atualizado" });
      fetchData();
    } catch (err) {
      console.error('Update status error:', err);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally { setUpdatingId(null); }
  };

  const addBookingNote = async (bookingId: string, notes: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ notes }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: "✓ Nota adicionada" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao adicionar nota", variant: "destructive" });
    } finally { setUpdatingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      let table = '';
      if (deleteTarget.type === 'kiosk') table = 'kiosk_reservations';
      else if (deleteTarget.type === 'quad') table = 'quad_reservations';
      else if (deleteTarget.type === 'order') table = 'orders';
      else if (deleteTarget.type === 'reservas') table = 'bookings';

      const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
      if (error) throw error;

      toast({ title: "Removido com sucesso" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // --- GROUPING & FILTERING ---
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const currentKiosks = kioskReservations.filter(r => !isBefore(parseISO(r.reservation_date), startOfDay(new Date())));
  const pastKiosks = kioskReservations.filter(r => isBefore(parseISO(r.reservation_date), startOfDay(new Date())));

  const currentQuads = quadReservations.filter(r => !isBefore(parseISO(r.reservation_date), startOfDay(new Date())));
  const pastQuads = quadReservations.filter(r => isBefore(parseISO(r.reservation_date), startOfDay(new Date())));

  const kioskHistory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pastKiosks.forEach(r => {
      const month = format(parseISO(r.reservation_date), 'yyyy-MM');
      if (!groups[month]) groups[month] = [];
      groups[month].push(r);
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  }, [pastKiosks]);

  const quadHistory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pastQuads.forEach(r => {
      const month = format(parseISO(r.reservation_date), 'yyyy-MM');
      if (!groups[month]) groups[month] = [];
      groups[month].push(r);
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  }, [pastQuads]);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  if (!token) return <AdminLogin onLogin={setToken} />;

  // --- VIEW RENDERERS ---

   const renderDashboard = () => {
    const dayKiosks = kioskReservations.filter(r => {
      try {
        const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
        return d === format(targetDate, 'yyyy-MM-dd');
      } catch { return false; }
    });
    
    const dayQuads = quadReservations.filter(r => {
      try {
        const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
        return d === format(targetDate, 'yyyy-MM-dd');
      } catch { return false; }
    });
    
    return (
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 animate-in fade-in duration-500">
        <div className="space-y-8">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
             <Card className="bg-emerald-50 border-2 border-emerald-300 text-emerald-950 shadow-xl rounded-[1.5rem] p-4 flex flex-col items-start hover:shadow-emerald-300/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.05] group-hover:scale-110 group-hover:opacity-[0.15] transition-all"><Tent className="w-24 h-24 text-emerald-600" /></div>
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 mb-2 border border-emerald-200 shadow-sm">
                   <Tent className="w-4 h-4" />
                </div>
                <span className="text-3xl font-black tabular-nums tracking-tighter">{dayKiosks.length}</span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-emerald-700">Quiosques Hoje</span>
             </Card>
             <Card className="bg-blue-50 border-2 border-blue-300 text-blue-950 shadow-xl rounded-[1.5rem] p-4 flex flex-col items-start hover:shadow-blue-300/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.05] group-hover:scale-110 group-hover:opacity-[0.15] transition-all"><Bike className="w-24 h-24 text-blue-600" /></div>
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 mb-2 border border-blue-200 shadow-sm">
                   <Bike className="w-4 h-4" />
                </div>
                <span className="text-3xl font-black tabular-nums tracking-tighter">{dayQuads.length}</span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-blue-700">Quad Hoje</span>
             </Card>
             <Card className="bg-amber-50 border-2 border-amber-300 text-amber-950 shadow-xl rounded-[1.5rem] p-4 flex flex-col items-start hover:shadow-amber-300/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.05] group-hover:scale-110 group-hover:opacity-[0.15] transition-all"><TrendingUp className="w-24 h-24 text-amber-600" /></div>
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 mb-2 border border-amber-200 shadow-sm">
                   <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(dayKiosks.reduce((s, r) => s + (r.price || 0), 0) + dayQuads.reduce((s, r) => s + (r.price || 0), 0))}</span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-amber-700">Receita do Dia</span>
             </Card>
             <Card className="bg-emerald-900 border-2 border-emerald-700 text-white shadow-2xl rounded-[1.5rem] p-4 flex flex-col items-start hover:scale-[1.02] transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-20 group-hover:scale-110 transition-all"><ShoppingBag className="w-24 h-24 text-white" /></div>
                <div className="p-2.5 rounded-xl bg-white/20 text-emerald-100 mb-2 border border-white/20 backdrop-blur-md">
                   <ShoppingBag className="w-4 h-4" />
                </div>
                <span className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(orders.filter(o => (o.visit_date || o.created_at.split('T')[0]) === format(targetDate, 'yyyy-MM-dd')).reduce((s, r) => s + (r.total_amount || 0), 0))}</span>
                <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-emerald-300">Vendas Loja</span>
             </Card>
          </div>

          <Card className="bg-white border-2 border-emerald-50 text-emerald-950 shadow-sm rounded-[2rem] p-8">
             <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 border-b border-emerald-100 pb-8">
                 <div className="w-16 h-16 bg-emerald-800 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl shadow-lg">
                    {targetDate.getDate()}
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-emerald-950 tracking-tighter leading-none mb-1">Operação Diária</h3>
                    <p className="text-[13px] font-bold text-emerald-700/80 capitalize">{format(targetDate, "EEEE, yyyy", { locale: ptBR })}</p>
                 </div>
             </div>
             
             <div className="rounded-[1.5rem] border-2 border-amber-200 bg-[#FFFCF0] overflow-hidden mb-0">
                <div className="p-5 border-b border-amber-200 flex items-center gap-3">
                   <HelpCircle className="w-5 h-5 text-amber-700" />
                   <h4 className="font-black text-amber-900 text-lg">Resumo de {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}</h4>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2">
                   {/* Left: Quiosques */}
                   <div className="p-8 border-b xl:border-b-0 xl:border-r border-amber-200 bg-emerald-50/70 space-y-6">
                      <h4 className="text-[14px] font-black text-emerald-700 flex items-center gap-3">
                         <Users className="w-5 h-5 text-emerald-600" /> Quiosques ({dayKiosks.length}/5)
                      </h4>
                      
                      <div className="flex flex-col gap-3">
                       {KIOSKS.map(k => {
                        const booking = dayKiosks.find(b => {
                          const bid = b.kiosk_id;
                          if (bid === 1 || bid === '1' || bid === 'MAIOR') return k.id === 1;
                          if (bid === 'MENOR') {
                             const dayOrderMenors = dayKiosks.filter(dk => dk.kiosk_id === 'MENOR');
                             const orderIdx = dayOrderMenors.findIndex(dk => dk.id === b.id);
                             if (k.id === orderIdx + 2) return true;
                          }
                          return Number(bid) === k.id;
                        });
                        
                        return (
                          <div key={k.id} className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between group">
                             <span className="font-black text-emerald-950 text-[13px]">{k.name}</span>
                             {booking ? (
                               <span className="text-emerald-700 font-bold italic text-[13px] text-right">
                                  {booking.customer_name}
                               </span>
                             ) : (
                               <span className="text-emerald-600/60 italic font-bold text-[13px]">Livre</span>
                             )}
                          </div>
                        );
                      })}
                   </div>
                   </div>

                   {/* Right: Quadriciclos */}
                   <div className="p-8 bg-blue-50/40 space-y-6">
                      <h4 className="text-[14px] font-black text-blue-700 flex items-center gap-3">
                         <Bike className="w-5 h-5 text-blue-600" /> Quadriciclos
                      </h4>
                   
                   <div className="flex flex-col gap-2.5">
                      {[
                        { start: '09:00', end: '10:30' },
                        { start: '10:30', end: '12:00' },
                        { start: '14:00', end: '15:30' },
                        { start: '15:30', end: '17:00' }
                      ].map(slot => {
                        const bookings = dayQuads.filter(b => {
                            const bSlot = (b.time_slot || '').split('(')[0].toUpperCase().replace(/H/g, ':').trim();
                            const target = slot.start.toUpperCase();
                            return bSlot === target || (bSlot.length > 2 && target.includes(bSlot)) || (target.length > 2 && bSlot.includes(target));
                        });
                        const count = bookings.reduce((s, r) => s + (Number(r.quantity) || 1), 0);
                        
                        return (
                          <div key={slot.start} className="bg-white rounded-[1.25rem] p-3 shadow-sm border border-blue-200/80 space-y-2.5">
                             <div className="flex items-center justify-between px-1">
                                <span className="font-black text-blue-900 text-[13px]">{slot.start} - {slot.end}</span>
                                <span className="text-blue-600 font-bold text-[11px]">{count}/5 ocupados</span>
                             </div>
                             
                             <div className="rounded-xl border border-blue-50 bg-blue-50/20 p-1.5 min-h-[32px] flex items-center justify-center">
                                {bookings.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 justify-center">
                                     {bookings.map((b, bi) => (
                                       <Badge key={bi} className="bg-transparent text-blue-700/80 font-bold italic lowercase text-[11px] px-2 py-0 border-0 shadow-none">
                                          {b.customer_name} ({b.quantity})
                                       </Badge>
                                     ))}
                                  </div>
                                ) : (
                                  <span className="text-blue-400/50 italic font-black text-[11px]">Nenhuma reserva</span>
                                )}
                             </div>
                          </div>
                        );
                      })}
                   </div>

                   {dayQuads.filter(b => !['09:00', '10:30', '14:00', '15:30'].some(t => (b.time_slot || '').includes(t))).length > 0 && (
                      <div className="bg-amber-50/50 rounded-[1.25rem] p-3 shadow-sm border border-amber-200 mt-2 space-y-2.5">
                         <div className="flex items-center justify-between px-1">
                            <span className="font-black text-amber-900 text-[11px] uppercase tracking-wider flex items-center gap-2">
                               <AlertTriangle className="w-3.5 h-3.5" /> Extra / S. Horário
                            </span>
                         </div>
                         <div className="rounded-xl border border-amber-100 bg-white/40 p-1.5 min-h-[32px] flex items-center justify-center text-center">
                            <div className="flex flex-wrap gap-1.5 justify-center">
                               {dayQuads.filter(b => !['09:00', '10:30', '14:00', '15:30'].some(t => (b.time_slot || '').includes(t))).map((b, bi) => (
                                  <Badge key={bi} className="bg-transparent text-amber-800 font-bold italic lowercase text-[11px] px-2 py-0 border-0 shadow-none">
                                     {b.customer_name} ({b.quantity})
                                  </Badge>
                               ))}
                            </div>
                         </div>
                      </div>
                   )}


                </div>
             </div>

             {/* Footer Summary */}
             <div className="p-5 border-t border-amber-200 bg-[#FFFCF0] flex items-center justify-center text-center">
                <p className="text-amber-800 font-black uppercase tracking-[0.1em] text-[11px]">
                   Total de Reservas no Dia: {dayKiosks.length + dayQuads.length}
                </p>
             </div>
          </div>
        </Card>
        </div>

        <div className="space-y-6">
           <Card className="bg-white border-2 border-emerald-100 shadow-sm rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-emerald-100 bg-emerald-50/50">
                 <div className="flex items-center gap-3 mb-2">
                    <CalendarCheck className="w-5 h-5 text-emerald-800" />
                    <h4 className="text-lg font-black text-emerald-950 tracking-tight">Resumo Geral</h4>
                 </div>
                 <p className="text-[11px] font-bold text-emerald-800/70 leading-relaxed mb-6">
                    Selecione uma data para organizar seu dia de operações.
                 </p>
                 
                 <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-800 text-white rounded-[0.8rem] text-[10px] font-black uppercase tracking-wider">
                       <Tent className="w-3.5 h-3.5" /> Quiosques Ocupados
                    </div>
                    <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-700 text-white rounded-[0.8rem] text-[10px] font-black uppercase tracking-wider">
                       <Bike className="w-3.5 h-3.5" /> Quadriciclos Alugados
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-white">
                 <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={(d) => d && setTargetDate(d)}
                    className="p-0 pointer-events-auto"
                    locale={ptBR}
                    disabled={(date) => !isAllowedDay(date)}
                    classNames={{
                      month: "space-y-6",
                      caption: "flex justify-center pt-2 relative items-center mb-4",
                      caption_label: "text-lg font-black text-emerald-900 uppercase tracking-widest",
                      nav_button: "h-10 w-10 bg-emerald-50 text-emerald-600 border-0 hover:bg-emerald-100 rounded-xl transition-all",
                      table: "w-full border-collapse",
                      head_cell: "text-emerald-900/40 font-black text-[10px] uppercase tracking-[0.2em] w-12 py-4",
                      cell: "h-14 w-12 text-center p-0 relative focus-within:z-20",
                      day: cn(
                        "h-12 w-12 p-0 font-black text-sm transition-all rounded-2xl border-2 border-transparent hover:border-emerald-200 hover:bg-emerald-50/50",
                        "flex flex-col items-center justify-center gap-1"
                      ),
                      day_selected: "bg-emerald-900 text-white hover:bg-emerald-800 border-emerald-900 shadow-xl shadow-emerald-900/20 !opacity-100",
                      day_today: "bg-amber-400 text-emerald-950 border-amber-500 shadow-xl shadow-amber-400/30 font-black",
                      day_outside: "text-muted-foreground/20 opacity-50",
                    }}
                    components={{
                      DayContent: ({ date }) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const hasKiosk = kioskReservations.some(r => r.reservation_date === dateStr);
                        const hasQuad = quadReservations.some(r => r.reservation_date === dateStr);
                        return (
                          <div className="relative flex flex-col items-center">
                            <span>{date.getDate()}</span>
                            <div className="flex gap-1 mt-0.5">
                              {hasKiosk && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />}
                              {hasQuad && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" />}
                            </div>
                          </div>
                        );
                      }
                    }}
                    modifiers={{
                      holiday: (day) => isHoliday(day),
                    }}
                    modifiersStyles={{
                      holiday: { border: '2px dashed #10b981', color: '#059669' }
                    }}
                 />
              </div>
           </Card>
           
           {/* Resumo Operacional Card Removed */}
        </div>
      </div>
    );
  };

  const renderKioskTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="bg-white rounded-3xl border border-border/50 shadow-card overflow-hidden">
          <div className="p-6 border-b border-border/50 flex items-center justify-between bg-primary/5">
             <div>
                <h3 className="text-lg font-bold text-primary">Reservas Ativas de Quiosques</h3>
                <p className="text-xs text-muted-foreground">Reservas de hoje em diante</p>
             </div>
             <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                <Input placeholder="Buscar cliente..." className="pl-9 h-10 rounded-xl" />
             </div>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b border-border/50">
                   <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Modelo/Capacidade</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                   {currentKiosks.map(r => {
                      const isEditing = editingId === r.id;
                      return (
                        <tr key={r.id} className={cn("hover:bg-muted/20 transition-colors", isEditing && "bg-amber-50/50")}>
                           <td className="px-6 py-4 font-semibold text-sm">
                              {isEditing ? (
                                <Input type="date" value={editData.reservation_date} onChange={e => setEditData({...editData, reservation_date: e.target.value})} className="h-9 rounded-lg bg-white text-emerald-950 font-bold border-emerald-200" />
                              ) : <span className="text-emerald-900">{format(parseISO(r.reservation_date), 'dd/MM/yyyy')}</span>}
                           </td>
                           <td className="px-6 py-4 font-bold text-foreground">
                              {isEditing ? (
                                <Input value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} className="h-9 rounded-lg bg-white text-emerald-950 font-bold border-emerald-200" />
                              ) : <span className="text-emerald-950">{r.customer_name || (r as any).bookings?.name || 'Venda'}</span>}
                           </td>
                           <td className="px-6 py-4">
                              {isEditing ? (
                                <Select value={String(editData.kiosk_id)} onValueChange={v => setEditData({...editData, kiosk_id: parseInt(v)})}>
                                   <SelectTrigger className="h-9 rounded-lg bg-white text-emerald-950 font-bold border-emerald-200"><SelectValue /></SelectTrigger>
                                   <SelectContent className="bg-white border-emerald-200">{KIOSKS.map(k => <SelectItem key={k.id} value={String(k.id)} className="text-emerald-950">{k.name}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : (
                                 <div className="flex flex-col">
                                    <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold w-fit">
                                       {KIOSKS.find(k => k.id === Number(r.kiosk_id))?.name || `Q-${r.kiosk_id || '?'}`}
                                    </Badge>
                                    <span className="text-[9px] font-black uppercase text-emerald-600/60 mt-1 ml-1">
                                       {KIOSKS.find(k => k.id === Number(r.kiosk_id))?.capacity || (r.kiosk_id === 'MENOR' ? 'Até 6 pessoas' : '')}
                                    </span>
                                 </div>
                               )}
                           </td>
                           <td className="px-6 py-4 font-bold text-emerald-700">
                              {isEditing ? <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: parseFloat(e.target.value)})} className="h-9 w-24 bg-white text-emerald-950 font-bold border-emerald-200" /> : formatCurrency(r.price || (KIOSKS.find(k => k.id === Number(r.kiosk_id))?.price || 75))}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 {isEditing ? (
                                   <>
                                      <input type="file" id={`upload-${r.id}`} className="hidden" onChange={e => e.target.files && handleFileUpload(e.target.files[0])} />
                                      <label htmlFor={`upload-${r.id}`} className="p-2 rounded-lg bg-blue-100 text-blue-600 cursor-pointer hover:bg-blue-200 transition-colors">
                                         {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : editData.receipt_url ? <FileCheck className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                      </label>
                                      <Button size="icon" className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90" onClick={() => saveEditing('kiosk')}><Check className="w-4 h-4" /></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={cancelEditing}><X className="w-4 h-4" /></Button>
                                   </>
                                 ) : (
                                   <>
                                      {r.receipt_url && <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => window.open(r.receipt_url)}><FileText className="w-4 h-4" /></Button>}
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => startEditing(r)}><Pencil className="w-4 h-4" /></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(r, 'kiosk')}><Trash2 className="w-4 h-4" /></Button>
                                   </>
                                 )}
                              </div>
                           </td>
                        </tr>
                      );
                   })}
                </tbody>
             </table>
          </div>
       </div>

       {/* HISTORY */}
       <div className="space-y-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
             <History className="w-4 h-4" /> Histórico Mensal
          </h4>
          {kioskHistory.map(([month, data]) => {
            const isOpen = expandedMonths.has('k-' + month);
            return (
              <div key={month} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                 <button onClick={() => toggleMonth('k-' + month)} className="w-full p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                       <Badge className="bg-primary/10 text-primary border-0 font-bold px-3">{data.length} reservas</Badge>
                       <span className="font-bold text-foreground capitalize">{format(parseISO(month + '-01'), 'MMMM yyyy', { locale: ptBR })}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                 </button>
                 {isOpen && (
                   <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                      <div className="grid gap-2">
                         {data.map(r => (
                           <div key={r.id} className="p-3 bg-muted/20 rounded-xl flex items-center justify-between text-sm">
                              <div className="flex items-center gap-4">
                                 <span className="font-mono text-muted-foreground">{format(parseISO(r.reservation_date), 'dd/MM')}</span>
                                 <span className="font-bold">{r.customer_name}</span>
                                 <div className="flex flex-col items-start min-w-[100px]">
                                    <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">
                                       {KIOSKS.find(k => k.id === Number(r.kiosk_id))?.name || `Quiosque ${r.kiosk_id}`}
                                    </Badge>
                                    <span className="text-[8px] font-black uppercase text-emerald-500 mt-1">
                                       {KIOSKS.find(k => k.id === Number(r.kiosk_id))?.capacity || (r.kiosk_id === 'MENOR' ? 'Até 6 pessoas' : '')}
                                    </span>
                                 </div>
                              </div>
                              <span className="font-bold text-primary">{formatCurrency(r.price || (KIOSKS.find(k => k.id === Number(r.kiosk_id))?.price || 75))}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            );
          })}
       </div>
    </div>
  );

  const renderQuadTab = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="bg-white rounded-3xl border border-border/50 shadow-card overflow-hidden">
          <div className="p-6 border-b border-border/50 flex items-center justify-between bg-blue-50/30">
             <div>
                <h3 className="text-lg font-bold text-blue-700">Reservas Ativas de Quadriciclos</h3>
                <p className="text-xs text-muted-foreground">Reservas de hoje em diante</p>
             </div>
             <Input placeholder="Buscar cliente..." className="w-64 h-10 rounded-xl" />
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b border-border/50">
                   <tr>
                      <th className="px-6 py-4">Data/Horário</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Modelo</th>
                      <th className="px-6 py-4 text-center">Qtd</th>
                      <th className="px-6 py-4">Preço</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                   {currentQuads.map(r => {
                      const isEditing = editingId === r.id;
                      return (
                        <tr key={r.id} className={cn("hover:bg-muted/20 transition-colors", isEditing && "bg-amber-50/50")}>
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="font-bold text-sm">
                                    {isEditing ? <Input type="date" value={editData.reservation_date} onChange={e => setEditData({...editData, reservation_date: e.target.value})} className="h-8" /> : format(parseISO(r.reservation_date), 'dd/MM/yyyy')}
                                 </span>
                                 <span className="text-[10px] uppercase font-bold text-blue-600">
                                    {isEditing ? (
                                      <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                         <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                                         <SelectContent>{QUAD_TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                      </Select>
                                    ) : r.time_slot}
                                 </span>
                              </div>
                           </td>
                           <td className="px-6 py-4 font-bold text-foreground">
                              {isEditing ? <Input value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} className="h-9 bg-white text-emerald-950 font-bold border-blue-200" /> : <span className="text-emerald-950 font-bold">{r.customer_name || (r as any).bookings?.name || 'Cliente'}</span>}
                           </td>
                           <td className="px-6 py-4">
                              <Badge variant="outline" className="border-blue-200 text-blue-800 font-bold bg-blue-50/30">
                                 {QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual'}
                              </Badge>
                           </td>
                           <td className="px-6 py-4 text-center">
                              {isEditing ? <Input type="number" value={editData.quantity} onChange={e => setEditData({...editData, quantity: parseInt(e.target.value)})} className="h-9 w-16 bg-white text-emerald-950 font-bold border-blue-200" /> : <Badge className="bg-blue-100 text-blue-700 border-0 font-extrabold">{r.quantity} quad.</Badge>}
                           </td>
                           <td className="px-6 py-4 font-bold text-blue-700">
                              {isEditing ? <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: parseFloat(e.target.value)})} className="h-9 w-24 bg-white text-emerald-950 font-bold border-blue-200" /> : formatCurrency(r.price || 0)}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 {isEditing ? (
                                   <>
                                      <Button size="icon" className="h-8 w-8 rounded-lg bg-blue-600" onClick={() => saveEditing('quad')}><Check className="w-4 h-4" /></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={cancelEditing}><X className="w-4 h-4" /></Button>
                                   </>
                                 ) : (
                                   <>
                                      {r.receipt_url && <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => window.open(r.receipt_url)}><FileText className="w-4 h-4" /></Button>}
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => startEditing(r)}><Pencil className="w-4 h-4" /></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(r, 'quad')}><Trash2 className="w-4 h-4" /></Button>
                                   </>
                                 )}
                              </div>
                           </td>
                        </tr>
                      );
                   })}
                </tbody>
             </table>
          </div>
       </div>

       {/* HISTORY */}
       <div className="space-y-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
             <History className="w-4 h-4" /> Histórico Mensal
          </h4>
          {quadHistory.map(([month, data]) => {
            const isOpen = expandedMonths.has('q-' + month);
            return (
              <div key={month} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                 <button onClick={() => toggleMonth('q-' + month)} className="w-full p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                       <Badge className="bg-blue-50 text-blue-700 border-0 font-bold px-3">{data.length} passeios</Badge>
                       <span className="font-bold text-foreground capitalize">{format(parseISO(month + '-01'), 'MMMM yyyy', { locale: ptBR })}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                 </button>
                 {isOpen && (
                   <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                      <div className="grid gap-2">
                         {data.map(r => (
                           <div key={r.id} className="p-3 bg-muted/20 rounded-xl flex items-center justify-between text-sm">
                              <div className="flex items-center gap-4">
                                 <span className="font-mono text-muted-foreground">{format(parseISO(r.reservation_date), 'dd/MM')}</span>
                                 <span className="font-bold">{r.customer_name}</span>
                                 <div className="flex flex-col items-start min-w-[70px]">
                                    <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700">{r.time_slot}</Badge>
                                    <span className="text-[8px] font-black uppercase text-blue-400 mt-1">{QUAD_MODELS_LABELS[r.quad_type] || 'Individual'}</span>
                                 </div>
                              </div>
                              <span className="font-bold text-blue-700">{formatCurrency(r.price)}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            );
          })}
       </div>
    </div>
  );

  const renderOrderTab = () => (
    <div className="bg-white rounded-3xl border border-border/50 shadow-card overflow-hidden animate-in fade-in duration-500">
       <div className="p-6 border-b border-border/50 bg-amber-50/30 flex items-center justify-between">
          <div>
             <h3 className="text-lg font-bold text-amber-900">Histórico de Vendas e Pedidos</h3>
             <p className="text-xs text-muted-foreground">Gestão financeira centralizada</p>
          </div>
          <div className="flex items-center gap-2">
             <Badge className="bg-amber-100 text-amber-900 border-0 font-bold">Total: {orders.length}</Badge>
          </div>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b border-border/50">
                <tr>
                   <th className="px-6 py-4">ID / Data</th>
                   <th className="px-6 py-4">Cliente</th>
                   <th className="px-6 py-4">Total</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-border/30">
                {orders.map(order => (
                   <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-muted-foreground">#{order.id.slice(0,8)}</span>
                            <span className="text-sm font-bold">{format(parseISO(order.created_at), 'dd/MM/yyyy')}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                         {order.customer_name || 'Cliente Geral'}
                      </td>
                      <td className="px-6 py-4 font-bold text-primary">
                         {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4">
                         <Badge className={cn(
                           "rounded-md font-bold text-[9px]",
                           order.status === 'paid' ? "bg-whatsapp/10 text-whatsapp border-whatsapp/20" : "bg-red-50 text-red-500 border-red-100"
                         )} variant="outline">
                            {order.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                         </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            {order.status !== 'paid' && (
                              <Button size="sm" className="h-8 bg-primary rounded-lg text-[10px] font-bold" onClick={() => markOrderAsPaid(order.id).then(() => fetchData())}>Efetivar</Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(order, 'order')}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fff4] via-white to-[#e0f2fe] bg-fixed">
       {/* Ambient Glows */}
       <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-200/20 blur-[120px] rounded-full" />
       <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-200/20 blur-[120px] rounded-full" />

       <div className="max-w-7xl mx-auto space-y-8 relative z-10 p-4 md:p-8">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-4">
              <div className="space-y-2">
                 <h1 className="text-5xl font-black text-emerald-900 tracking-tighter flex items-center gap-4">
                     <div className="flex flex-col -space-y-2">
                        <span className="text-2xl text-emerald-600/60 leading-none">Lessa</span>
                        <span className="text-5xl">Painel</span>
                     </div>
                 </h1>
                 <p className="text-emerald-900/60 font-black uppercase tracking-[0.3em] text-[10px] bg-emerald-100/50 w-fit px-3 py-1 rounded-full border border-emerald-200/50">Gestão Integrada de Reservas • Balneário</p>
              </div>
              <div className="flex items-center gap-4">
                 <Button 
                   variant="ghost" 
                   className="rounded-2xl bg-white border border-emerald-200/50 font-black h-12 px-6 hover:bg-emerald-50 hover:shadow-premium transition-all text-emerald-800" 
                   onClick={fetchData} 
                   disabled={loading}
                 >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    <span className="ml-2">Atualizar</span>
                 </Button>
                 <Button 
                   className="rounded-2xl bg-emerald-950 text-white font-black h-12 px-8 shadow-2xl shadow-emerald-950/30 hover:scale-105 active:scale-95 transition-all" 
                   onClick={handleLogout}
                 >
                    <LogOut className="w-5 h-5 mr-2" /> Sair
                 </Button>
              </div>
          </div>

          {/* TABS */}
          <div className="flex items-center p-2 bg-white rounded-3xl w-full max-w-4xl mr-auto overflow-x-auto border-2 border-emerald-100 shadow-sm mb-6 no-scrollbar">
             <button onClick={() => setActiveTab('painel')} className={cn(
               "flex-1 px-8 py-4 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'painel' ? "bg-amber-500 text-amber-950 shadow-md" : "text-emerald-800 hover:bg-emerald-50"
             )}>
                <LayoutDashboard className="w-4.5 h-4.5" /> Visão Geral
             </button>
             <button onClick={() => setActiveTab('quiosques')} className={cn(
               "flex-1 px-8 py-4 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'quiosques' ? "bg-amber-500 text-amber-950 shadow-md" : "text-emerald-800 hover:bg-emerald-50"
             )}>
                <Tent className="w-4.5 h-4.5" /> Quiosques
             </button>
             <button onClick={() => setActiveTab('quads')} className={cn(
               "flex-1 px-8 py-4 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'quads' ? "bg-amber-500 text-amber-950 shadow-md" : "text-emerald-800 hover:bg-emerald-50"
             )}>
                <Bike className="w-4.5 h-4.5" /> Quadriciclos
             </button>
             <button onClick={() => setActiveTab('reservas')} className={cn(
               "flex-1 px-8 py-4 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'reservas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-emerald-800 hover:bg-emerald-50"
             )}>
                <CalendarCheck className="w-4.5 h-4.5" /> Agenda
             </button>
             <button onClick={() => setActiveTab('vendas')} className={cn(
               "flex-1 px-8 py-4 rounded-2xl text-[13px] font-black flex items-center justify-center gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'vendas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-emerald-800 hover:bg-emerald-50"
             )}>
                <ShoppingBag className="w-4.5 h-4.5" /> Vendas
             </button>
          </div>

          {/* CONTENT AREA WITH GRADIENT BACKGROUND */}
          <div className="min-h-[600px] bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-white/60 shadow-premium">
             {activeTab === 'painel' && renderDashboard()}
             {activeTab === 'reservas' && (
               <div className="space-y-6">
                 <div className="relative w-full max-w-lg">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input placeholder="Filtrar por nome, telefone ou código..." className="pl-10 h-12 rounded-2xl bg-white shadow-sm" value={search} onChange={e => setSearch(e.target.value)} />
                 </div>
                 <BookingTable 
                   bookings={[...bookings, ...orders.map(o => ({...o, is_order: true}))].filter(b => 
                     !search || 
                     (b.name || b.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
                     (b.phone || '').includes(search) ||
                     (b.confirmation_code || '').includes(search)
                   )}
                   onStatusChange={updateBookingStatus}
                   onAddNote={addBookingNote}
                   onReschedule={async (id, date, isOrder) => {
                      const table = isOrder ? 'orders' : 'bookings';
                      const { error } = await supabase.from(table).update({ visit_date: date }).eq('id', id);
                      if (error) toast({ title: "Erro ao reagendar", variant: "destructive" });
                      else { toast({ title: "✓ Reagendado" }); fetchData(); }
                   }}
                    onDelete={async (id, isOrder) => {
                       const table = isOrder ? 'orders' : 'bookings';
                       try {
                         const { error } = await supabase.from(table).delete().eq('id', id);
                         if (error) throw error;
                         toast({ title: "✓ Removido com sucesso" });
                         fetchData();
                       } catch (err: any) {
                         console.error('Delete error:', err);
                         toast({ title: "Erro ao remover: " + (err?.message || ''), variant: "destructive" });
                       }
                    }}
                   onRemoveItem={() => {}}
                   updatingId={updatingId}
                   onFileUpload={async (file, id, isOrder) => {
                     setIsUploading(true);
                     try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${crypto.randomUUID()}.${fileExt}`;
                        const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
                        if (uploadError) throw uploadError;
                        
                        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
                        const table = isOrder ? 'orders' : 'bookings';
                        const { error } = await supabase.from(table).update({ receipt_url: publicUrl }).eq('id', id);
                        
                        if (error) throw error;
                        toast({ title: "Comprovante anexado!" });
                        fetchData();
                     } catch (err) { 
                        toast({ title: "Erro ao anexar comprovante", variant: "destructive" });
                        console.error(err); 
                     } finally { setIsUploading(false); }
                   }}
                   isUploading={isUploading}
                 />
               </div>
             )}
             {activeTab === 'quiosques' && renderKioskTab()}
             {activeTab === 'quads' && renderQuadTab()}
             {activeTab === 'vendas' && renderOrderTab()}
          </div>
       </div>

       {/* DELETE DIALOG */}
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
             <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                   </div>
                   <AlertDialogTitle className="text-xl font-bold text-foreground">Confirmar Exclusão</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-muted-foreground font-medium">
                   Deseja realmente remover esta reserva? Esta ação não pode ser desfeita e liberará o horário/espaço para novos clientes.
                </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl border-none bg-muted font-bold">Cancelar</AlertDialogCancel>
                <Button onClick={confirmDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-6 shadow-md">Sim, Excluir</Button>
             </AlertDialogFooter>
          </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}
