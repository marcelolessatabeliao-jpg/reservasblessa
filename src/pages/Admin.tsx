import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, LogOut, RefreshCw, Users, DollarSign, CalendarCheck, TrendingUp, 
  UserCheck, Hash, ArrowRight, MessageCircle, Clock, Circle, Trash2,
  Tent, Bike, History, ChevronDown, ChevronUp, AlertTriangle, FileText,
  Pencil, X, Check, Upload, FileCheck, Loader2, LayoutDashboard, ShoppingBag
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
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

type TabType = 'painel' | 'quiosques' | 'quads' | 'vendas';

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
  const [kioskReservations, setKioskReservations] = useState<any[]>([]);
  const [quadReservations, setQuadReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  // Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [isUploading, setIsUploading] = useState(false);

  // Delete Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // History States
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      setKioskReservations(kiosks || []);
      setQuadReservations(quads || []);
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
      const { error } = await supabase.from(table).update(editData).eq('id', editingId);
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

  const requestDelete = (item: any, type: 'kiosk' | 'quad' | 'order') => {
    setDeleteTarget({ ...item, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      let table = '';
      if (deleteTarget.type === 'kiosk') table = 'kiosk_reservations';
      else if (deleteTarget.type === 'quad') table = 'quad_reservations';
      else if (deleteTarget.type === 'order') table = 'orders';

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <Card className="bg-gradient-to-br from-white to-emerald-50 border-emerald-100 shadow-sm rounded-2xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all border-l-4 border-l-emerald-500">
                <span className="text-3xl font-extrabold text-emerald-600">{currentKiosks.length}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-800/60 tracking-wider">Quiosques Ativos</span>
             </Card>
             <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-100 shadow-sm rounded-2xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all border-l-4 border-l-blue-500">
                <span className="text-3xl font-extrabold text-blue-600">{currentQuads.length}</span>
                <span className="text-[10px] uppercase font-bold text-blue-800/60 tracking-wider">Quadriciclos Ativos</span>
             </Card>
             <Card className="bg-gradient-to-br from-white to-amber-50 border-amber-100 shadow-sm rounded-2xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all border-l-4 border-l-amber-500">
                <span className="text-2xl font-extrabold text-amber-600">{formatCurrency(currentKiosks.reduce((s, r) => s + (r.price || 0), 0))}</span>
                <span className="text-[10px] uppercase font-bold text-amber-800/60 tracking-wider">Receita Quiosques</span>
             </Card>
             <Card className="bg-gradient-to-br from-white to-orange-50 border-orange-100 shadow-sm rounded-2xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all border-l-4 border-l-orange-500">
                <span className="text-2xl font-extrabold text-orange-600">{formatCurrency(currentQuads.reduce((s, r) => s + (r.price || 0), 0))}</span>
                <span className="text-[10px] uppercase font-bold text-orange-800/60 tracking-wider">Receita Quadriciclos</span>
             </Card>
          </div>

          <Card className="bg-white border-border/50 shadow-card rounded-3xl p-8">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-primary" /> Ocupação Diária
                </h3>
                <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5">
                   {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}
                </Badge>
             </div>
             
             <div className="space-y-10">
                <div>
                   <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Tent className="w-4 h-4" /> Quiosques
                   </h4>
                   <div className="grid grid-cols-5 gap-3">
                      {KIOSKS.map(k => {
                        const booking = dayKiosks.find(b => Number(b.kiosk_id) === k.id);
                        return (
                          <div key={k.id} className={cn(
                            "group relative aspect-square rounded-2xl border transition-all flex flex-col items-center justify-center gap-1",
                            booking ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20 scale-105" : "bg-muted/30 border-dashed border-border text-muted-foreground hover:bg-muted/50"
                          )}>
                             <span className="text-[10px] font-bold opacity-60">Q-{k.id}</span>
                             {booking ? <UserCheck className="w-5 h-5" /> : <Circle className="w-4 h-4 opacity-20" />}
                             {booking && (
                               <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center p-2 text-center">
                                  <span className="text-[9px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{booking.customer_name}</span>
                               </div>
                             )}
                          </div>
                        );
                      })}
                   </div>
                </div>

                <div>
                   <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Quadriciclos
                   </h4>
                   <div className="grid grid-cols-4 gap-3">
                      {QUAD_TIMES.map(slot => {
                        const bookings = dayQuads.filter(b => b.time_slot === slot);
                        const count = bookings.reduce((s, r) => s + (r.quantity || 1), 0);
                        return (
                          <div key={slot} className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col items-center gap-1",
                            count > 0 ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-muted/20 border-border/50 text-muted-foreground opacity-50"
                          )}>
                             <span className="text-[10px] font-bold uppercase">{slot}</span>
                             <span className="text-lg font-bold">{count}/5</span>
                          </div>
                        );
                      })}
                   </div>
                </div>
             </div>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="bg-white border-border/50 shadow-card rounded-3xl p-6">
              <h4 className="text-sm font-bold text-foreground mb-4">Selecione uma Data</h4>
              <Calendar
                 mode="single"
                 selected={targetDate}
                 onSelect={(d) => d && setTargetDate(d)}
                 className="rounded-xl border border-border"
                 locale={ptBR}
                 disabled={(date) => !isAllowedDay(date)}
                 modifiers={{
                   holiday: (day) => isHoliday(day),
                 }}
                 modifiersStyles={{
                   holiday: { border: '2px solid rgb(16 185 129)', fontWeight: 'bold', color: 'rgb(5 150 105)' }
                 }}
              />
           </Card>
           
           <Card className="bg-primary/5 border-primary/10 shadow-sm rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
                    <History className="w-5 h-5" />
                 </div>
                 <h4 className="text-sm font-bold text-primary">Resumo do Dia</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                 Visualize a ocupação programada para qualquer data. Use o calendário para navegar e planejar sua operação.
              </p>
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
                      <th className="px-6 py-4">Preço</th>
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
                              ) : <span className="text-emerald-950">{r.customer_name}</span>}
                           </td>
                           <td className="px-6 py-4">
                              {isEditing ? (
                                <Select value={String(editData.kiosk_id)} onValueChange={v => setEditData({...editData, kiosk_id: parseInt(v)})}>
                                   <SelectTrigger className="h-9 rounded-lg bg-white text-emerald-950 font-bold border-emerald-200"><SelectValue /></SelectTrigger>
                                   <SelectContent className="bg-white border-emerald-200">{KIOSKS.map(k => <SelectItem key={k.id} value={String(k.id)} className="text-emerald-950">{k.name}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold">{KIOSKS.find(k => k.id === Number(r.kiosk_id))?.name || `Q-${r.kiosk_id || '?'}`}</Badge>}
                           </td>
                           <td className="px-6 py-4 font-bold text-primary">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                   <span className="text-xs text-emerald-900 font-bold">R$</span>
                                   <Input type="number" value={editData.price} onChange={e => setEditData({...editData, price: parseFloat(e.target.value)})} className="h-9 rounded-lg w-24 bg-white text-emerald-950 font-bold border-emerald-200" />
                                </div>
                              ) : formatCurrency(r.price || 0)}
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
                              {isEditing ? <Input value={editData.customer_name} onChange={e => setEditData({...editData, customer_name: e.target.value})} className="h-9 bg-white text-emerald-950 font-bold border-blue-200" /> : <span className="text-emerald-950">{r.customer_name}</span>}
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
    <div className="min-h-screen bg-background p-4 md:p-8">
       <div className="max-w-7xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
             <div className="space-y-1">
                <h1 className="text-4xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                   Painel de <span className="text-primary">Controle</span>
                </h1>
                <p className="text-muted-foreground font-medium">Gestão Integrada Balneário Lessa</p>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="outline" className="rounded-2xl border-border bg-white font-bold h-12 shadow-sm" onClick={fetchData} disabled={loading}>
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 text-primary" />}
                   <span className="ml-2">Sincronizar</span>
                </Button>
                <Button className="rounded-2xl bg-foreground text-background font-bold h-12 px-6 shadow-card" onClick={handleLogout}>
                   <LogOut className="w-5 h-5 mr-2" /> Sair
                </Button>
             </div>
          </div>

          {/* TABS */}
          <div className="flex items-center p-1.5 bg-muted/50 rounded-[2rem] w-fit border border-border/50 shadow-inner overflow-hidden">
             <button onClick={() => setActiveTab('painel')} className={cn(
               "px-6 py-3 rounded-[1.5rem] text-sm font-bold flex items-center gap-2 transition-all hover:bg-white/50 active:scale-95", 
               activeTab === 'painel' ? "bg-white text-emerald-600 shadow-lg shadow-emerald-500/10 scale-105" : "text-muted-foreground hover:text-foreground"
             )}>
                <LayoutDashboard className="w-4 h-4" /> Painel
             </button>
             <button onClick={() => setActiveTab('quiosques')} className={cn(
               "px-6 py-3 rounded-[1.5rem] text-sm font-bold flex items-center gap-2 transition-all hover:bg-white/50 active:scale-95", 
               activeTab === 'quiosques' ? "bg-white text-emerald-600 shadow-lg shadow-emerald-500/10 scale-105" : "text-muted-foreground hover:text-foreground"
             )}>
                <Tent className="w-4 h-4" /> Quiosques
             </button>
             <button onClick={() => setActiveTab('quads')} className={cn(
               "px-6 py-3 rounded-[1.5rem] text-sm font-bold flex items-center gap-2 transition-all hover:bg-white/50 active:scale-95", 
               activeTab === 'quads' ? "bg-white text-blue-600 shadow-lg shadow-blue-500/10 scale-105" : "text-muted-foreground hover:text-foreground"
             )}>
                <Bike className="w-4 h-4" /> Quadriciclos
             </button>
             <button onClick={() => setActiveTab('vendas')} className={cn(
               "px-6 py-3 rounded-[1.5rem] text-sm font-bold flex items-center gap-2 transition-all hover:bg-white/50 active:scale-95", 
               activeTab === 'vendas' ? "bg-white text-amber-600 shadow-lg shadow-amber-500/10 scale-105" : "text-muted-foreground hover:text-foreground"
             )}>
                <ShoppingBag className="w-4 h-4" /> Vendas
             </button>
          </div>

          {/* CONTENT */}
          <div className="min-h-[600px]">
             {activeTab === 'painel' && renderDashboard()}
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
