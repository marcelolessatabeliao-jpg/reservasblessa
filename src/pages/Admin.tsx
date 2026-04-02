import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Settings, 
  PieChart, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Search, 
  RefreshCw, 
  LogOut, 
  LayoutDashboard, 
  Tent, 
  Bike, 
  CalendarCheck, 
  ShoppingBag, 
  Trash2,
  User, 
  Phone, 
  CalendarPlus, 
  Tag, 

  FileText, 
  CalendarClock, 
  History, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertTriangle, 
  Pencil, 
  Check, 
  X,
  Loader2,
  DollarSign,
  UserCheck,
  Hash,
  ArrowRight,
  MessageCircle,
  Circle,
  Upload,
  FileCheck,
  HelpCircle,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getQuadDiscount } from '@/lib/booking-types';
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
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, capacity: 'Até 30 pessoas', type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' }
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


const getBookedKioskIds = async (date: string) => {
  const { data } = await supabase.from('kiosk_reservations').select('kiosk_id').eq('reservation_date', date);
  return (data || []).map(r => r.kiosk_id);
};

const getQuadAvailability = async (date: string, time: string) => {
  const { data } = await supabase.from('quad_reservations').select('quantity').eq('reservation_date', date).eq('time_slot', time);
  const used = (data || []).reduce((sum, r) => sum + (Number(r.quantity) || 1), 0);
  return used;
};

