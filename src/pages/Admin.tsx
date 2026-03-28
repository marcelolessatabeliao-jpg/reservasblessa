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
  { id: 1, name: 'Quiosque 1 (Grande)', price: 100 },
  { id: 2, name: 'Quiosque 2', price: 75 },
  { id: 3, name: 'Quiosque 3', price: 75 },
  { id: 4, name: 'Quiosque 4', price: 75 },
  { id: 5, name: 'Quiosque 5', price: 75 }
];

const QUAD_TIMES = ['09:00', '10:30', '14:00', '15:30'];
const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX / Transferência' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'cash', label: 'Dinheiro (Local)' }
];

type TabType = 'painel' | 'reservas' | 'quiosques' | 'quads' | 'vendas';

const BR_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21",
  "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02",
  "2026-11-15", "2026-11-20", "2026-12-25",
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
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, bookings(name, phone)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, bookings(name, phone)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      let parsedKiosks = [...(kiosks || [])];
      let parsedQuads = [...(quads || [])];

      if (orderData) {
         orderData.forEach((o: any) => {
            if (!o.order_items) return;
            const resDate = o.visit_date || o.created_at.split('T')[0];
            const customerName = o.customer_name || 'Venda Loja';
            
            o.order_items.forEach((item: any) => {
               const pId = (item.product_id || '').toLowerCase();
               if (pId.includes('quiosque')) {
                 for(let i=0; i<item.quantity; i++) {
                   parsedKiosks.push({
                     id: `order-${o.id}-k-${i}`,
                     kiosk_id: pId.includes('maior') ? 1 : 'MENOR',
                     reservation_date: resDate,
                     customer_name: customerName,
                     price: item.unit_price,
                     is_from_order: true
                   });
                 }
               }
               if (pId.includes('quad')) {
                  parsedQuads.push({
                     id: `order-${o.id}-q-${item.id}`,
                     time_slot: pId.includes('dupla') ? 'DUPLA' : 'INDIV',
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
      const { bookings, is_from_order, bookings_kiosk, customer_name, receipt_url, ...payload } = editData;
      
      const { error } = await supabase.from(table).update(payload).eq('id', editingId);
      if (error) throw error;
      
      toast({ title: "✓ Alterações salvas" });
      setEditingId(null);
      fetchData();
    } catch (err) {
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
    const dayKiosks = kioskReservations.filter(r => r.reservation_date === format(targetDate, 'yyyy-MM-dd'));
    const dayQuads = quadReservations.filter(r => r.reservation_date === format(targetDate, 'yyyy-MM-dd'));
    
    return (
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 animate-in fade-in duration-500">
        <div className="space-y-8">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
             <Card className="bg-white border-2 border-emerald-600/20 text-emerald-950 shadow-xl rounded-[2.5rem] p-6 flex flex-col items-start hover:shadow-emerald-200/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-110 group-hover:opacity-10 transition-all"><Tent className="w-32 h-32" /></div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600 mb-4 border border-emerald-100 shadow-sm">
                   <Tent className="w-5 h-5" />
                </div>
                <span className="text-4xl font-black tabular-nums tracking-tighter">{currentKiosks.length}</span>
                <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-emerald-600">Quiosques Ativos</span>
             </Card>
             <Card className="bg-white border-2 border-blue-600/20 text-blue-950 shadow-xl rounded-[2.5rem] p-6 flex flex-col items-start hover:shadow-blue-200/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-110 group-hover:opacity-10 transition-all"><Bike className="w-32 h-32" /></div>
                <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600 mb-4 border border-blue-100 shadow-sm">
                   <Bike className="w-5 h-5" />
                </div>
                <span className="text-4xl font-black tabular-nums tracking-tighter">{currentQuads.length}</span>
                <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-blue-600">Quad Agendados</span>
             </Card>
             <Card className="bg-white border-2 border-amber-500/20 text-amber-950 shadow-xl rounded-[2.5rem] p-6 flex flex-col items-start hover:shadow-amber-200/50 transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-110 group-hover:opacity-10 transition-all"><TrendingUp className="w-32 h-32" /></div>
                <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-100 shadow-sm">
                   <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(currentKiosks.reduce((s, r) => s + (r.price || 0), 0))}</span>
                <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-amber-600">Receita Espaços</span>
             </Card>
             <Card className="bg-emerald-950 border-2 border-emerald-800 text-white shadow-2xl rounded-[2.5rem] p-6 flex flex-col items-start hover:scale-[1.02] transition-all group overflow-hidden relative">
                <div className="absolute -top-4 -right-4 p-4 opacity-10 group-hover:scale-110 transition-all"><ShoppingBag className="w-32 h-32" /></div>
                <div className="p-3.5 rounded-2xl bg-white/10 text-emerald-400 mb-4 border border-white/10 backdrop-blur-md">
                   <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-2xl font-black tabular-nums tracking-tighter">{formatCurrency(orders.reduce((s, r) => s + (r.total_amount || 0), 0))}</span>
                <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-emerald-400">Vendas Loja</span>
             </Card>
          </div>

          <Card className="bg-white border-2 border-emerald-100/50 shadow-premium rounded-[3.5rem] p-10">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-emerald-600/20">
                      <Users className="w-8 h-8" />
                   </div>
                   <div>
                      <h3 className="text-3xl font-black text-emerald-950 tracking-tighter leading-none">Mapa de Ocupação</h3>
                      <p className="text-[10px] font-black uppercase text-emerald-900/30 tracking-[0.3em] mt-1">Status de Reservas Confirmadas</p>
                   </div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-2 border-emerald-200 font-black px-8 py-3 rounded-2xl text-[11px] uppercase tracking-widest">
                   {format(targetDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </Badge>
             </div>
             
             <div className="grid xl:grid-cols-2 gap-16">
                <div className="space-y-10">
                   <h4 className="text-[12px] font-black text-emerald-900/40 uppercase tracking-[0.4em] flex items-center gap-3">
                      <Tent className="w-4 h-4 text-emerald-600" /> Quiosques 
                      <span className="h-px bg-emerald-100 flex-1" />
                   </h4>
                   <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                      {KIOSKS.map(k => {
                        const booking = dayKiosks.find(b => Number(b.kiosk_id) === k.id);
                        return (
                          <div key={k.id} className={cn(
                            "group relative aspect-square rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center gap-1",
                            booking 
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-500/20 scale-105" 
                              : "bg-emerald-50/40 border-emerald-100 text-emerald-900/10 hover:border-emerald-300"
                          )}>
                             <span className={cn("text-[9px] font-black uppercase tracking-tighter opacity-50", booking ? "text-white" : "text-emerald-900")}>Q-{k.id}</span>
                             {booking ? <UserCheck className="w-6 h-6" /> : <Plus className="w-5 h-5 opacity-20 group-hover:scale-125 transition-all" />}
                             {booking && (
                               <div className="absolute inset-0 bg-emerald-950/95 opacity-0 group-hover:opacity-100 transition-all rounded-[2rem] flex items-center justify-center p-3 text-center backdrop-blur-md">
                                  <span className="text-[9px] font-black leading-tight uppercase tracking-widest">{booking.customer_name}</span>
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-emerald-900/40 uppercase tracking-[0.3em] flex items-center gap-3">
                       <Bike className="w-4 h-4 text-blue-600" /> Quadriciclos
                       <span className="h-px bg-emerald-100 flex-1" />
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                       {QUAD_TIMES.map(slot => {
                         const slotBookings = dayQuads.filter(b => (b.time_slot || '').includes(slot));
                         const count = slotBookings.reduce((s, r) => s + (r.quantity || 1), 0);
                         return (
                           <div key={slot} className={cn(
                             "p-4 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-1",
                             count > 0 
                               ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
                               : "bg-blue-50/20 border-blue-100 text-blue-900/10 hover:border-blue-300"
                           )}>
                              <span className={cn("text-[9px] font-black uppercase tracking-widest", count > 0 ? "text-blue-100" : "text-blue-900")}>{slot}</span>
                              <div className="flex items-baseline gap-1">
                                 <span className="text-2xl font-black tabular-nums leading-none">{count}</span>
                                 <span className="text-[10px] opacity-60 font-bold">/5</span>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                    
                    {/* Fallback for Quads from orders or with non-standard slots */}
                    {dayQuads.filter(b => !QUAD_TIMES.some(t => (b.time_slot || '').includes(t))).length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                           <AlertTriangle className="w-3 h-3" /> Outros / Sem Horário
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dayQuads.filter(b => !QUAD_TIMES.some(t => (b.time_slot || '').includes(t))).map(b => (
                            <Badge key={b.id} className="bg-amber-100 text-amber-800 border-amber-200 text-[8px] font-bold px-3 py-1">
                              {b.customer_name}: {b.quantity || 1} quad. ({b.time_slot})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
             </div>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="bg-emerald-50/30 border-emerald-100 shadow-premium rounded-[2.5rem] overflow-hidden">
              <div className="p-8 border-b border-emerald-100/50 bg-white">
                 <div className="flex items-center gap-3 mb-2">
                    <CalendarCheck className="w-6 h-6 text-emerald-600" />
                    <h4 className="text-xl font-black text-emerald-950 tracking-tight">Resumo Geral</h4>
                 </div>
                 <p className="text-xs font-bold text-emerald-800/40 uppercase tracking-widest leading-relaxed">
                    Selecione uma data para organizar seu dia de operações.
                 </p>
                 
                 <div className="grid grid-cols-1 gap-2 mt-6">
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20">
                       <Tent className="w-3.5 h-3.5" /> Quiosques Ocupados
                    </div>
                    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-600/20">
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
           
           <Card className="bg-emerald-900 text-white border-none shadow-premium rounded-[2.5rem] p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <History className="w-24 h-24" />
              </div>
              <div className="relative z-10 flex flex-col gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <HelpCircle className="w-6 h-6 text-white" />
                 </div>
                 <div>
                    <h4 className="text-xl font-black tracking-tight mb-2">Resumo Operacional</h4>
                    <p className="text-sm text-emerald-100/60 font-medium leading-relaxed">
                       Através deste painel você gerencia a ocupação em tempo real. Os marcadores no calendário indicam dias com reservas já confirmadas.
                    </p>
                 </div>
              </div>
           </Card>
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
                      <th className="px-6 py-4">Quiosque</th>
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
                              ) : <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold">{KIOSKS.find(k => k.id === Number(r.kiosk_id))?.name || `Q-${r.kiosk_id || '?'}`}</Badge>}
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
                                 <Badge variant="outline" className="text-[9px] border-primary/20 text-primary">{KIOSKS.find(k => k.id === r.kiosk_id)?.name}</Badge>
                              </div>
                              <span className="font-bold text-primary">{formatCurrency(r.price)}</span>
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
                      <th className="px-6 py-4">Qtd</th>
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
                                 <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700">{r.time_slot}</Badge>
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
                    <span className="bg-emerald-600 text-white px-5 py-2 rounded-2xl rotate-[-2deg] shadow-2xl shadow-emerald-500/20">Lessa</span>
                    <span className="text-emerald-950/80">Painel</span>
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
          <div className="flex items-center p-2 bg-emerald-900/5 backdrop-blur-xl rounded-[2.8rem] w-fit max-w-full overflow-x-auto border border-white/60 shadow-premium no-scrollbar">
             <button onClick={() => setActiveTab('painel')} className={cn(
               "px-8 py-4 rounded-[2.2rem] text-sm font-black flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap", 
               activeTab === 'painel' ? "bg-emerald-900 text-white shadow-2xl shadow-emerald-900/20 scale-105" : "text-emerald-900/60 hover:text-emerald-900 hover:bg-white/40"
             )}>
                <LayoutDashboard className="w-4.5 h-4.5" /> Painel
             </button>
             <button onClick={() => setActiveTab('reservas')} className={cn(
               "px-8 py-4 rounded-[2.2rem] text-sm font-black flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap", 
               activeTab === 'reservas' ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-600/20 scale-105" : "text-emerald-900/60 hover:text-emerald-900 hover:bg-white/40"
             )}>
                <CalendarCheck className="w-4.5 h-4.5" /> Agenda
             </button>
             <button onClick={() => setActiveTab('quiosques')} className={cn(
               "px-8 py-4 rounded-[2.2rem] text-sm font-black flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap", 
               activeTab === 'quiosques' ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-600/20 scale-105" : "text-emerald-900/60 hover:text-emerald-900 hover:bg-white/40"
             )}>
                <Tent className="w-4.5 h-4.5" /> Quiosques
             </button>
             <button onClick={() => setActiveTab('quads')} className={cn(
               "px-8 py-4 rounded-[2.2rem] text-sm font-black flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap", 
               activeTab === 'quads' ? "bg-blue-600 text-white shadow-2xl shadow-blue-600/20 scale-105" : "text-emerald-900/60 hover:text-emerald-900 hover:bg-white/40"
             )}>
                <Bike className="w-4.5 h-4.5" /> Quads
             </button>
             <button onClick={() => setActiveTab('vendas')} className={cn(
               "px-8 py-4 rounded-[2.2rem] text-sm font-black flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap", 
               activeTab === 'vendas' ? "bg-amber-600 text-white shadow-2xl shadow-amber-600/20 scale-105" : "text-emerald-900/60 hover:text-emerald-900 hover:bg-white/40"
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