const normalizeQuadType = (t: string) => {
  const slow = (t || '').toLowerCase();
  if (slow.includes('dupla')) return 'dupla';
  if (slow.includes('crianca')) return 'adulto-crianca';
  return 'individual';
};

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
  if (isToday(date)) return true;
  const day = date.getDay();
  // 0: Dom, 1: Seg, 5: Sex, 6: Sab
  const isOperating = day === 5 || day === 6 || day === 0 || day === 1;
  return isOperating || isHoliday(date);
};

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [activeTab, setActiveTab] = useState<TabType>('painel');
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [totals, setTotals] = useState({ adults: 0, children: 0 });
  const [loading, setLoading] = useState(false);
  const [kioskSubTab, setKioskSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [quadSubTab, setQuadSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [expandedQuadGroupId, setExpandedQuadGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  // Data States
  const [bookings, setBookings] = useState<any[]>([]);
  const [kioskReservations, setKioskReservations] = useState<any[]>([]);
  const [quadReservations, setQuadReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  // Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{item: any, type: 'kiosk' | 'quad' | 'order' | 'reservas'} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [newBookingData, setNewBookingData] = useState<any>({
    name: '',
    phone: '',
    adults_normal: 1,
    adults_half: 0,
    is_teacher: 0,
    is_student: 0,
    is_server: 0,
    is_donor: 0,
    is_solidarity: 0,
    is_pcd: 0,
    is_tea: 0,
    is_senior: 0,
    is_birthday: 0,
    children_free: 0,
    selected_kiosks: [],
    quads: [],
    manual_discount: 0,
    status: 'pending'
  });
  const [availableKiosks, setAvailableKiosks] = useState<number[]>([]);
  const [quadSlotsAvail, setQuadSlotsAvail] = useState<Record<string, number>>({});
  const [isFetchingAvail, setIsFetchingAvail] = useState(false);

  useEffect(() => {
    if (isNewBookingOpen && newBookingData.visit_date) {
      const fetchAvail = async () => {
        setIsFetchingAvail(true);
        try {
          // Kiosks
          const booked = await getBookedKioskIds(newBookingData.visit_date);
          setAvailableKiosks(Array.from({length: 5}, (_, i) => i + 1).filter(id => !booked.includes(id)));
          
          // Quads slots
          const slots: Record<string, number> = {};
          for (const t of ['09:00', '10:30', '14:00', '15:30']) {
            slots[t] = await getQuadAvailability(newBookingData.visit_date, t);
          }
          setQuadSlotsAvail(slots);
        } catch (e) { console.error(e); }
        finally { setIsFetchingAvail(false); }
      };
      fetchAvail();
    }
  }, [isNewBookingOpen, newBookingData.visit_date]);

  
  // New Rescheduling Dialog States
  const [rescheduleData, setRescheduleData] = useState<{type: 'kiosk' | 'quad', group: any} | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(new Date());

  // History States
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [pixData, setPixData] = useState<{ qrCode: string, payload: string, amount: number, name: string } | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);

  const normalizeString = (str: string) => 
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await getAdminOrders();
      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });
      
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
            
            let orderAdults = 0;
            let orderChildren = 0;

            o.order_items.forEach((item: any) => {
               const pId = (item.product_id || '').toLowerCase();
               const pName = (item.product_name || '').toLowerCase();
               const qty = item.quantity || 1;
               
               // Listas categorizadas para contagem de pessoas
                const adultKeywords = ['adulto', 'solidário', 'solidario', 'professor', 'estudante', 'servidor'];
                const gratuityKeywords = ['criança', 'crianca', 'idoso', 'pcd', 'aniversariante'];

                const isAdult = adultKeywords.some(key => pName.includes(key) || pId.includes(key));
                const isGratuity = gratuityKeywords.some(key => pName.includes(key) || pId.includes(key));

                if (isAdult && !isGratuity) {
                   orderAdults += qty;
                } else if (isGratuity) {
                   orderChildren += qty;
                }
               
               // Only add Kiosks from orders if NOT already in parsedKiosks (via order_id)
               if ((pId.includes('quiosque') || pName.includes('quiosque')) && !parsedKiosks.some(pk => pk.order_id === o.id)) {
                                  // First check metadata
                 let meta = item.metadata;
                 if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch(e) {}
                 }
                 const sIds = meta?.selectedIds || [];

                 for(let i=0; i<item.quantity; i++) {
                   let kioskIdVal: any = (pId.includes('maior') || pName.includes('maior')) ? 1 : 'MENOR';
                   
                   if (sIds.length > i) {
                     kioskIdVal = sIds[i];
                   } else {
                     const match = (pId + ' ' + pName).match(/quiosque\s*(\d+)/i);
                     if (match && match[1]) {
                       kioskIdVal = parseInt(match[1], 10);
                     }
                   }

                   parsedKiosks.push({
                     id: `order-${o.id}-k-${i}`,
                     kiosk_id: kioskIdVal,
                     reservation_date: resDate,
                     customer_name: customerName,
                     price: item.unit_price,
                     order_id: o.id,
                     is_from_order: true
                   });
                 }
               }

               // Only add Quads from orders if NOT already in parsedQuads (via order_id)
               if ((pId.includes('quad') || pName.includes('quad')) && !parsedQuads.some(pq => pq.order_id === o.id)) {
                  // Try to find a time slot (HH:MM or HHhMM) in name or metadata
                  const searchStr = `${pName} ${pId} ${JSON.stringify(item.metadata || {})} ${o.notes || ''}`.toUpperCase();
                  // 1. Try regex (9:00, 09:00, 9H00, etc.)
                  const timeMatch = searchStr.match(/(\d{1,2}[:H]\d{2})/);
                  let finalSlot = null;

                  if (timeMatch) {
                    let raw = timeMatch[1].replace('H', ':');
                    if (raw.length === 4) raw = '0' + raw; // Auto-pad (9:00 -> 09:00)
                    finalSlot = raw;
                  }
                  
                  // 2. Try explicit metadata
                  let meta = item.metadata;
                  if (typeof meta === 'string') {
                     try { meta = JSON.parse(meta); } catch(e) {}
                  }
                  if (!finalSlot && meta?.time) {
                    finalSlot = meta.time;
                    if (finalSlot && finalSlot.length === 4 && finalSlot.includes(':')) finalSlot = '0' + finalSlot;
                  }

                  // 3. Fallback to standard slots list
                  if (!finalSlot) {
                    const standardSlot = QUAD_TIMES.find(t => {
                      const short = t.replace(/^0/, '');
                      return searchStr.includes(t) || searchStr.includes(short);
                    });
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
                     order_id: o.id,
                     is_from_order: true
                  });
               }
            });
            
            // Atribuir contagens extraídas se não estiverem presentes
            o.adults = o.adults || orderAdults;
            o.children = o.children || orderChildren;
         });
      }

      // Merge booking data with order payment info for display
      const flattenedBks = (bks || []).map(b => {
        const order = orderData?.find((o: any) => o.confirmation_code === b.confirmation_code);
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });

      setBookings(flattenedBks);
      setKioskReservations(parsedKiosks);
      setQuadReservations(parsedQuads);
      setOrders(orderData || []);
      
      // Calculate totals for dashboard
      let tAdults = 0;
      let tChildren = 0;
      const adultKeywords = ['adulto', 'solidario', 'professor', 'estudante', 'servidor'];
      const gratuityKeywords = ['crianca', 'kids', 'idoso', 'pcd', 'aniversariante'];

      [...(enrichedBookings || []), ...(orderData || [])].forEach(b => {
        if (b.status === 'confirmed' || b.status === 'paid' || b.status === 'pending') {
          const items = b.order_items || [];
          items.forEach((item: any) => {
            const name = normalizeString(item.product_name || '');
            const qty = Number(item.quantity) || 1;
            const isAdult = adultKeywords.some(k => name.includes(k));
            const isGratuity = gratuityKeywords.some(k => name.includes(k));
            if (isAdult) tAdults += qty;
            else if (isGratuity) tChildren += qty;
            else if (name.includes('entrada')) tAdults += qty;
          });
        }
      });
      setTotals({ adults: tAdults, children: tChildren });

    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    {
      fetchData();
      const channel = supabase.channel("admin_changes").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "kiosk_reservations" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "quad_reservations" }, () => fetchData()).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
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
        payload.order_id = editData.order_id;
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).update(payload).eq('id', editingId);
        if (error) throw error;
      }
      
      toast({ title: "✔ Alterações salvas" });
      setEditingId(null);
      setEditData({});
      await fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: `Erro ao salvar: ${err.message || err.details || 'Erro desconhecido'}`, variant: "destructive" });
    }
  };

  const handleCreateInternalBooking = async () => {
    setLoading(true);
    try {
      const { 
        name, phone, visit_date, 
        adults_normal, adults_half, 
        is_teacher, is_student, is_server, is_donor, is_solidarity, 
        is_pcd, is_tea, is_senior, is_birthday,
        children_free, selected_kiosks, quads, manual_discount, status 
      } = newBookingData;
      
      if (!name || !visit_date) {
        toast({ title: "Nome e Data são obrigatórios", variant: "destructive" });
        return;
      }

      // 1. Calculate Total
      let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
      selected_kiosks.forEach((id: number) => {
        total += (id === 1 ? 100 : 75);
      });
      
      const quadDiscount = getQuadDiscount(visit_date);
      quads.forEach((q: any) => {
        const base = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
        total += (base * (1 - quadDiscount)) * q.quantity;
      });

      total = Math.max(0, total - manual_discount);

      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        adults: adults_normal + adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity + is_pcd + is_tea + is_senior + is_birthday,
        children: Array(children_free).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;

      // 3. Create Order
      const orderItems = [
        { product_name: 'Adulto Integral', quantity: adults_normal, unit_price: 50 },
        { product_name: 'Meia-Entrada', quantity: adults_half, unit_price: 25 },
        { product_name: 'Professor', quantity: is_teacher, unit_price: 25 },
        { product_name: 'Estudante', quantity: is_student, unit_price: 25 },
        { product_name: 'Servidor Público', quantity: is_server, unit_price: 25 },
        { product_name: 'Doador de Sangue', quantity: is_donor, unit_price: 25 },
        { product_name: 'Adulto Solidário', quantity: is_solidarity, unit_price: 25 },
        { product_name: 'PCD', quantity: is_pcd, unit_price: 0 },
        { product_name: 'TEA', quantity: is_tea, unit_price: 0 },
        { product_name: 'Idoso (60+)', quantity: is_senior, unit_price: 0 },
        { product_name: 'Aniversariante', quantity: is_birthday, unit_price: 0 },
        { product_name: 'Criança (Até 11a)', quantity: children_free, unit_price: 0 },
        ...selected_kiosks.map((id: number) => ({ product_name: 'Quiosque ' + id, quantity: 1, unit_price: (id === 1 ? 100 : 75) })),
        ...quads.map((q: any) => ({ product_name: `Quad ${q.type.toUpperCase()} (${q.time})`, quantity: q.quantity, unit_price: (q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150) * (1 - quadDiscount) }))
      ].filter(i => i.quantity > 0);

      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        confirmation_code: booking.confirmation_code,
        order_items: orderItems
      }).select().single();

      if (oError) throw oError;

      // 4. Kiosk Reservations
      if (selected_kiosks.length > 0) {
        await supabase.from('kiosk_reservations').insert(selected_kiosks.map((id: number) => ({
          kiosk_id: id,
          reservation_date: visit_date,
          booking_id: booking.id,
          order_id: order.id,
          status: 'confirmed'
        })));
      }

      // 5. Quad Reservations
      if (quads.length > 0) {
        await supabase.from('quad_reservations').insert(quads.map((q: any) => ({
          quad_type: q.type,
          reservation_date: visit_date,
          time_slot: q.time,
          quantity: q.quantity,
          order_id: order.id
        })));
      }

      toast({ title: "Reserva criada com sucesso!" });
      setIsNewBookingOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao criar reserva", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {
    setIsGeneratingPix(true);
    try {
      const item = isOrder ? orders.find(o => o.id === bookingId) : bookings.find(b => b.id === bookingId);
      if (!item) throw new Error("Reserva não encontrada");

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: bookingId, 
          billingType: 'PIX',
          customer: {
            name: item.name || item.customer_name,
            phone: item.phone || item.customer_phone
          }
        }
      });

      if (error) throw error;
      if (data && data.encodedImage) {
        setPixData({
          qrCode: data.encodedImage,
          payload: data.payload,
          amount: item.total_amount,
          name: item.name || item.customer_name
        });
      } else {
        throw new Error("Erro ao gerar QR Code");
      }
    } catch (err: any) {
      console.error('Pix generation error:', err);
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;
      if (status === 'checked-in' && isOrder) {
        await supabase.from('order_items').update({ is_redeemed: true }).eq('order_id', bookingId);
      }
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
      toast({ title: "âœ“ Nota adicionada" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao adicionar nota", variant: "destructive" });
    } finally { setUpdatingId(null); }
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
    setItemToDelete({ item, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { item, type } = itemToDelete;
    
    setLoading(true);
    try {
      let table = '';
      if (type === 'kiosk') table = 'kiosk_reservations';
      else if (type === 'quad') table = 'quad_reservations';
      else if (type === 'order') table = 'orders';
      else if (type === 'reservas') table = 'bookings';

      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      
      toast({ title: "Removido com sucesso" });
      fetchData();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleData || !rescheduleDate) return;
    const { type, group } = rescheduleData;
    const newDateStr = format(rescheduleDate, 'yyyy-MM-dd');
    
    setLoading(true);
    try {
      const table = type === 'kiosk' ? 'kiosk_reservations' : 'quad_reservations';
      const results = await Promise.all(group.items.map((r: any) =>
        supabase.from(table).update({ reservation_date: newDateStr }).eq('id', r.id)
      ));
      
      const hasError = results.some(r => r.error);
      if (hasError) throw new Error('Algumas atualizações falharam');
      
      toast({ title: 'âœ“ Reagendado com sucesso' });
      fetchData();
      setRescheduleData(null);
    } catch (err) {
      console.error('Reschedule error:', err);
      toast({ title: 'Erro ao reagendar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // --- GROUPING & FILTERING ---
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const currentKiosks = (kioskReservations || []).filter(r => !isBefore(parseISO(r.reservation_date), startOfDay(new Date())));
  const pastKiosks = (kioskReservations || []).filter(r => isBefore(parseISO(r.reservation_date), startOfDay(new Date())));

  const currentQuads = (quadReservations || []).filter(r => !isBefore(parseISO(r.reservation_date), startOfDay(new Date())));
  const pastQuads = (quadReservations || []).filter(r => isBefore(parseISO(r.reservation_date), startOfDay(new Date())));

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

 
  const handleKioskFileUpload = async (file: File, resId: string) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      
      const isOrder = resId.toString().startsWith('order-');
      if (isOrder) {
         // It's a virtual reservation from an order, we might need to update the order instead or just toast
         toast({ title: "Esta é uma reserva de pedido. O comprovante deve ser anexado ao pedido na aba Reservas." });
      } else {
         const { error: updateError } = await supabase.from('kiosk_reservations').update({ receipt_url: publicUrl }).eq('id', resId);
         if (updateError) throw updateError;
         toast({ title: "Comprovante salvo!" });
         fetchData();
      }
    } catch (err) { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };

  const handleQuadFileUpload = async (file: File, resId: string) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      
      const isOrder = resId.toString().startsWith('order-');
      if (isOrder) {
         toast({ title: "Esta é uma reserva de pedido. O comprovante deve ser anexado ao pedido na aba Reservas." });
      } else {
         const { error: updateError } = await supabase.from('quad_reservations').update({ receipt_url: publicUrl }).eq('id', resId);
         if (updateError) throw updateError;
         toast({ title: "Comprovante salvo!" });
         fetchData();
      }
    } catch (err) { toast({ title: "Erro no upload", variant: "destructive" }); }
    finally { setIsUploading(false); }
  };

  const renderDashboard = () => {
    const dayKiosks = (kioskReservations || []).filter(r => {
      try {
        const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
        return d === format(targetDate, 'yyyy-MM-dd');
      } catch { return false; }
    });
    
    const dayQuads = (quadReservations || []).filter(r => {
      try {
        const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
        return d === format(targetDate, 'yyyy-MM-dd');
      } catch { return false; }
    });

    const dayBookings = bookings.filter(b => b.visit_date === format(targetDate, 'yyyy-MM-dd'));
    
    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      
      // BROADENED KIOSK DETECTION
      bItems.forEach(item => {
        const pNameLower = (item.product_name || '').toLowerCase();
        if (pNameLower.includes('quiosque') || pNameLower.includes('camping')) {
           // Extract numeric ID from "Quiosque 04" or similar
           const kioskIdMatch = pNameLower.match(/quiosques*(d+)/i);
           const kId = kioskIdMatch ? parseInt(kioskIdMatch[1], 10) : (pNameLower.includes('maior') ? 1 : 'MENOR');

           if (!dayKiosks.some(dk => dk.id === b.id && dk.kiosk_id === kId)) {
              dayKiosks.push({
                 id: b.id + '-' + item.id,
                 kiosk_id: kId,
                 customer_name: b.name || 'Cliente (Interno)',
                 reservation_date: b.visit_date,
                 status: b.status
              });
           }
        }
      });
      
      // BROADENED QUAD DETECTION
      // Manual bookings use "Passeio" keywords instead of "Quadri"
      const quadKeywords = ['quadri', 'passeio', 'quadriciclo'];
      const quadItems = bItems.filter(i => quadKeywords.some(k => (i.product_name || '').toLowerCase().includes(k)));
      
      quadItems.forEach(qi => {
         const qiId = b.id + '-' + qi.id;
         if (!dayQuads.some(dq => dq.id === qiId)) {
            dayQuads.push({
               id: qiId,
               customer_name: b.name || 'Cliente (Interno)',
               reservation_date: b.visit_date,
               time_slot: b.quad_time_slot || '10:30',
               quantity: qi.quantity || 1,
               status: b.status
            });
         }
      });
    });
    const dayOrders = orders.filter(o => (o.visit_date || o.created_at.split('T')[0]) === format(targetDate, 'yyyy-MM-dd'));
    
    return (
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 animate-in fade-in duration-500">
        <div className="space-y-8">

          <Card className="bg-transparent border-none text-emerald-950 shadow-none p-0">
             
             <div className="rounded-[1.5rem] border-2 border-amber-300 bg-amber-100/50 overflow-hidden mb-0 shadow-lg backdrop-blur-sm">
                <div className="p-3 md:p-5 border-b border-amber-300 flex flex-col md:flex-row md:items-center gap-4">
                   <div className="flex items-center gap-4 border-r-0 md:border-r border-amber-300/50 pr-4">
                      <div className="w-12 h-12 bg-emerald-800 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md border-2 border-emerald-400/30">
                         {targetDate.getDate()}
                      </div>
                      <div>
                         <h3 className="text-[16px] font-black text-emerald-950 tracking-tight leading-none mb-1">Operação Diária</h3>
                         <p className="text-[11px] font-black text-emerald-950 uppercase tracking-tighter">{format(targetDate, "EEEE, yyyy", { locale: ptBR })}</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <HelpCircle className="w-4 h-4 text-amber-800" />
                     <h4 className="font-black text-amber-950 text-sm tracking-tight text-shadow-sm">Resumo de {format(targetDate, "dd 'de' MMMM", { locale: ptBR })}</h4>
                   </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2">
                   {/* Left: Quiosques */}
                   <div className="p-4 md:p-8 border-b xl:border-b-0 xl:border-r border-amber-300 bg-emerald-100/40 space-y-6">
                      <h4 className="text-[14px] font-black text-emerald-800 flex items-center gap-3">
                         <Users className="w-5 h-5 text-emerald-700" /> Quiosques ({dayKiosks.length}/5)
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
                          <div key={k.id} className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between group hover:bg-emerald-800 transition-all cursor-default">
                             <span className="font-black text-emerald-950 text-[13px] group-hover:text-white transition-colors">{k.name}</span>
                             {booking ? (
                               <span className="text-emerald-700 font-bold italic text-[13px] text-right group-hover:text-emerald-100 transition-colors">
                                  {booking.customer_name}
                               </span>
                             ) : (
                               <span className="text-emerald-800/80 italic font-bold text-[13px] group-hover:text-emerald-200/50 transition-colors">Livre</span>
                             )}
                          </div>
                        );
                      })}
                   </div>
                   </div>

                   {/* Right: Quadriciclos */}
                   <div className="p-4 md:p-8 bg-blue-100/30 space-y-6">
                      <h4 className="text-[14px] font-black text-blue-800 flex items-center gap-3">
                         <Bike className="w-5 h-5 text-blue-700" /> Quadriciclos
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
                                       <Badge key={bi} className="bg-transparent text-blue-700/80 font-bold italic lowercase text-[11px] px-2 py-0 border-0 shadow-none hover:bg-blue-600 hover:text-white hover:opacity-100 transition-all cursor-default">
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
             <div className="p-3 md:p-5 border-t border-amber-300 bg-amber-100/60 flex items-center justify-center text-center">
                <p className="text-amber-900 font-black uppercase tracking-[0.1em] text-[11px]">
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
                    toDate={new Date(2030, 11, 31)}
                    fromDate={new Date(2024, 0, 1)}
                    disabled={(date) => !isAllowedDay(date)}
                    classNames={{
                      months: "w-full flex flex-col",
                      month: "w-full space-y-6",
                      caption: "relative flex items-center justify-between w-full h-14 bg-emerald-800 rounded-2xl border-2 border-emerald-900 shadow-xl mb-4 px-3",
                      caption_label: "text-[10px] md:text-[12px] font-black text-white uppercase tracking-[0.2em] flex-1 text-center",
                      nav: "absolute inset-x-0 inset-y-0 flex items-center justify-between px-2 pointer-events-none z-30",
                      nav_button: "h-7 w-7 md:h-9 md:w-9 bg-emerald-500 text-white border border-emerald-400 hover:bg-emerald-400 shadow-lg rounded-[0.5rem] transition-all pointer-events-auto flex items-center justify-center",
                      nav_button_previous: "relative",
                      nav_button_next: "relative",
                      table: "w-full border-collapse table-fixed",
                      head_cell: "text-emerald-900 font-extrabold text-[10px] md:text-[11px] uppercase tracking-[0.1em] md:tracking-[0.2em] w-[14.28%] py-4 text-center",
                      cell: "h-10 md:h-14 w-[14.28%] text-center p-0 relative focus-within:z-20",
                      day: cn(
                        "h-12 w-12 p-0 font-black text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto",
                        "flex flex-col items-center justify-center gap-1"
                      ),
                      day_selected: "bg-emerald-800 !text-white hover:bg-emerald-700 border-emerald-800 shadow-xl shadow-emerald-900/30 !opacity-100 rounded-full",
                      day_today: "bg-yellow-400 text-emerald-950 border-yellow-500 shadow-lg font-black ring-2 ring-yellow-200 ring-offset-2 rounded-full",
                      day_outside: "text-emerald-900/60 font-bold opacity-50 bg-transparent shadow-none border-transparent",
                    }}
                    components={{
                      DayContent: ({ date }) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                        const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                        
                        // Availability logic
                        const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                        const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= 20;
                        const isDayToday = isToday(date);
                        const isFull = kiosksFull && quadsFull;

                        return (
                          <div className={cn("relative flex flex-col items-center rounded-full w-full h-full justify-center transition-all", isFull && "bg-red-50/50 border border-red-100")}>
                            <span className={cn(isDayToday ? "text-emerald-950 font-black" : "font-black", isFull && "text-red-600")}>{date.getDate()}</span>
                            <div className="flex gap-1 mt-0.5">
                              {hasKiosk && <div className={cn("w-2 h-2 rounded-full shadow-md border border-white/40", kiosksFull ? "bg-red-600" : "bg-emerald-600")} />}
                              {hasQuad && <div className={cn("w-2 h-2 rounded-full shadow-md border border-white/40", quadsFull ? "bg-red-600" : "bg-blue-600")} />}
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
        </div>
      </div>
    );
  };

  const renderKioskTab = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const allGroups = Object.values((kioskReservations || []).reduce((acc, curr) => {
      const key = `${curr.reservation_date}_${curr.customer_name || 'Venda'}`;
      if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Venda', items: [], total_price: 0 };
      acc[key].items.push(curr);
      acc[key].total_price += (curr.price || (KIOSKS.find(k => k.id === Number(curr.kiosk_id))?.price || 75));
      return acc;
    }, {} as Record<string, any>));

    const groupsByTab: Record<string, any[]> = {
      hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
      futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
      historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
    };
    const tabGroups = groupsByTab[kioskSubTab];

    const resolveGroup = (group: any) => {
      const dayKiosks = (kioskReservations || []).filter(k => k.reservation_date === group.reservation_date);
      const resolved = group.items.map((r: any) => {
        const bid = r.kiosk_id;
        if (bid === 1 || bid === '1' || bid === 'MAIOR') return KIOSKS.find(k => k.id === 1);
        if (bid === 'MENOR') {
          const menors = dayKiosks.filter(dk => dk.kiosk_id === 'MENOR');
          const idx = menors.findIndex(dk => dk.id === r.id);
          return KIOSKS.find(k => k.id === idx + 2) || { id: 99, name: 'Quiosque Extra', capacity: 'Até 15 pessoas' };
        }
        return KIOSKS.find(k => k.id === Number(bid)) || { id: 99, name: `Q-${bid}`, capacity: 'Até 15 pessoas' };
      });
      const names = resolved.map((k: any) => k?.name.replace('Quiosque ', 'Q-')).join(', ');
      const capacity = resolved.reduce((s: number, k: any) => s + parseInt((k?.capacity || '0').replace(/\D/g, '') || '15'), 0);
      return { names, capacity };
    };

    const subTabConfig = [
      { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-emerald-600 text-white' },
      { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
      { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-primary">Reservas de Quiosques</h3>
                <p className="text-xs text-muted-foreground">Gerencie todas as reservas por status</p>
              </div>
              <div className="grid grid-cols-2 md:flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setKioskSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                      kioskSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',
                      t.key === 'historico' && 'col-span-2 md:col-auto'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', kioskSubTab === t.key ? 'bg-white/30' : 'bg-slate-200')}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
              {tabGroups.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
              ) : (
                tabGroups.map((group: any) => {
                  const { names } = resolveGroup(group);
                  const isToday = group.reservation_date === todayStr;
                  return (
                    <div key={group.group_key} className="bg-white rounded-2xl border-2 border-emerald-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                      <div className={cn("p-4 border-b border-emerald-100 flex justify-between items-center", isToday ? "bg-emerald-50" : "bg-white")}>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Data da Visita</span>
                            <span className="font-black text-emerald-900">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                         </div>
                         {isToday && <span className="bg-emerald-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm">Hoje</span>}
                      </div>
                      <div className="p-4 space-y-3">
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Cliente</span>
                            <span className="font-black text-emerald-950 uppercase text-sm block">{group.customer_name}</span>
                            <span className="text-[10px] text-emerald-700 font-bold">{group.items.length} reserva(s) • {formatCurrency(group.total_price)}</span>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Quiosques</span>
                            <div className="flex flex-wrap gap-1.5">
                               {(names.split(', ') as string[]).map((n, i) => (
                                 <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black border border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors">{n}</span>
                               ))}
                            </div>
                         </div>
                         <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-50">
                            {group.items.some((r: any) => r.receipt_url) && (
                               <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                 <FileText className="w-4 h-4 mr-2" /> Recibo
                               </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl" onClick={() => {setRescheduleData({ type: 'kiosk', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 bg-red-50 rounded-xl" onClick={() => requestDelete(group.items[0], 'kiosk')}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              {tabGroups.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                  {kioskSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : kioskSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-[#0b2b24] text-[10px] font-black uppercase text-emerald-100/80 tracking-widest border-b-4 border-emerald-900">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Quiosques / Capacidade</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {tabGroups.map((group: any) => {
                      const { names } = resolveGroup(group);
                      const isToday = group.reservation_date === todayStr;
                      return (
                        <tr key={group.group_key} className={cn(
                          'border-b-2 border-slate-100 transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:z-10 relative cursor-pointer',
                          isToday ? 'bg-emerald-50/50 hover:bg-emerald-100' : 'bg-slate-50 hover:bg-white'
                        )}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1.5 w-fit">
                              <span className={cn('font-black text-sm px-3 py-1 rounded-lg border', isToday ? 'text-emerald-900 border-emerald-200 bg-white shadow-sm' : 'text-slate-700 border-slate-200 bg-white')}>
                                {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                              </span>
                              {isToday && <span className="text-[9px] bg-emerald-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit mx-auto shadow-sm">HOJE</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-slate-900 uppercase text-base">{group.customer_name}</span>
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">{group.items.length} reserva(s)</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-emerald-100 text-emerald-900 border-2 border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors font-bold px-3 py-1 shadow-sm">{names}</Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-black text-lg text-emerald-700">{formatCurrency(group.total_price)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {group.items.some((r: any) => r.receipt_url) && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Reagendar"
                                onClick={() => {
                                  setRescheduleData({ type: 'kiosk', group });
                                  setRescheduleDate(parseISO(group.reservation_date));
                                }}
                              ><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => requestDelete(group.items[0], 'kiosk')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuadTab = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    // Group by date + customer (ignoring timeslot to allow expansion)
    const allGroups = Object.values((quadReservations || []).reduce((acc, curr) => {
      const key = `${curr.reservation_date}_${curr.customer_name || 'Venda'}`;
      if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Cliente', items: [], total_price: 0, total_quantity: 0 };
      acc[key].items.push(curr);
      acc[key].total_price += (curr.price || 0);
      acc[key].total_quantity += (Number(curr.quantity) || 1);
      return acc;
    }, {} as Record<string, any>));

    const groupsByTab: Record<string, any[]> = {
      hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
      futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
      historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
    };
    const tabGroups = groupsByTab[quadSubTab];

    const subTabConfig = [
      { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-blue-600 text-white' },
      { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
      { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-200 bg-blue-50/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-blue-950">Reservas de Quadriciclos</h3>
                <p className="text-xs text-blue-900 font-bold">Clique em um grupo para ver os horários</p>
              </div>
              <div className="grid grid-cols-2 md:flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setQuadSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                      quadSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',
                      t.key === 'historico' && 'col-span-2 md:col-auto'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', quadSubTab === t.key ? 'bg-white/30' : 'bg-slate-200')}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-blue-50/30">
               {tabGroups.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
               ) : (
                 tabGroups.map((group: any) => {
                   const isExpanded = expandedQuadGroupId === group.group_key;
                   const isToday = group.reservation_date === todayStr;
                   const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual')));
                   
                   return (
                     <div key={group.group_key} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden box-border">
                        <div className={cn("p-4 flex justify-between items-center cursor-pointer", isToday ? "bg-blue-50/50" : "bg-white")} onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest">Cliente</span>
                              <span className="font-black text-blue-950 uppercase">{group.customer_name}</span>
                              <span className="text-[10px] font-bold text-blue-800">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              {isToday && <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Hoje</span>}
                              <ChevronDown className={cn('w-5 h-5 text-blue-400 transition-transform', isExpanded && 'rotate-180')} />
                           </div>
                        </div>
                        
                        {isExpanded && (
                           <div className="p-4 bg-blue-50/30 border-t border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Modelos</span>
                                    <div className="flex flex-wrap gap-1">
                                       {(uniqueModels as string[]).map((m, i) => <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded text-[9px] font-black">{m}</span>)}
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Total</span>
                                    <span className="font-black text-blue-900 text-xs">{formatCurrency(group.total_price)}</span>
                                 </div>
                              </div>
                              
                              <div className="space-y-2">
                                 <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Horários Reservados</span>
                                 {group.items.map((r: any, i: number) => (
                                   <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                      <div className="flex items-center gap-2">
                                         <Clock className="w-3.5 h-3.5 text-blue-500" />
                                         <span className="text-[11px] font-black text-blue-900">{r.time_slot}</span>
                                         <span className="text-[10px] font-bold text-blue-600/60">• {QUAD_MODELS_LABELS[r.quad_type] || 'Individual'}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-blue-900">{r.quantity} un.</span>
                                   </div>
                                 ))}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2">
                                 {group.items.some((r: any) => r.receipt_url) && (
                                   <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                     <FileText className="w-4 h-4" />
                                   </Button>
                                 )}
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => {setRescheduleData({ type: 'quad', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 bg-red-50 rounded-lg" onClick={() => requestDelete(group.items[0], 'quad')}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                           </div>
                        )}
                     </div>
                   );
                 })
               )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              {tabGroups.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                  {quadSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : quadSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-[#0f172a] text-[10px] font-black uppercase text-blue-100/80 tracking-widest border-b-4 border-blue-900">
                    <tr>
                      <th className="px-6 py-4 w-8"></th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Modelos</th>
                      <th className="px-6 py-4 text-center">Total Quadriciclos</th>
                      <th className="px-6 py-4">Valor Total</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {tabGroups.map((group: any) => {
                      const isExpanded = expandedQuadGroupId === group.group_key;
                      const isToday = group.reservation_date === todayStr;
                      const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual'))] || 'Individual')));

                      return (
                        <React.Fragment key={group.group_key}>
                          <tr
                            className={cn(
                              'border-b-2 border-slate-100 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:z-10 relative',
                              isToday ? 'bg-blue-50/40 hover:bg-blue-100/60' : 'bg-slate-50 hover:bg-white',
                              isExpanded && 'bg-blue-100/40 border-blue-300'
                            )}
                            onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}
                          >
                            <td className="px-4 py-4 text-center">
                              <ChevronDown className={cn('w-4 h-4 text-blue-600 transition-transform', isExpanded && 'rotate-180')} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5 w-fit">
                                <span className={cn('font-black text-sm px-3 py-1 rounded-lg border', isToday ? 'text-blue-900 border-blue-200 bg-white shadow-sm' : 'text-slate-700 border-slate-200 bg-white')}>
                                  {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                                </span>
                                {isToday && <span className="text-[9px] bg-blue-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit mx-auto shadow-sm">HOJE</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-black text-slate-900 uppercase text-base">{group.customer_name}</span>
                              <div className="text-[10px] text-slate-500 font-bold mt-0.5">{group.items.length} horário(s) reservado(s)</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {(uniqueModels as string[]).map((m, i) => (
                                  <Badge key={i} variant="outline" className="border-indigo-200 text-indigo-900 font-bold bg-indigo-50/80 px-2 py-0.5 text-[10px]">{m}</Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge className="bg-blue-100 text-blue-950 border-2 border-blue-200 shadow-sm font-black px-3 py-1">{group.total_quantity} quadriciclos</Badge>
                            </td>
                            <td className="px-6 py-4 font-black text-lg text-blue-800">{formatCurrency(group.total_price)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                {group.items.some((r: any) => r.receipt_url) && (
                                  <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all shadow-sm rounded-xl" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Reagendar"
                                  onClick={() => {
                                    setRescheduleData({ type: 'quad', group });
                                    setRescheduleDate(parseISO(group.reservation_date));
                                  }}
                                ><CalendarClock className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => requestDelete(group.items[0], 'quad')}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && group.items.map((r: any, idx: number) => {
                            const isEditing = editingId === r.id;
                            return (
                              <tr key={r.id} className={cn("bg-blue-50/30 border-b border-blue-100 transition-all", isEditing ? "bg-amber-50/40" : "")}>
                                <td className="px-4 py-2"></td>
                                <td className="px-6 py-2">
                                  {isEditing ? (
                                    <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                       <SelectTrigger className="h-8 text-[11px] font-black w-32 border-blue-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          {QUAD_TIMES.map(t => <SelectItem key={t} value={t} className="text-[11px] font-bold">{t}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className={cn(
                                      'text-[10px] font-black uppercase px-2 py-0.5 rounded-md w-fit inline-block border flex items-center gap-1.5 shadow-sm',
                                      (r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                    )}>
                                      {(r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') ? (
                                        <>
                                          <AlertTriangle className="w-3 h-3" />
                                          {r.time_slot === 'INDIV' ? 'HORÁRIO NÃƒO DEFINIDO' : 'DUPLA (AGUARDANDO)'}
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="w-3 h-3" />
                                          {r.time_slot}
                                        </>
                                      )}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-[11px] text-blue-700/60 font-black uppercase tracking-wider">Item #{idx + 1}</td>
                                <td className="px-6 py-2">
                                  {isEditing ? (
                                    <div className="flex flex-col gap-1 w-32">
                                      <Select value={editData.quad_type || 'individual'} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                         <SelectTrigger className="h-7 text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                            {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-bold text-blue-800">Qtd:</span>
                                        <input type="number" min="1" max="20" className="w-16 h-7 text-[11px] font-black border border-blue-200 rounded px-2" value={editData.quantity || 1} onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})} />
                                      </div>

                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] border-blue-100 text-blue-700 bg-white/50 font-black tracking-widest px-2">
                                      {QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual'}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-center">
                                  {isEditing ? (
                                    <input
                                      type="number" min="1" max="20"
                                      className="w-16 h-8 text-[12px] font-black border-2 border-blue-300 rounded-lg px-2 text-center bg-white shadow-sm"
                                      value={editData.quantity ?? r.quantity ?? 1}
                                      onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})}
                                    />
                                  ) : (
                                    <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-[11px] font-extrabold text-blue-700">{formatCurrency(r.price || 0)}</td>
                                <td className="px-6 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isEditing ? (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200" onClick={() => saveEditing('quad')}>
                                          <Check className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 bg-white hover:bg-slate-100 border border-slate-200" onClick={cancelEditing}>
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 flex items-center justify-center" onClick={(e: any) => { e.stopPropagation(); startEditing(r); }}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100" onClick={(e: any) => { e.stopPropagation(); requestDelete(r, 'quad'); }}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                {(orders || []).map(order => (
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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900 via-slate-950 to-black bg-fixed overflow-x-hidden">
       {/* Ambient Glows */}
       <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full" />
       <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />

       <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 relative z-10 p-3 md:p-8">
          {/* HEADER */}
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-4">
              <div className="flex items-start justify-between w-full xl:w-auto">
                 <div className="space-y-2 shrink-0">
                     <h1 className="text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-4">
                          <div className="flex flex-col -space-y-1 md:-space-y-1 md:-space-y-2">
                             <span className="text-xl md:text-xl md:text-2xl text-[#FFF033]/80 leading-none shadow-sm">Lessa</span>
                             <span className="text-4xl md:text-4xl md:text-5xl text-[#FFF033] shadow-md">Painel</span>
                          </div>
                       </h1>
                     <p className="text-[#FFF033] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[8px] md:text-[10px] bg-[#FFF033]/10 w-fit px-3 py-1 rounded-full border border-[#FFF033]/30 backdrop-blur-sm">Gestão Integrada de Reservas • Balneário</p>
                 </div>

                 {/* MOBILE BUTTONS (TOP RIGHT) */}
                 <div className="flex xl:hidden items-center gap-2">
                    <Button 
                      variant="outline"
                      className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 p-0 hover:bg-white/20 text-[#FFF033] shadow-lg backdrop-blur-md transition-all active:scale-95 flex items-center justify-center" 
                      onClick={fetchData} 
                      disabled={loading}
                    >
                       {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    </Button>

                    <Button 
                      className="w-10 h-10 rounded-xl bg-[#FFF033] text-black p-0 shadow-lg hover:scale-105 active:scale-95 transition-all border-0 flex items-center justify-center" 
                      onClick={handleLogout}
                    >
                       <LogOut className="w-5 h-5" />
                    </Button>
                 </div>
              </div>

              {/* STATS IN HEADER */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 flex-1 px-0 md:px-4">
                 <Card onClick={() => setActiveTab('quiosques')} className="cursor-pointer bg-emerald-900 border-2 border-emerald-500 shadow-xl rounded-2xl p-2 md:p-3 flex items-center justify-between hover:bg-bg-emerald-900 transition-all group overflow-hidden relative min-h-[60px] md:h-[65px]">
                    <div className="flex items-center gap-2 relative z-10">
                       <div className="p-1 px-2 rounded-lg bg-emerald-800 text-emerald-100 border border-emerald-700/50">
                          <Tent className="w-3.5 h-3.5" />
                       </div>
                       <div className="flex flex-col -space-y-0.5">
                          <span className="text-sm md:text-base font-black tabular-nums text-[#FFF033]">{(kioskReservations || []).filter(r => r.reservation_date === format(targetDate, 'yyyy-MM-dd')).length}</span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-emerald-200">Quiosques</span>
                       </div>
                    </div>
                 </Card>
                 
                 <Card onClick={() => setActiveTab('quads')} className="cursor-pointer bg-blue-900 border-2 border-blue-500 shadow-xl rounded-2xl p-2 md:p-3 flex items-center justify-between hover:bg-bg-blue-900 transition-all group overflow-hidden relative min-h-[60px] md:h-[65px]">
                    <div className="flex items-center gap-2 relative z-10">
                       <div className="p-1 px-2 rounded-lg bg-blue-800 text-blue-100 border border-blue-700/50">
                          <Bike className="w-3.5 h-3.5" />
                       </div>
                       <div className="flex flex-col -space-y-0.5">
                          <span className="text-sm md:text-base font-black tabular-nums text-[#FFF033]">{(quadReservations || []).filter(r => r.reservation_date === format(targetDate, 'yyyy-MM-dd')).length}</span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-blue-200">Quadriciclos</span>
                       </div>
                    </div>
                 </Card>
                 
                 <Card onClick={() => setActiveTab('vendas')} className="cursor-pointer bg-slate-900 border-2 border-[#FFF033]/50 shadow-xl rounded-2xl p-2 flex items-center justify-between hover:bg-black transition-all group overflow-hidden relative h-[65px]">
                    <div className="flex items-center gap-2 relative z-10">
                       <div className="p-1 px-2 rounded-lg bg-yellow-500/10 text-[#FFF033] border border-[#FFF033]/30">
                          <TrendingUp className="w-3.5 h-3.5" />
                       </div>
                       <div className="flex flex-col -space-y-0.5">
                          <span className="text-sm md:text-base font-black tabular-nums text-[#FFF033]">
                            {formatCurrency(
                               (bookings.filter(b => b.visit_date === format(targetDate, 'yyyy-MM-dd')).reduce((s, b) => b.status !== 'cancelled' ? s + (b.total_amount || 0) : s, 0)) + 
                               (orders.filter(o => (o.visit_date || o.created_at.split('T')[0]) === format(targetDate, 'yyyy-MM-dd')).reduce((s, o) => o.status !== 'cancelled' ? s + (o.total_amount || 0) : s, 0))
                            ).replace('R$', '').trim()}
                          </span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-[#FFF033]/70">Receita Dia</span>
                       </div>
                    </div>
                 </Card>

                 <Card onClick={() => setActiveTab('reservas')} className="cursor-pointer bg-amber-900 border-2 border-amber-500 shadow-xl rounded-2xl p-2 md:p-3 flex items-center justify-between hover:bg-bg-amber-900 transition-all group overflow-hidden relative min-h-[60px] md:h-[65px]">
                    <div className="flex items-center gap-2 relative z-10">
                       <div className="p-1 px-2 rounded-lg bg-amber-800 text-amber-100 border border-amber-700/50">
                          <CalendarCheck className="w-3.5 h-3.5" />
                       </div>
                       <div className="flex flex-col -space-y-0.5">
                          <span className="text-sm md:text-base font-black tabular-nums text-[#FFF033]">{bookings.length + orders.length}</span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-amber-200">Agenda</span>
                       </div>
                    </div>
                 </Card>
              </div>

              {/* DESKTOP BUTTONS (RIGHT) */}
              <div className="hidden xl:flex items-center gap-4 shrink-0">
                 <Button 
                   variant="outline"
                   className="rounded-2xl bg-white/10 border-2 border-white/20 font-black h-12 px-6 hover:bg-white/20 text-[#FFF033] flex items-center justify-center shadow-xl backdrop-blur-md transition-all active:scale-95" 
                   onClick={fetchData} 
                   disabled={loading}
                 >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                    
                 </Button>

                 <Button 
                   className="rounded-2xl bg-[#FFF033] text-black font-black h-12 px-4 shadow-2xl hover:scale-105 active:scale-95 transition-all border-0 text-base flex items-center justify-center" 
                   onClick={handleLogout}
                 >
                    <LogOut className="w-5 h-5 mr-2" /> 
                 </Button>
              </div>
          </div>
          {/* TABS */}
          <div className="flex flex-wrap items-center p-2 md:p-3 bg-emerald-950/60 backdrop-blur-xl rounded-2xl md:rounded-3xl w-full max-w-5xl mr-auto border border-white/20 shadow-premium mb-6 gap-1.5 md:gap-2">
             <button onClick={() => setActiveTab('painel')} className={cn(
               "px-4 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'painel' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <LayoutDashboard className="w-4 h-4 md:w-4.5 md:h-4.5" /> Visão Geral
             </button>
             <button onClick={() => setActiveTab('quiosques')} className={cn(
               "px-4 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'quiosques' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <Tent className="w-4 h-4 md:w-4.5 md:h-4.5" /> Quiosques
             </button>
             <button onClick={() => setActiveTab('quads')} className={cn(
               "px-4 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'quads' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <Bike className="w-4 h-4 md:w-4.5 md:h-4.5" /> Quadriciclos
             </button>
             <button onClick={() => setActiveTab('reservas')} className={cn(
               "px-4 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'reservas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <CalendarCheck className="w-4 h-4 md:w-4.5 md:h-4.5" /> Agenda
             </button>
             <button onClick={() => setActiveTab('vendas')} className={cn(
               "hidden lg:flex lg:flex-1 px-4 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", 
               activeTab === 'vendas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <ShoppingBag className="w-4 h-4 md:w-4.5 md:h-4.5" /> Vendas
             </button>

             <button onClick={() => setIsNewBookingOpen(true)} className="hidden lg:flex px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-500 shadow-md ml-auto">
                <span className="text-lg leading-none">+</span> Nova Reserva
             </button>

             
             
          </div>

          {/* CONTENT AREA WITH GRADIENT BACKGROUND */}
          <div className="min-h-[500px] md:min-h-[600px] bg-white/40 backdrop-blur-md rounded-2xl md:rounded-[3rem] p-4 md:p-8 border border-white/60 shadow-premium">
             {activeTab === 'painel' && renderDashboard()}
             {activeTab === 'reservas' && (
               <div className="space-y-6">
                 <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-100 group-hover:text-white transition-colors" />
                      <Input 
                        placeholder="Filtrar por nome, telefone ou código..." 
                        className="pl-11 h-14 rounded-2xl bg-emerald-600 shadow-lg border-2 border-emerald-700 font-extrabold text-white placeholder:text-emerald-100 focus-visible:ring-emerald-400 text-lg transition-all hover:bg-emerald-700 hover:border-emerald-500" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                      />
                    </div>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-14 px-6 rounded-2xl bg-emerald-600 shadow-lg border-2 border-emerald-700 font-black text-white hover:bg-emerald-700 hover:border-emerald-500 transition-all gap-3 text-lg justify-start min-w-[240px]",
                            !filterDate && "text-emerald-100"
                          )}
                        >
                          <CalendarIcon className="w-5 h-5 text-emerald-100" />
                          {filterDate ? format(parseISO(filterDate), 'dd/MM/yyyy', { locale: ptBR }) : "Filtrar por Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden border-2 border-emerald-100 shadow-2xl" align="end">
                        <Calendar
                          mode="single"
                          selected={filterDate ? parseISO(filterDate) : undefined}
                          onSelect={(date) => setFilterDate(date ? format(date, 'yyyy-MM-dd') : '')}
                          locale={ptBR}
                          className="p-4"
                          toDate={new Date(2030, 11, 31)}
                          fromDate={new Date(2024, 0, 1)}
                          disabled={(date) => !isAllowedDay(date)}
                          classNames={{
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center mb-2 bg-emerald-800 rounded-xl py-3 border-2 border-emerald-900 shadow-lg w-full",
                            caption_label: "text-sm font-black text-white uppercase tracking-widest",
                            nav: "flex items-center justify-between absolute inset-x-0 inset-y-0 px-4 pointer-events-none z-30",
                            nav_button: "h-8 w-8 bg-emerald-500 text-white border border-emerald-400 hover:bg-emerald-400 shadow-md rounded-lg transition-all pointer-events-auto flex items-center justify-center",
                            nav_button_previous: "relative left-0",
                            nav_button_next: "relative right-0",
                          }}
                          components={{
                            DayContent: ({ date }) => {
                              const dateStr = format(date, 'yyyy-MM-dd');
                              const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                              const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                              const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                              const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= 20;
                              const isFull = kiosksFull && quadsFull;
                              return (
                                <div className={cn("relative flex flex-col items-center p-0.5 rounded w-full h-full justify-center", isFull && "bg-red-50/50")}>
                                  <span className={cn("text-[11px]", isFull && "text-red-500 font-black")}>{date.getDate()}</span>
                                  <div className="flex gap-0.5 mt-0.5">
                                    {hasKiosk && <div className={cn("w-1 h-1 rounded-full", kiosksFull ? "bg-red-500" : "bg-emerald-500")} />}
                                    {hasQuad && <div className={cn("w-1 h-1 rounded-full", quadsFull ? "bg-red-500" : "bg-blue-500")} />}
                                  </div>
                                </div>
                              );
                            }
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    {filterDate && (
                      <Button 
                        variant="ghost" 
                        className="h-14 px-4 text-emerald-700 font-black hover:bg-emerald-100/50 rounded-2xl"
                        onClick={() => setFilterDate('')}
                      >
                        LIMPAR
                      </Button>
                    )}
                  </div>
                 <BookingTable 
                   bookings={[...bookings, ...(orders || []).map(o => ({...o, is_order: true}))].filter(b => 
                     (!search || 
                      (b.name || b.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
                      (b.phone || '').includes(search) ||
                      (b.confirmation_code || '').includes(search)) &&
                     (!filterDate || (b.visit_date && b.visit_date.startsWith(filterDate)))
                   )}
                   onStatusChange={updateBookingStatus}
                   onAddNote={addBookingNote}
                   onReschedule={async (id, date, isOrder) => {
                      const table = isOrder ? 'orders' : 'bookings';
                      const { error } = await supabase.from(table).update({ visit_date: date }).eq('id', id);
                      if (error) toast({ title: "Erro ao reagendar", variant: "destructive" });
                      else { toast({ title: "âœ“ Reagendado" }); fetchData(); }
                   }}
                    onDelete={async (id, isOrder) => {
                       const table = isOrder ? 'orders' : 'bookings';
                       try {
                         const { error } = await supabase.from(table).delete().eq('id', id);
                         if (error) throw error;
                         toast({ title: "âœ“ Removido com sucesso" });
                         fetchData();
                       } catch (err: any) {
                         console.error('Delete error:', err);
                         toast({ title: "Erro ao remover: " + (err?.message || ''), variant: "destructive" });
                       }
                    }}
                    onRemoveItem={() => {}}
                    updatingId={updatingId}
                    onRemoveReceipt={async (bookingId) => {
                      await supabase.from('bookings').update({ receipt_url: null }).eq('id', bookingId);
                      fetchData();
                    }}
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
                   onRefresh={fetchData}
                    onGeneratePayment={handleGeneratePayment}
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
          <AlertDialogContent className="rounded-3xl border-2 border-slate-300 shadow-2xl">
             <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center border-2 border-red-200">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                   </div>
                   <AlertDialogTitle className="text-xl font-black text-slate-900">Confirmar Exclusão</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-slate-600 font-bold">
                   Deseja realmente remover esta reserva? Esta ação não pode ser desfeita e liberará o horário/espaço para novos clientes.
                </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl border-2 border-slate-200 bg-slate-100 font-black text-slate-700 hover:bg-slate-900 hover:text-white transition-all">Cancelar</AlertDialogCancel>
                <Button onClick={confirmDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black h-10 px-6 shadow-md border-2 border-red-700">Sim, Excluir</Button>
             </AlertDialogFooter>
          </AlertDialogContent>
       </AlertDialog>

       {/* RESCHEDULE DIALOG */}
       <Dialog open={!!rescheduleData} onOpenChange={(open) => !open && setRescheduleData(null)}>
         <DialogContent className="rounded-[2.5rem] border-4 border-blue-200 shadow-3xl max-w-md bg-white p-0 overflow-hidden">
           <div className="bg-blue-600 p-8 text-white">
             <div className="flex items-center gap-4 mb-2">
               <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                 <CalendarClock className="w-6 h-6" />
               </div>
               <div>
                 <h3 className="text-xl font-black tracking-tight">Reagendar Reserva</h3>
                 <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Selecione a nova data abaixo</p>
               </div>
             </div>
           </div>
           
           <div className="p-8 space-y-6">
             <div className="bg-slate-50 rounded-3xl border-2 border-slate-200 p-4 shadow-inner">
                <Calendar
                  mode="single"
                  selected={rescheduleDate}
                  onSelect={setRescheduleDate}
                  locale={ptBR}
                  className="rounded-2xl"
                  toDate={new Date(2030, 11, 31)}
                  fromDate={new Date(2024, 0, 1)}
                  disabled={(date) => !isAllowedDay(date) || isBefore(date, startOfDay(new Date()))}
                  classNames={{
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center mb-2 bg-blue-800 rounded-xl py-3 border-2 border-blue-900 shadow-lg w-full",
                    caption_label: "text-sm font-black text-white uppercase tracking-widest",
                    nav: "flex items-center justify-between absolute inset-x-0 inset-y-0 px-6 pointer-events-none z-30",
                    nav_button: "h-10 w-10 bg-blue-500 text-white border border-blue-400 hover:bg-blue-400 shadow-lg rounded-xl transition-all pointer-events-auto flex items-center justify-center",
                    nav_button_previous: "relative left-0",
                    nav_button_next: "relative right-0",
                    day_selected: "bg-amber-400 text-amber-950 font-black hover:bg-amber-500 shadow-md",
                    day_today: "bg-blue-100 text-blue-900 font-bold"
                  }}
                  components={{
                    DayContent: ({ date }) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                      const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                      const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                      const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= 20;
                      const isFull = kiosksFull && quadsFull;
                      return (
                        <div className={cn("relative flex flex-col items-center p-0.5 rounded w-full h-full justify-center", isFull && "bg-red-50/50")}>
                          <span className={cn("text-[11px]", isFull && "text-red-600 font-black")}>{date.getDate()}</span>
                          <div className="flex gap-0.5 mt-0.5">
                            {hasKiosk && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", kiosksFull ? "bg-red-600" : "bg-emerald-600")} />}
                            {hasQuad && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", quadsFull ? "bg-red-600" : "bg-blue-600")} />}
                          </div>
                        </div>
                      );
                    }
                  }}
                />
             </div>
             
             <div className="flex gap-3">
               <Button 
                 variant="outline" 
                 className="flex-1 h-12 rounded-2xl font-black border-2 border-slate-300 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-800 transition-all"
                 onClick={() => setRescheduleData(null)}
               >
                 CANCELAR
               </Button>
               <Button 
                 className="flex-1 h-12 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-blue-700"
                 onClick={handleRescheduleConfirm}
                 disabled={loading}
               >
                 {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR'}
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
                  <Dialog open={isNewBookingOpen} onOpenChange={setIsNewBookingOpen}>
                    <DialogContent className="sm:max-w-3xl bg-slate-50 rounded-[2.5rem] border-4 border-emerald-200 overflow-hidden p-0 max-h-[95vh] flex flex-col shadow-3xl">
                      <div className="bg-emerald-600 p-8 text-center shrink-0 border-b-4 border-emerald-700 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
                        <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter flex items-center justify-center gap-3">
                           <CalendarPlus className="w-8 h-8" /> Assistente de Reserva Interna
                        </DialogTitle>
                        <p className="text-emerald-100 text-[11px] font-black uppercase mt-1.5 tracking-widest bg-emerald-700/50 inline-block px-4 py-1.5 rounded-full border border-emerald-500/30">Lógica Integrada • Sem CPF</p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                        {/* SECTION 1: CLIENTE E DATA */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> Nome do Cliente
                             </label>
                             <Input 
                               value={newBookingData.name} 
                               onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="Nome Completo"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" /> Telefone
                             </label>
                             <Input 
                               value={newBookingData.phone} 
                               onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="DDD + Número"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <CalendarIcon className="w-3.5 h-3.5" /> Data da Visita
                             </label>
                             <Input 
                               type="date"
                               value={newBookingData.visit_date} 
                               onChange={e => setNewBookingData({...newBookingData, visit_date: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-black bg-white text-emerald-950 uppercase"
                               disabled={isFetchingAvail}
                             />
                           </div>
                        </div>

                        {/* SECTION 2: PARTICIPANTES */}
                        <div className="bg-white p-8 rounded-[2rem] border-2 border-emerald-100 shadow-sm space-y-6">
                           <div className="flex items-center justify-between border-b-2 border-emerald-50 pb-4">
                              <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
                                 <Users className="w-4 h-4" /> 1. Participantes
                              </h4>
                              {isFetchingAvail && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
                           </div>
                           
                           <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                              {[
                                { k: 'adults_normal', l: 'Adulto Integral', p: 'R$ 50' },
                                { k: 'adults_half', l: 'Meia-Entrada', p: 'R$ 25' },
                                { k: 'is_teacher', l: 'Professor', p: 'R$ 25' },
                                 { k: 'is_student', l: 'Estudante', p: 'R$ 25' },
                                 { k: 'is_server', l: 'Servidor', p: 'R$ 25' },
                                 { k: 'is_donor', l: 'Doador Sangue', p: 'R$ 25' },
                                 { k: 'is_solidarity', l: 'Adulto Solidário', p: 'R$ 25' },
                                 { k: 'is_pcd', l: 'PCD', p: 'Grátis' },
                                 { k: 'is_tea', l: 'TEA', p: 'Grátis' },
                                 { k: 'is_senior', l: 'Idoso (60+)', p: 'Grátis' },
                                 { k: 'is_birthday', l: 'Aniversariante', p: 'Grátis' },
                                { k: 'children_free', l: 'Kids (Até 11a)', p: 'Grátis' }
                              ].map(cat => (
                                <div key={cat.k} className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 text-center space-y-2 hover:bg-emerald-50 transition-colors">
                                   <p className="text-[9px] font-black text-emerald-800/60 uppercase">{cat.l}</p>
                                   <p className="text-[10px] font-bold text-emerald-600 mb-1">{cat.p}</p>
                                   <div className="flex items-center justify-center gap-2">
                                      <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: Math.max(0, newBookingData[cat.k] - 1)})} className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">-</button>
                                      <span className="w-8 font-black text-emerald-950 text-lg">{newBookingData[cat.k]}</span>
                                      <button onClick={() => setNewBookingData({...newBookingData, [cat.k]: newBookingData[cat.k] + 1})} className="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm">+</button>
                                   </div>
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* SECTION 3: QUIOSQUES */}
                        <div className="bg-white p-8 rounded-[2rem] border-2 border-emerald-100 shadow-sm space-y-6">
                           <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 border-b-2 border-emerald-50 pb-4">
                              <Tent className="w-4 h-4" /> 2. Quiosques Disponíveis
                           </h4>
                           <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                              {[
                                { id: 1, label: '01', type: 'maior' },
                                { id: 2, label: '02', type: 'menor' },
                                { id: 3, label: '03', type: 'menor' },
                                { id: 4, label: '04', type: 'menor' },
                                { id: 5, label: '05', type: 'menor' }
                              ].map(k => {
                                const id = k.id;
                                const isBooked = !availableKiosks.includes(id) && !newBookingData.selected_kiosks.includes(id);
                                const isSelected = newBookingData.selected_kiosks.includes(id);
                                return (
                                  <button 
                                    key={id}
                                    disabled={isBooked}
                                    onClick={() => {
                                       const isS = newBookingData.selected_kiosks.includes(id);
                                       setNewBookingData({
                                          ...newBookingData,
                                          selected_kiosks: isS ? newBookingData.selected_kiosks.filter((v:number)=>v!==id) : [...newBookingData.selected_kiosks, id]
                                       });
                                    }}
                                    className={cn(
                                       "h-12 rounded-xl text-[11px] font-black transition-all border-2",
                                       isSelected ? "bg-emerald-600 text-white border-emerald-700 shadow-md scale-105" : 
                                       isBooked ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed" : 
                                       "bg-white text-emerald-700 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50"
                                    )}
                                  >
                                    {k.label}
                                  </button>
                                );
                              })}
                           </div>
                           <p className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">Preço: Quiosque 01 (R$ 100) | Outros (R$ 75)</p>
                        </div>

                        {/* SECTION 4: QUADRICICLOS */}
                        <div className="bg-white p-8 rounded-[2rem] border-2 border-emerald-100 shadow-sm space-y-6">
                           <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2 border-b-2 border-emerald-50 pb-4">
                              <Bike className="w-4 h-4" /> 3. Passeio de Quadriciclo (Limite Bloqueado)
                           </h4>
                           <div className="space-y-4">
                              {['09:00', '10:30', '14:00', '15:30'].map(slot => {
                                 const used = quadSlotsAvail[slot] || 0;
                                 const localUsed = newBookingData.quads.filter((q:any)=>q.time===slot).reduce((s:number,q:any)=>s+q.quantity, 0);
                                 const remaining = 5 - (used + localUsed);
                                 const isFull = remaining <= 0;
                                 
                                 return (
                                    <div key={slot} className="flex flex-col md:flex-row items-center justify-between p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 gap-4">
                                       <div className="flex items-center gap-3">
                                          <div className={cn("px-4 py-2 rounded-xl text-xs font-black border-2", isFull ? "bg-red-50 text-red-500 border-red-200" : "bg-white text-emerald-950 border-emerald-100")}>{slot}</div>
                                          <div className="flex flex-col">
                                             <span className="text-[10px] font-black uppercase text-emerald-800/60 tracking-wider">Vagas Disponíveis</span>
                                             <div className="flex gap-1">
                                                {Array.from({length: 5}, (_, i) => (
                                                   <div key={i} className={cn("w-2 h-2 rounded-full", i < (used + localUsed) ? "bg-red-500" : "bg-emerald-400")} />
                                                ))}
                                                <span className="text-[10px] font-black ml-2 text-emerald-800">{remaining} RESTANTES</span>
                                             </div>
                                          </div>
                                       </div>
                                       
                                       <div className="flex gap-2">
                                          {['individual', 'dupla', 'adulto-crianca'].map(type => {
                                             const active = newBookingData.quads.find((q:any)=>q.time===slot && q.type===type);
                                             return (
                                                <div key={type} className="flex flex-col items-center gap-1">
                                                   <button 
                                                      onClick={() => {
                                                         const idx = newBookingData.quads.findIndex((q:any)=>q.time===slot && q.type===type);
                                                         if (idx >= 0) {
                                                            const nq = [...newBookingData.quads];
                                                            if (nq[idx].quantity > 1) nq[idx].quantity -= 1;
                                                            else nq.splice(idx, 1);
                                                            setNewBookingData({...newBookingData, quads: nq});
                                                         }
                                                      }}
                                                      className="w-8 h-6 bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 rounded-t-lg font-black text-xs transition-colors flex items-center justify-center border-2 border-slate-200 border-b-0"
                                                   >-</button>
                                                   <div 
                                                      className={cn(
                                                         "w-[70px] h-10 flex flex-col items-center justify-center rounded-sm border-2 transition-all",
                                                         active ? "bg-blue-600 text-white border-blue-700 shadow-md" : "bg-white text-blue-700 border-blue-100"
                                                      )}
                                                   >
                                                      <span className="text-[8px] font-black uppercase leading-none">{type.split('-')[0]}</span>
                                                      {active && <span className="text-xs font-black">{active.quantity}x</span>}
                                                   </div>
                                                   <button 
                                                      disabled={isFull}
                                                      onClick={() => {
                                                         const idx = newBookingData.quads.findIndex((q:any)=>q.time===slot && q.type===type);
                                                         const nq = [...newBookingData.quads];
                                                         if (idx >= 0) nq[idx].quantity += 1;
                                                         else nq.push({ type, time: slot, quantity: 1 });
                                                         setNewBookingData({...newBookingData, quads: nq});
                                                      }}
                                                      className={cn(
                                                         "w-8 h-6 rounded-b-lg font-black text-xs transition-colors flex items-center justify-center border-2 border-t-0",
                                                         isFull ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 border-slate-200"
                                                      )}
                                                   >+</button>
                                                </div>
                                             );
                                          })}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>

                        {/* SECTION 5: FINANCEIRO FINAL */}
                        <div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                           <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-800/30 blur-3xl rounded-full -mb-32 -mr-32" />
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                              <div className="space-y-4">
                                 <h4 className="text-[11px] font-black text-emerald-100 uppercase tracking-widest flex items-center gap-2">
                                    <Tag className="w-4 h-4" /> Ajustes e Status
                                 </h4>
                                 <div className="space-y-3">
                                    <div className="space-y-1">
                                       <label className="text-[9px] font-black text-emerald-200 uppercase pl-1">Desconto Manual (R$)</label>
                                       <Input 
                                          type="number" 
                                          min="0" 
                                          value={newBookingData.manual_discount}
                                          onChange={e => setNewBookingData({...newBookingData, manual_discount: parseFloat(e.target.value) || 0})}
                                          className="h-12 bg-white/10 border-white/20 text-white rounded-xl focus:ring-emerald-500 placeholder:text-white/20 font-bold"
                                          placeholder="0,00"
                                       />
                                    </div>
                                    <div className="space-y-1">
                                       <label className="text-[9px] font-black text-emerald-200 uppercase pl-1">Status de Pagamento</label>
                                       <select 
                                          className="w-full h-12 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                                          value={newBookingData.status}
                                          onChange={e => setNewBookingData({...newBookingData, status: e.target.value})}
                                       >
                                          <option value="pending" className="text-emerald-950 font-bold">Aguardando Pagamento</option>
                                          <option value="paid" className="text-emerald-950 font-bold">Confirmada e Paga</option>
                                       </select>
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="flex flex-col justify-center items-center md:items-end space-y-2">
                                 <p className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em] mb-1">Total da Reserva</p>
                                 <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-emerald-200/60 leading-none">R$</span>
                                    <span className="text-6xl font-black tracking-tighter leading-none">
                                       {(() => {
                                          const { adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, selected_kiosks, quads, manual_discount, visit_date } = newBookingData;
                                          let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
                                          selected_kiosks.forEach((id: number) => total += (id === 1 ? 100 : 75));
                                          const qD = getQuadDiscount(visit_date);
                                          quads.forEach((q: any) => {
                                             const b = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
                                             total += (b * (1 - qD)) * q.quantity;
                                          });
                                          return Math.max(0, total - manual_discount).toFixed(2).replace('.', ',');
                                       })()}
                                    </span>
                                 </div>
                                 <p className="text-[9px] font-bold text-emerald-300/50 italic">* Cálculo automático incluindo descontos do dia</p>
                              </div>
                           </div>

                           <Button 
                              onClick={handleCreateInternalBooking}
                              disabled={loading || !newBookingData.name}
                              className="w-full h-16 bg-white hover:bg-emerald-50 text-emerald-900 rounded-3xl font-black text-lg uppercase tracking-tight shadow-2xl relative z-10 transition-all active:scale-[0.98] disabled:opacity-50"
                           >
                              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : 'CONCLUIR E SALVAR RESERVA'}
                           </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
    </div>
  );
}
