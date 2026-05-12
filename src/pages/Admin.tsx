import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isValidCPF } from '@/utils/cpf-validator';
import { saveBooking, getBookedKioskIds, getQuadAvailability, getGlobalSetting, updateGlobalSetting, type OrderItemInput } from '@/lib/booking-service';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, Settings, PieChart, TrendingUp, Calendar as CalendarIcon, 
  Search, RefreshCw, LogOut, LayoutDashboard, Tent, Bike, 
  CalendarCheck, ShoppingBag, Trash2, FileText, CheckCircle2, 
  XCircle, Loader2, Pencil, CalendarClock, Plus, Filter,
  Download, Database, FileSpreadsheet, Wallet, Check, X,
  User, Phone, CalendarPlus, Tag, History, ChevronDown, ChevronUp,
  Clock, CheckCircle, AlertTriangle, FileCheck, StickyNote,
  CalendarRange, QrCode, DollarSign, UserCheck, Hash, ArrowRight,
  MessageCircle, Circle, Upload, HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, getQuadDiscount, QUAD_PRICES } from '@/lib/booking-types';
import { parseToRODate, getRONow, getROTodayStr } from '@/utils/date-utils';
import { BookingTable } from '@/components/admin/BookingTable';
import { AgendaHeader } from '@/components/admin/AgendaHeader';
import { getAdminOrders, markOrderAsPaid } from '@/integrations/supabase/orders';
import { PaymentModal } from '@/components/booking/PaymentModal';
import { InternalBookingAssistant } from '@/components/admin/InternalBookingAssistant';
import { AdminCreditsTab } from '@/components/admin/AdminCreditsTab';
import { AdminDashboardTab } from '@/components/admin/AdminDashboardTab';
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
import { exportToExcel, exportToPDF, exportMultiSheetExcel } from '@/utils/export-utils';

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
  'adulto-crianca': 'Adulto + Criança'
};

type TabType = 'painel' | 'reservas' | 'quiosques' | 'quads' | 'vendas' | 'creditos';

const normalizeQuadType = (t: string) => {
  const slow = (t || '').toLowerCase();
  if (slow.includes('dupla')) return 'dupla';
  if (slow.includes('criança')) return 'adulto-crianca';
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
  const [isCapacityUnlocked, setIsCapacityUnlocked] = useState(false);
  const [agendaSubTab, setAgendaSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [isSyncingData, setIsSyncingData] = useState(false);

  const repairKioskAssignments = async () => {
    setIsSyncingData(true);
    try {
      // 1. Get all orders for the target date or future
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*, orders!inner(id, customer_name, visit_date, status)')
        .ilike('product_id', '%quiosque%');
      
      if (!orderItems) return;

      let fixedCount = 0;
      for (const item of orderItems) {
        const order = (item as any).orders;
        if (!['paid', 'confirmed', 'checked-in', 'completed'].includes(order.status?.toLowerCase())) continue;

          // Try to find matching reservation
          const { data: existing } = await supabase
            .from('kiosk_reservations')
            .select('*')
            .eq('order_id', order.id)
            .maybeSingle();

          // Identify Kiosk ID (Priority: Metadata > Product Name)
          let meta = item.metadata;
          if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e) {} }
          const sIds = meta?.selectedIds || [];
          
          const pIdOrig = (item.product_id || '').toLowerCase();
          const kioskIdMatch = pIdOrig.match(/quiosque\s*(\d+)/i);
          let kId: any = kioskIdMatch ? parseInt(kioskIdMatch[1], 10) : (pIdOrig.includes('maior') ? 1 : 'MENOR');
          
          if (sIds.length > 0) kId = sIds[0];

          // 1. Sync Reservation Table
          if (!existing) {
            await supabase.from('kiosk_reservations').insert({
              order_id: order.id,
              kiosk_id: kId,
              kiosk_type: (kId === 1 || kId === 'MAIOR' || kId === '1') ? 'maior' : 'menor',
              reservation_date: order.visit_date,
              customer_name: order.customer_name,
              price: item.unit_price,
              status: order.status
            });
            fixedCount++;
          } else if (String(existing.kiosk_id) !== String(kId)) {
            await supabase.from('kiosk_reservations').update({
              kiosk_id: kId,
              kiosk_type: (kId === 1 || kId === 'MAIOR' || kId === '1') ? 'maior' : 'menor',
              reservation_date: order.visit_date,
              customer_name: order.customer_name
            }).eq('id', existing.id);
            fixedCount++;
          }

          // 2. Sync Product ID (to avoid operator confusion)
          const correctLabel = String(kId).padStart(2, '0');
          const correctName = kId === 1 ? 'QUIOSQUE - 01 (Grande)' : `QUIOSQUE ${correctLabel}`;
          if (kId !== 'MENOR' && (item.product_id || '').trim().toUpperCase() !== correctName.toUpperCase()) {
             await supabase.from('order_items').update({ product_id: correctName }).eq('id', item.id);
             fixedCount++;
          }
        }

        // 2. Extra Cleanup: Remove reservations for PAID orders that don't have matching order items
        // This handles "ghost" reservations from previous tests
        const { data: allRes } = await supabase.from('kiosk_reservations').select('id, order_id, kiosk_id').not('order_id', 'is', null);
        if (allRes) {
           for (const res of allRes) {
              const matchingItem = orderItems.find(oi => oi.order_id === res.order_id);
              if (!matchingItem) {
                 await supabase.from('kiosk_reservations').delete().eq('id', res.id);
                 fixedCount++;
              }
           }
        }
      
      toast({ title: "Sincronização Concluída", description: `${fixedCount} inconsistências foram reparadas.` });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro na sincronização", variant: "destructive" });
    } finally {
      setIsSyncingData(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kioskStatusFilter, setKioskStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedQuadGroupId, setExpandedQuadGroupId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const { toast } = useToast();

  // Data States
  const [bookings, setBookings] = useState<any[]>([]);
  const [kioskReservations, setKioskReservations] = useState<any[]>([]);
  const [quadReservations, setQuadReservations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [totalQuads, setTotalQuads] = useState<number>(3);

  // Editing States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{item: any, type: 'kiosk' | 'quad' | 'order' | 'reservas'} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  
  
  
  // New Rescheduling Dialog States
  const [rescheduleData, setRescheduleData] = useState<{type: 'kiosk' | 'quad', group: any} | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(new Date());

  // History States
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [pixData, setPixData] = useState<{ qrCode: string, payload: string, amount: number, name: string } | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingKioskGroup, setEditingKioskGroup] = useState<any | null>(null);
  const [editingQuadItem, setEditingQuadItem] = useState<any | null>(null);
  const [isUpdatingKiosk, setIsUpdatingKiosk] = useState(false);
  const [isUpdatingQuad, setIsUpdatingQuad] = useState(false);


  const normalizeString = (str: string) => 
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const normalizePhone = (phone: string | null | undefined) => 
    (phone || '').replace(/\D/g, '');

  const matchDate = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const s1 = typeof d1 === 'string' ? d1.split('T')[0] : format(d1, 'yyyy-MM-dd');
    const s2 = typeof d2 === 'string' ? d2.split('T')[0] : format(d2, 'yyyy-MM-dd');
    return s1 === s2;
  };
  const nameMatch = (n1: string, n2: string) => (n1 || '').toLowerCase().trim() === (n2 || '').toLowerCase().trim();

  const updateOrderTotal = async (orderId: string) => {
    if (!orderId || orderId.startsWith('order-')) return;
    try {
      const { data: order } = await supabase.from('orders').select('manual_discount, manual_discount_type').eq('id', orderId).single();
      const { data: items } = await supabase.from('order_items').select('unit_price, quantity').eq('order_id', orderId);
      
      if (items) {
        let subtotal = items.reduce((acc, it) => acc + (Number(it.unit_price) * (Number(it.quantity) || 1)), 0);
        let finalTotal = subtotal;
        
        if (order?.manual_discount) {
          const disc = order.manual_discount_type === 'percent' ? (subtotal * (order.manual_discount / 100)) : order.manual_discount;
          finalTotal = Math.max(0, subtotal - disc);
        }
        
        await supabase.from('orders').update({ 
          total_amount: finalTotal, 
          updated_at: new Date().toISOString() 
        }).eq('id', orderId);
      }
    } catch(e) { console.error("Error syncing total:", e); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await getAdminOrders();
      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await (supabase.from('kiosk_reservations') as any)
        .select('*, orders(customer_name, status), bookings(name)')
        .order('reservation_date', { ascending: false });
        
      const { data: quads } = await (supabase.from('quad_reservations') as any)
        .select('*, orders(customer_name, status), bookings(name)')
        .order('reservation_date', { ascending: false });
      
      const { data: creds } = await supabase
        .from('internal_credits')
        .select('*')
        .order('created_at', { ascending: false });
      
      const tQuads = await getGlobalSetting('total_quads', 3);
      setTotalQuads(Number(tQuads));
      setCredits(creds || []);
      
      // Filter out awaiting_payment from reservations too
      // Include direct reservations (no order) AND paid orders, exclude only awaiting_payment orders
      const filteredKiosks = (kiosks || []);
      const filteredQuads = (quads || []);
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => 
          (o.confirmation_code && b.confirmation_code && o.confirmation_code === b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && matchDate(o.visit_date, b.visit_date))
        );
        return { 
          ...b, 
          order_items: relatedOrder?.order_items || [],
          confirmation_code: b.confirmation_code || relatedOrder?.confirmation_code,
          customer_phone: b.phone || relatedOrder?.customer_phone,
          last_voucher_sent_at: relatedOrder?.last_voucher_sent_at
        };
      });
      
      // Map reservations to include customer names correctly and status
      let parsedKiosks = filteredKiosks.map((k: any) => ({
         ...k,
         customer_name: k.customer_name || k.orders?.customer_name || k.bookings?.name || 'Reserva Direta',
         status: k.orders?.status || 'confirmed',
         confirmation_code: k.confirmation_code || k.orders?.confirmation_code,
         customer_phone: k.customer_phone || k.orders?.customer_phone || k.bookings?.phone,
         last_voucher_sent_at: k.last_voucher_sent_at || k.orders?.last_voucher_sent_at
      })).filter((k: any) => {
        const s = (k.status || '').toLowerCase();
        return ['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes(s);
      });
      
      let parsedQuads = filteredQuads.map((q: any) => ({
         ...q,
         customer_name: q.customer_name || q.orders?.customer_name || q.bookings?.name || 'Reserva Direta',
         status: q.orders?.status || 'confirmed',
         confirmation_code: q.confirmation_code || q.orders?.confirmation_code,
         customer_phone: q.customer_phone || q.orders?.customer_phone || q.bookings?.phone,
         last_voucher_sent_at: q.last_voucher_sent_at || q.orders?.last_voucher_sent_at
      })).filter((q: any) => {
        const s = (q.status || '').toLowerCase();
        return ['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes(s);
      });

      if (orderData) {
         orderData.forEach((o: any) => {
            if (['cancelled', 'cancelado'].includes(o.status?.toLowerCase())) return;
            if (!o.order_items) return;
            const resDate = o.visit_date || o.created_at.split('T')[0];
            const customerName = o.customer_name || 'Venda Loja';
            
            let orderAdults = 0;
            let orderChildren = 0;
            // Categories for counting people
            const adultKeywords = ['adulto', 'solidário', 'solidario', 'professor', 'estudante', 'servidor', 'assinante'];
            const gratuityKeywords = ['criança', 'crianca', 'idoso', 'pcd', 'aniversariante', 'kids'];

            // 1. Process Order Items for People Count
            o.order_items.forEach((item: any) => {
              const pId = (item.product_id || '').toLowerCase();
              const pName = (item.product_name || '').toLowerCase();
              const qty = item.quantity || 1;
              
              const isAdult = adultKeywords.some(key => pName.includes(key) || pId.includes(key));
              const isGratuity = gratuityKeywords.some(key => pName.includes(key) || pId.includes(key));

              if (isAdult && !isGratuity) {
                orderAdults += qty;
              } else if (isGratuity) {
                orderChildren += qty;
              }
            });

            // 2. Track which real reservations are already accounted for to avoid double counting
            const matchedKioskIds = new Set();
            const matchedQuadIds = new Set();

            // 3. Process Order Items for Kiosks and Quads
            if (['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes(o.status?.toLowerCase() || '')) {
              o.order_items.forEach((item: any) => {
               const pId = (item.product_id || '').toLowerCase();
               const pName = (item.product_name || '').toLowerCase();
               const searchStr = `${pName} ${pId} ${JSON.stringify(item.metadata || {})} ${o.notes || ''}`.toUpperCase();
               
               // KIOSKS
               if (pId.includes('quiosque') || pName.includes('quiosque')) {
                 // Try to find if this item is already in parsedKiosks (real record)
                 const realMatch = parsedKiosks.find(pk => !pk.is_from_order && pk.order_id === o.id && !matchedKioskIds.has(pk.id));
                 if (realMatch) {
                    realMatch.order_item_id = item.id;
                    matchedKioskIds.add(realMatch.id);
                 } else {
                   // Virtual Kiosks
                   let meta = item.metadata;
                   if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e) {} }
                   const sIds = meta?.selectedIds || [];
                   
                   for(let i=0; i<item.quantity; i++) {
                     let kioskIdVal: any = (pId.includes('maior') || pName.includes('maior') || pId.includes('grande') || pName.includes('grande')) ? 1 : 'MENOR';
                     if (sIds.length > i) kioskIdVal = sIds[i];
                     else {
                       const match = (pId + ' ' + pName).match(/quiosque\D*(\d+)/i);
                       if (match && match[1]) kioskIdVal = parseInt(match[1], 10);
                     }

                     parsedKiosks.push({
                       id: `order-${o.id}-k-${item.id}-${i}`,
                       kiosk_id: kioskIdVal,
                       reservation_date: resDate,
                       customer_name: customerName,
                       customer_phone: o.customer_phone,
                       confirmation_code: o.confirmation_code,
                       last_voucher_sent_at: o.last_voucher_sent_at,
                       price: item.unit_price,
                       order_id: o.id,
                       order_item_id: item.id,
                       is_from_order: true,
                       status: o.status
                     });
                   }
                 }
               }

               // QUADS
               if (pId.includes('quad') || pName.includes('quad')) {
                  // Try to find if this item is already in parsedQuads (real record)
                  const realMatch = parsedQuads.find(pq => 
                    !pq.is_from_order &&
                    pq.order_id === o.id && 
                    !matchedQuadIds.has(pq.id) && 
                    normalizeQuadType(pq.quad_type) === normalizeQuadType(pName || pId)
                  );

                  if (realMatch) {
                    realMatch.order_item_id = item.id;
                    matchedQuadIds.add(realMatch.id);
                  } else {
                    // Virtual Quads
                    const timeMatch = searchStr.match(/(\d{1,2}[:H]\d{2})/);
                    let finalSlot = null;
                    if (timeMatch) {
                      let raw = timeMatch[1].replace('H', ':');
                      if (raw.length === 4) raw = '0' + raw;
                      finalSlot = raw;
                    }
                    let meta = item.metadata;
                    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e) {} }
                    if (!finalSlot && meta?.time) {
                      finalSlot = meta.time;
                      if (finalSlot && finalSlot.length === 4 && finalSlot.includes(':')) finalSlot = '0' + finalSlot;
                    }
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
                       quad_type: normalizeQuadType(pName || pId),
                       quantity: item.quantity,
                       reservation_date: resDate,
                       customer_name: customerName,
                       customer_phone: o.customer_phone,
                       confirmation_code: o.confirmation_code,
                       last_voucher_sent_at: o.last_voucher_sent_at,
                       price: item.quantity * item.unit_price,
                       order_id: o.id,
                       order_item_id: item.id,
                       is_from_order: true,
                       status: o.status
                    });
                  }
               }
            });
            }
            
            // Atribuir contagens extraídas se não estiverem presentes
            o.adults = o.adults || orderAdults;
            o.children = o.children || orderChildren;
         });
      }

      // Merge booking data with order payment info for display
      const flattenedBks = (enrichedBookings || []).map(b => {
        // Match by confirmation_code or fuzzy name/phone
        const order = (orderData || []).find((o: any) => 
          (o.confirmation_code && b.confirmation_code && o.confirmation_code === b.confirmation_code) ||
          (normalizeString(o.customer_name || '') === normalizeString(b.name || '') && 
           (normalizePhone(o.customer_phone || '') === normalizePhone(b.phone || '') || !b.phone))
        );
        
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone,
          customer_cpf: order?.customer_cpf || (b as any).cpf,
          is_order: !!order
        };
      });

      setBookings(flattenedBks);
      console.log('[Admin] parsedKiosks count:', parsedKiosks.length, parsedKiosks.map(k => ({ id: k.id, kiosk_id: k.kiosk_id, customer_name: k.customer_name, status: k.status, date: k.reservation_date })));
      setKioskReservations(parsedKiosks);
      setQuadReservations(parsedQuads);
      setOrders(orderData || []);
      
      // Calculate totals for dashboard
      let tAdults = 0;
      let tChildren = 0;
      const adultKeywords = ['adulto', 'solidario', 'professor', 'estudante', 'servidor', 'assinante'];
      const gratuityKeywords = ['criança', 'kids', 'idoso', 'pcd', 'aniversariante'];

      [...(enrichedBookings || []), ...(orderData || [])].forEach(b => {
        if (b.status === 'confirmed' || b.status === 'paid' || b.status === 'pending') {
          // Additional check: exclude guest-side awaiting_payment from totals
          if (b.status === 'awaiting_payment') return;
          
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
      setLastSync(new Date());

    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;

    console.log("[Admin] Setting up initial data and subscriptions...");
    fetchData();

    const channel = supabase.channel("admin_db_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        console.log("[Admin] Change detected in orders:", payload);
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "kiosk_reservations" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "quad_reservations" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => fetchData())
      .subscribe((status) => {
        console.log("[Admin] Realtime subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("[Admin] Listening for live changes...");
        }
      });

    // Fallback: Refresh data and sync payments every 5 minutes
    const pollInterval = setInterval(() => {
      console.log("[Admin] Periodic sync...");
      fetchData();
      syncAllPendingPayments();
    }, 300000);

    return () => { 
      console.log("[Admin] Cleaning up subscriptions and pollers...");
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
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

  const convertToCredit = async (item: any, type: 'reservas' | 'order') => {
    const amount = type === 'order' ? item.total_amount : (item.total_price || 0);
    const name = item.customer_name || item.name;
    const phone = item.customer_phone || item.phone;
    const cpf = item.customer_cpf || item.cpf;
    
    if (window.confirm(`Deseja cancelar esta reserva e gerar um crédito de R$ ${amount.toFixed(2)} para ${name}?`)) {
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

      if (type === 'quad') {
        const { data: dbItem } = await supabase.from('quad_reservations').select('*').eq('id', editingId).single();
        if (dbItem || editingId.toString().startsWith('order-')) {
          const finalModel = editData.quad_type || dbItem?.quad_type || 'individual';
          const finalDate = editData.reservation_date || dbItem?.reservation_date || todayStr;
          const finalQty = editData.quantity || dbItem?.quantity || 1;
          const finalTime = editData.time_slot || dbItem?.time_slot;
          
          const discount = getQuadDiscount(parseToRODate(finalDate));
          const unitPrice = (QUAD_PRICES[finalModel as keyof typeof QUAD_PRICES] || 150) * (1 - discount);
          
          payload.price = unitPrice * finalQty;
          payload.quad_type = finalModel;
          payload.quantity = finalQty;
          payload.time_slot = finalTime;
          
          const orderId = dbItem?.order_id || editData.order_id;
          const orderItemId = dbItem?.order_item_id || editData.order_item_id;

          if (orderId && !String(orderId).startsWith('order-')) {
            if (orderItemId) {
              await supabase.from('order_items').update({ 
                unit_price: unitPrice, 
                quantity: finalQty, 
                product_id: `Quadriciclo ${QUAD_MODELS_LABELS[finalModel as keyof typeof QUAD_MODELS_LABELS] || 'Individual'}`,
                metadata: { time: finalTime, time_slot: finalTime } 
              }).eq('id', orderItemId);
            } else {
              // Fallback if no order_item_id: try to find the item
              const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
              const quadItem = oItems?.find(oi => 
                (oi.product_id?.toLowerCase().includes('quad') || (oi as any).product_name?.toLowerCase().includes('quad')) &&
                (normalizeQuadType((oi as any).product_name || oi.product_id) === normalizeQuadType(finalModel))
              );
              if (quadItem) {
                await supabase.from('order_items').update({ 
                  unit_price: unitPrice, 
                  quantity: finalQty,
                  product_id: `Quadriciclo ${QUAD_MODELS_LABELS[finalModel as keyof typeof QUAD_MODELS_LABELS] || 'Individual'}`,
                  metadata: { time: finalTime, time_slot: finalTime } 
                }).eq('id', quadItem.id);
              }
            }
          }
          editData.order_id = orderId;
        }
      }

      if (type === 'kiosk') {
        const { data: dbItem } = await supabase.from('kiosk_reservations').select('*').eq('id', editingId).single();
        if (dbItem || editingId.toString().startsWith('order-')) {
          const finalKId = editData.kiosk_id || dbItem?.kiosk_id;
          const finalDate = editData.reservation_date || dbItem?.reservation_date || todayStr;
          const orderId = dbItem?.order_id || editData.order_id;
          const orderItemId = dbItem?.order_item_id || editData.order_item_id;

          if (orderId && !String(orderId).startsWith('order-') && orderItemId) {
             const kioskType = (finalKId === 1 || finalKId === 'MAIOR' || finalKId === '1') ? 'Maior' : 'Menor';
             const kioskPrice = kioskType === 'Maior' ? 100 : 75;
             
             await supabase.from('order_items').update({
               product_id: `Quiosque ${kioskType}`,
               unit_price: kioskPrice,
               metadata: { selectedIds: [finalKId] }
             }).eq('id', orderItemId);

             payload.price = kioskPrice;
             payload.kiosk_id = finalKId;
          }
          editData.order_id = orderId;
        }
      }

      // Se for uma reserva virtual extraída de um pedido, precisa virar real no banco
      if (typeof editingId === 'string' && editingId.startsWith('order-')) {
        payload.order_id = editData.order_id;
        // order_item_id is only used in-memory for logic; do NOT write to quad_reservations (column does not exist)
        // payload.order_item_id = editData.order_item_id;
        
        // Strip fields that don't exist on the DB table
        const QUAD_COLS = ['time_slot','quad_type','quantity','reservation_date','notes','price','receipt_url','customer_name','order_id','status'];
        const KIOSK_COLS = ['kiosk_id','reservation_date','notes','price','receipt_url','customer_name','order_id','status'];
        const allowedCols = type === 'quad' ? QUAD_COLS : KIOSK_COLS;
        const cleanPayload: any = {};
        allowedCols.forEach(col => { if (payload[col] !== undefined) cleanPayload[col] = payload[col]; });

        const { error } = await supabase.from(table).insert([cleanPayload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).update(payload).eq('id', editingId);
        if (error) throw error;
      }

      if (editData.order_id && !String(editData.order_id).startsWith('order-')) {
        await updateOrderTotal(editData.order_id);
      }
      
      toast({ title: "✓ Alterações salvas" });
      setEditingId(null);
      setEditData({});
      await fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: `Erro ao salvar: ${err.message || err.details || 'Erro desconhecido'}`, variant: "destructive" });
    }
  };

  const openPaymentModal = (bookingId: string, isOrder?: boolean) => {
    const list = isOrder ? orders : bookings;
    const item = list.find((b: any) => b.id === bookingId);
    if (item) {
      setSelectedPaymentBooking(item);
      setIsPaymentModalOpen(true);
    }
  };

  const handleSyncPayment = async (orderId: string) => {
    setUpdatingId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('check-payment', {
        body: { orderId }
      });

      if (error) throw error;

      if (data?.success) {
        if (data.updated) {
          toast({ title: "Pagamento Sincronizado!", description: `Status: ${data.status}. O pedido foi marcado como PAGO.` });
          fetchData();
        } else {
          toast({ title: "Sincronização Concluída", description: `Status: ${data.status}. Nenhuma alteração necessária.` });
        }
      } else {
        toast({ title: "Erro na Sincronização", description: data?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const syncAllPendingPayments = useCallback(async () => {
    try {
      // Get orders that might need a payment status check
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .in('status', ['pending', 'awaiting_payment', 'aguardando pgto', 'waiting_local', 'waiting_confirmation']);

      if (!pendingOrders || pendingOrders.length === 0) return;

      console.log(`[Admin] Auto-syncing ${pendingOrders.length} pending payments...`);
      
      // Process syncs
      for (const order of pendingOrders) {
        await supabase.functions.invoke('check-payment', {
          body: { orderId: order.id }
        });
      }
      
      // Refresh UI with updated statuses
      fetchData();
    } catch (err) {
      console.error('[Admin] Error in auto-payment sync:', err);
    }
  }, [fetchData]);

  // Original handleGeneratePayment kept for legacy references and as a fallback
  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {
    openPaymentModal(bookingId, isOrder);
  };

  const handleRemoveItem = async (orderId: string, itemId: string, productName: string) => {
    if (!window.confirm(`Deseja realmente remover o item "${productName}" desta reserva? O valor total será recalculado.`)) return;

    setLoading(true);
    try {
      // 1. Delete related kiosk/quad reservations if they exist
      await supabase.from('kiosk_reservations').delete().eq('order_item_id', itemId);
      await supabase.from('quad_reservations').delete().eq('order_item_id', itemId);

      // 2. Delete the order item
      const { error: deleteError } = await supabase.from('order_items').delete().eq('id', itemId);
      if (deleteError) throw deleteError;

      // 3. Recalculate total amount for the order
      const { data: remainingItems, error: itemsError } = await supabase
        .from('order_items')
        .select('unit_price, quantity')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      const newTotal = (remainingItems || []).reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

      // 4. Update the order total and clear any pending payments
      await supabase.from('payments').delete().eq('order_id', orderId).eq('status', 'pending');
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast({ title: "Item removido!", description: `Novo total: ${formatCurrency(newTotal)}` });
      fetchData();
    } catch (err: any) {
      console.error('Error removing item:', err);
      toast({ title: "Erro ao remover item", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
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
      toast({ title: "✓ Nota adicionada" });
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
      // 1. Availability Check
      if (type === 'kiosk') {
        const bookedIds = await getBookedKioskIds(newDateStr);
        const currentIds = group.items.map((r: any) => r.kiosk_id).filter((id: any) => !isNaN(id)).map(Number);
        const conflicts = currentIds.filter((id: number) => bookedIds.includes(id));
        if (conflicts.length > 0) {
          throw new Error(`O(s) quiosque(s) ${conflicts.join(', ')} já estão ocupados nesta data.`);
        }
      } else {
        const { available } = await getQuadAvailability(newDateStr);
        const requested = group.items.reduce((s: number, r: any) => s + (Number(r.quantity) || 1), 0);
        if (available < requested) {
          throw new Error(`Não há quadriciclos disponíveis suficientes para esta data (${available} disponíveis).`);
        }
      }

      const table = type === 'kiosk' ? 'kiosk_reservations' : 'quad_reservations';
      const orderId = group.items[0]?.order_id;

      // 2. Perform Updates
      await Promise.all(group.items.map(async (r: any) => {
        let updatePayload: any = { reservation_date: newDateStr };
        
        if (type === 'quad') {
          const discount = getQuadDiscount(parseToRODate(newDateStr));
          const prices: any = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
          const unitPrice = (prices[r.quad_type] || 150) * (1 - discount);
          updatePayload.price = unitPrice * (r.quantity || 1);
          
          if (orderId && !String(orderId).startsWith('order-') && r.order_item_id) {
             await supabase.from('order_items').update({ unit_price: unitPrice }).eq('id', r.order_item_id);
          }
        }
        
        // Use edge function for cleaner update if it's a real order
        if (orderId && !String(orderId).startsWith('order-')) {
          const action = type === 'kiosk' ? 'update_kiosk' : 'update_quad';
          const { error: funcErr } = await supabase.functions.invoke('create-internal-order', {
            body: {
              action,
              item_id: r.id,
              reservation_date: newDateStr,
              price: updatePayload.price,
              order_id: orderId
            }
          });
          if (funcErr) throw funcErr;
        } else {
          const { error } = await supabase.from(table).update(updatePayload).eq('id', r.id);
          if (error) throw error;
        }
      }));
      
      // 3. Update Order Level
      if (orderId && !String(orderId).startsWith('order-')) {
        await supabase.from('orders').update({ visit_date: newDateStr }).eq('id', orderId);
        await updateOrderTotal(orderId);
      }
      
      toast({ title: '✓ Reagendado com sucesso' });
      fetchData();
      setRescheduleData(null);
    } catch (err: any) {
      console.error('Reschedule error:', err);
      toast({ title: 'Erro ao reagendar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      toast({ title: "Iniciando Backup...", description: "Buscando todos os dados do banco..." });
      const { data: ordersData } = await supabase.from('orders').select('*');
      const { data: bksData } = await supabase.from('bookings').select('*');
      const { data: kioskData } = await supabase.from('kiosk_reservations').select('*');
      const { data: quadData } = await supabase.from('quad_reservations').select('*');
      
      const sheets = [
        { name: 'Pedidos', data: ordersData || [] },
        { name: 'Entradas', data: bksData || [] },
        { name: 'Quiosques', data: kioskData || [] },
        { name: 'Quadriciclos', data: quadData || [] }
      ];
      
      exportMultiSheetExcel(sheets, `backup_reserva_lessa_${format(new Date(), 'yyyy-MM-dd_HH-mm')}`);
      toast({ title: "✓ Backup concluído", description: "O arquivo Excel foi baixado com sucesso." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro no backup", description: "Não foi possível gerar o arquivo.", variant: "destructive" });
    }
  };

  const handleExportReport = (type: 'excel' | 'pdf', groups: any[], title: string) => {
    const reportData = groups.map(g => {
      const { names } = resolveGroup(g);
      return {
        'Data': format(parseISO(g.reservation_date), 'dd/MM/yyyy'),
        'Cliente': g.customer_name,
        'Reservas': names,
        'Valor Total': formatCurrency(g.total_price),
        'Itens': g.items.length
      };
    });

    const fileName = `relatorio_${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}`;
    
    if (type === 'excel') {
      exportToExcel(reportData, fileName);
    } else {
      exportToPDF(reportData, title, fileName);
    }
    toast({ title: "Relatório gerado!" });
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
        return matchDate(d, targetDate);
      } catch { return false; }
    });
    
    const dayQuads = (quadReservations || []).filter(r => {
      try {
        const d = typeof r.reservation_date === 'string' ? r.reservation_date.split('T')[0] : format(r.reservation_date, 'yyyy-MM-dd');
        return d === format(targetDate, 'yyyy-MM-dd');
      } catch { return false; }
    });

    const dayBookings = bookings.filter(b => 
      matchDate(b.visit_date, targetDate) && 
      ['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes((b.status || '').toLowerCase())
    );

    
    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      
      // BROADENED KIOSK DETECTION
      bItems.forEach(item => {
        const pNameLower = (item.product_name || '').toLowerCase();
        if (pNameLower.includes('quiosque') || pNameLower.includes('camping')) {
           // Extract numeric ID from "Quiosque 04" or similar
           const kioskIdMatch = pNameLower.match(/quiosque\s*(\d+)/i);
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
      const quadKeywords = ['quadri', 'passeio', 'quadriciclo', 'quadriciclo'];
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
    const dayOrders = orders.filter(o => 
      matchDate(o.visit_date || o.created_at, targetDate) && 
      ['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes((o.status || '').toLowerCase())
    );

    
    return (
      <AdminDashboardTab
        targetDate={targetDate}
        setTargetDate={setTargetDate}
        kioskReservations={kioskReservations}
        quadReservations={quadReservations}
        bookings={bookings}
        orders={orders}
        isAllowedDay={isAllowedDay}
        isHoliday={isHoliday}
        totalQuads={totalQuads}
      />
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

    let tabGroups = groupsByTab[kioskSubTab];
    
    // Status Filtering
    if (kioskStatusFilter !== 'all') {
      tabGroups = tabGroups.filter(g => 
        g.items.some((item: any) => item.status === kioskStatusFilter)
      );
    }

    // Search Filtering
    if (search) {
      tabGroups = tabGroups.filter((g: any) => normalizeString(g.customer_name).includes(normalizeString(search)));
    }

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
        {/* TAB HEADER - CLEAN & PREMIUM PILLS */}
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-200 bg-slate-50 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-emerald-900 uppercase tracking-tight">Reservas de Quiosques</h3>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Controle total por status e período</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExportReport('excel', tabGroups, `Quiosques_${kioskSubTab}`)}
                  className="rounded-xl border-blue-200 text-blue-700 font-black text-[10px] h-9"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> EXPORTAR EXCEL
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={repairKioskAssignments} 
                  disabled={isSyncingData}
                  className="rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px] h-9"
                >
                  {isSyncingData ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                  SINCRONIZAR BANCO
                </Button>
                <div className="flex flex-row overflow-x-auto gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto shadow-inner border border-slate-200">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setKioskSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300',
                      kioskSubTab === t.key ? t.color + ' shadow-lg scale-105 ring-4 ring-emerald-500/10' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shadow-sm', kioskSubTab === t.key ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700')}>
                      {t.count}
                    </span>
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/50 p-3 rounded-2xl border border-emerald-100 shadow-sm">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-black uppercase text-emerald-800">Filtrar Status:</span>
              </div>
              <Select value={kioskStatusFilter} onValueChange={setKioskStatusFilter}>
                <SelectTrigger className="w-[200px] h-9 rounded-xl border-emerald-200 bg-white font-bold text-xs">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-xl border-emerald-100">
                  <SelectItem value="all" className="font-bold text-xs">Todos os Pedidos</SelectItem>
                  <SelectItem value="paid" className="font-bold text-xs">Pagos</SelectItem>
                  <SelectItem value="pending" className="font-bold text-xs">Pendentes</SelectItem>
                  <SelectItem value="confirmed" className="font-bold text-xs">Confirmados</SelectItem>
                </SelectContent>
              </Select>
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
                            <span className="text-[10px] text-emerald-700 font-bold">{group.items.length} reserva(s) - {formatCurrency(group.total_price)}</span>
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
                                  title="Alterar Quiosque"
                                  onClick={() => setEditingKioskGroup(group)}
                                ><Pencil className="w-4 h-4" /></Button>
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Reagendar Data"
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
    const tabGroups = search 
      ? allGroups.filter((g: any) => normalizeString(g.customer_name).includes(normalizeString(search)))
      : groupsByTab[quadSubTab];

    const subTabConfig = [
      { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-blue-600 text-white' },
      { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
      { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden mt-6">
          <div className="p-6 border-b-2 border-slate-200 bg-blue-50/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">Reservas de Quadriciclos</h3>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Gestão de frota e horários</p>
              </div>
              <div className="flex flex-row overflow-x-auto gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto shadow-inner border border-slate-200">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setQuadSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300',
                      quadSubTab === t.key ? t.color + ' shadow-lg scale-105 ring-4 ring-blue-500/10' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shadow-sm', quadSubTab === t.key ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-700')}>
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
                                         <span className="text-[10px] font-bold text-blue-600/60">- {QUAD_MODELS_LABELS[r.quad_type] || 'Individual'}</span>
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
                                          {r.time_slot === 'INDIV' ? 'HORÁRIO NÃO DEFINIDO' : 'DUPLA (AGUARDANDO)'}
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

        {/* Priority Control - Moved to bottom */}
        <div className="bg-amber-50 md:p-6 p-4 rounded-3xl border-2 border-amber-300 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-900/20">
              <Bike className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xs md:text-sm font-black text-amber-950 uppercase tracking-wider">Capacidade Prioritária do Sistema</h3>
              <p className="text-[10px] text-amber-800 font-bold uppercase tracking-tighter">Define o total de quadriciclos disponíveis em todos os sites</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col relative" onClick={() => {
              if(!isCapacityUnlocked) {
                 if (window.confirm("ATENÇÃO: A alteração da capacidade mestre impactará todas as reservas futuras (site aberto ou painel). Deseja desbloquear a edição?")) {
                    setIsCapacityUnlocked(true);
                 }
              }
            }}>
              <span className="text-[9px] font-black text-amber-700 uppercase ml-1 mb-1">Total Disponível</span>
              <input 
                type="number" 
                value={totalQuads} 
                disabled={!isCapacityUnlocked}
                onChange={(e) => setTotalQuads(Number(e.target.value))}
                className={cn("w-24 h-11 rounded-xl border-2 px-4 text-center font-black transition-all outline-none", isCapacityUnlocked ? "border-amber-400 text-amber-900 focus:border-amber-500 bg-white shadow-inner" : "border-amber-200 text-amber-900/50 bg-amber-100/50 cursor-not-allowed")}
              />
              {!isCapacityUnlocked && <div className="absolute inset-0 cursor-pointer z-10" title="Clique para desbloquear a edição"></div>}
            </div>
            <Button 
              disabled={!isCapacityUnlocked}
              onClick={async () => {
                const ok = await updateGlobalSetting('total_quads', totalQuads);
                if (ok) {
                   toast({ title: "✓ Configuração Atualizada!", description: "A nova capacidade já está refletindo em todo o sistema." });
                   setIsCapacityUnlocked(false);
                } else toast({ title: "Erro ao atualizar", variant: "destructive" });
              }}
              className={cn("h-11 px-6 rounded-xl text-white font-black shadow-lg active:scale-95 transition-all text-[11px] uppercase cursor-pointer", isCapacityUnlocked ? "bg-amber-600 hover:bg-amber-700 shadow-amber-900/20" : "bg-amber-400 opacity-50 cursor-not-allowed")}
            >
              Salvar Alteração Master
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderOrderTab = () => (
    <div className="bg-white rounded-3xl border border-border/50 shadow-card overflow-hidden animate-in fade-in duration-500">
        <div className="p-6 border-b border-border/50 bg-amber-50/30 flex items-center justify-between flex-wrap gap-4">
           <div>
              <h3 className="text-lg font-bold text-amber-900">Histórico de Vendas e Pedidos</h3>
              <p className="text-xs text-muted-foreground">Gestão financeira centralizada</p>
           </div>
           <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-10 rounded-xl border-amber-200 bg-white shadow-sm font-bold text-xs uppercase">
                  <SelectValue placeholder="Filtrar Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-amber-100 shadow-xl">
                  <SelectItem value="all" className="text-xs font-bold uppercase">Todos os Status</SelectItem>
                  <SelectItem value="paid" className="text-xs font-bold uppercase text-whatsapp">Pagos</SelectItem>
                  <SelectItem value="pending" className="text-xs font-bold uppercase text-amber-600">Pendentes</SelectItem>
                  <SelectItem value="cancelled" className="text-xs font-bold uppercase text-red-500">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              
              {(() => {
                const filtered = orders.filter(order => {
                  if (statusFilter === 'all') return true;
                  const s = (order.status || '').toLowerCase();
                  if (statusFilter === 'paid') return s === 'paid' || s === 'pago';
                  if (statusFilter === 'pending') return s === 'pending' || s === 'pendente' || s === 'awaiting_payment' || s === 'waiting_local' || s === 'waiting_confirmation';
                  if (statusFilter === 'cancelled') return s === 'cancelled' || s === 'cancelado';
                  return s === statusFilter;
                });
                const totalAmount = filtered.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
                
                return (
                  <div className="flex gap-2">
                    <Badge className="bg-amber-100 text-amber-900 border-0 font-bold h-10 px-4 rounded-xl flex items-center">
                      Pedidos: {filtered.length}
                    </Badge>
                    <Badge className="bg-emerald-600 text-white border-0 font-black h-10 px-4 rounded-xl flex items-center shadow-lg shadow-emerald-900/20">
                      Total ({statusFilter === 'all' ? 'Geral' : statusFilter.toUpperCase()}): {formatCurrency(totalAmount)}
                    </Badge>
                  </div>
                );
              })()}
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
                {(orders || [])
                   .filter(order => {
                      if (statusFilter === 'all') return true;
                      const s = (order.status || '').toLowerCase();
                      if (statusFilter === 'paid') return s === 'paid' || s === 'pago';
                      if (statusFilter === 'pending') return s === 'pending' || s === 'pendente' || s === 'awaiting_payment' || s === 'waiting_local' || s === 'waiting_confirmation';
                      if (statusFilter === 'cancelled') return s === 'cancelled' || s === 'cancelado';
                      return s === statusFilter;
                   })
                   .map(order => (
                   <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-muted-foreground">#{order.confirmation_code || order.id.slice(0,8)}</span>
                            <span className="text-sm font-bold">{format(parseISO(order.created_at), 'dd/MM/yyyy')}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-foreground">
                          <button 
                            onClick={() => {
                              setActiveTab('reservas');
                              setSearch(order.customer_name || '');
                              setFilterDate('');
                            }}
                            className="hover:text-amber-600 transition-colors cursor-pointer text-left font-bold"
                          >
                            {order.customer_name || 'Cliente Geral'}
                          </button>
                       </td>
                      <td className="px-6 py-4 font-bold text-primary">
                         {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4">
                         <Badge className={cn(
                           "rounded-md font-bold text-[9px]",
                           (order.status === 'paid' || order.status === 'pago') ? "bg-whatsapp/10 text-whatsapp border-whatsapp/20" : 
                           (order.status === 'cancelled' || order.status === 'cancelado') ? "bg-red-50 text-red-500 border-red-100" :
                           "bg-amber-50 text-amber-600 border-amber-100"
                         )} variant="outline">
                            {order.status === 'paid' || order.status === 'pago' ? 'PAGO' : 
                             order.status === 'cancelled' || order.status === 'cancelado' ? 'CANCELADO' : 'PENDENTE'}
                         </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            {order.status !== 'paid' && order.status !== 'pago' && (
                              <Button 
                                 size="sm" 
                                 className="h-8 bg-primary rounded-lg text-[10px] font-bold" 
                                 disabled={updatingId === order.id}
                                 onClick={() => {
                                   setUpdatingId(order.id);
                                   markOrderAsPaid(order.id)
                                     .then(() => {
                                       toast({ title: "✓ Pedido Efetivado!", description: "O status foi atualizado para PAGO e o voucher gerado." });
                                       fetchData();
                                     })
                                     .catch(err => {
                                       console.error(err);
                                       toast({ title: "Erro ao efetivar", description: err.message, variant: "destructive" });
                                     })
                                     .finally(() => setUpdatingId(null));
                                 }}
                               >
                                 {updatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Efetivar'}
                               </Button>
                            )}
                            {order.status !== 'paid' && order.status !== 'pago' && (
                               <Button 
                                  size="icon" 
                                  variant="outline" 
                                  className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50" 
                                  disabled={updatingId === order.id}
                                  title="Verificar Pagamento no Asaas"
                                  onClick={() => handleSyncPayment(order.id)}
                                >
                                  {updatingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                </Button>
                            )}
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => requestDelete(order, 'order')} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
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
          {/* HEADER SECTION - FLATTENED & CLEAN */}
          <div className="flex flex-col gap-4 mb-6">
              {/* ROW 1: FLATTENED TITLE & BASIC CONTROLS */}
              <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#FFF033] whitespace-nowrap uppercase">
                         PAINEL DE RESERVAS BALNEÁRIO LESSA
                      </h1>
                      <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md w-fit">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Live Sync Ativo</span>
                      </div>
                  </div>

                  <div className="flex items-center gap-2">
                     <Button 
                        onClick={handleExportBackup}
                        variant="outline"
                        className="h-9 px-4 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-black text-[10px] hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
                      >
                        <Database className="w-3.5 h-3.5 mr-2" /> BACKUP
                      </Button>

                     <Button 
                       variant="outline"
                       className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 p-0 text-[#FFF033] shadow-lg backdrop-blur-md hover:bg-white/20" 
                       onClick={fetchData} 
                       disabled={loading}
                     >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                     </Button>
                     <Button 
                       className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-500 p-0 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all shadow-lg" 
                       onClick={handleLogout}
                     >
                        <LogOut className="w-4 h-4" />
                     </Button>
                  </div>
              </div>
          </div>
          <div className="flex flex-nowrap items-center p-2 bg-emerald-950/60 backdrop-blur-xl rounded-2xl md:rounded-3xl w-full max-w-full mr-auto border border-white/20 shadow-premium mb-6 gap-2 overflow-hidden">
             <button onClick={() => setActiveTab('painel')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'painel' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <LayoutDashboard className="w-4 h-4" /> Visão Geral
             </button>
             <button onClick={() => setActiveTab('quiosques')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'quiosques' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <Tent className="w-4 h-4" /> Quiosques
             </button>
             <button onClick={() => setActiveTab('quads')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'quads' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <Bike className="w-4 h-4" /> Quadriciclos
             </button>
             <button onClick={() => setActiveTab('reservas')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'reservas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <CalendarCheck className="w-4 h-4" /> Agenda
             </button>
             <button onClick={() => setActiveTab('vendas')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'vendas' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <ShoppingBag className="w-4 h-4" /> Vendas
             </button>
             <button onClick={() => setActiveTab('creditos')} className={cn(
               "px-4 py-2.5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-2 transition-all whitespace-nowrap", 
               activeTab === 'creditos' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"
             )}>
                <Wallet className="w-4 h-4" /> Créditos
             </button>

             <div className="flex-1" />

             {/* INTEGRATED STATS INDICATORS */}
             <div className="flex items-center gap-2 px-2">
                <div onClick={() => setActiveTab('vendas')} className="cursor-pointer px-3 py-2 rounded-xl bg-slate-900 border border-yellow-500/50 flex items-center gap-2 hover:bg-black transition-all">
                   <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                   <div className="flex flex-col -space-y-1">
                      <span className="text-[12px] md:text-[14px] font-black text-[#FFF033]">
                         {formatCurrency(
                            (bookings.filter(b => b.visit_date === format(targetDate, 'yyyy-MM-dd')).reduce((s, b) => b.status !== 'cancelled' ? s + (b.total_amount || 0) : s, 0)) + 
                            (orders.filter(o => (o.visit_date || o.created_at.split('T')[0]) === format(targetDate, 'yyyy-MM-dd')).reduce((s, o) => o.status !== 'cancelled' ? s + (o.total_amount || 0) : s, 0))
                         ).replace('R$', '').trim()}
                      </span>
                      <span className="text-[6px] font-black uppercase text-yellow-500/70">Receita</span>
                   </div>
                </div>

                <div onClick={() => setActiveTab('reservas')} className="cursor-pointer px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/50 flex items-center gap-2 hover:bg-black transition-all">
                   <Users className="w-3.5 h-3.5 text-emerald-400" />
                   <div className="flex flex-col -space-y-1">
                      <span className="text-[12px] md:text-[14px] font-black text-emerald-400">{bookings.length + orders.length}</span>
                      <span className="text-[6px] font-black uppercase text-emerald-500/70">Agenda</span>
                   </div>
                </div>

                <InternalBookingAssistant 
                   onCreated={fetchData} 
                   isHoliday={isHoliday} 
                   isAllowedDay={isAllowedDay} 
                   kioskReservations={kioskReservations}
                   quadReservations={quadReservations}
                />
             </div>
          </div>
{/* CONTENT AREA WITH GRADIENT BACKGROUND */}
          <div className="min-h-[500px] md:min-h-[600px] bg-white/40 backdrop-blur-md rounded-2xl md:rounded-[2rem] p-4 md:p-8 border border-white/60 shadow-premium">
             {activeTab === 'painel' && renderDashboard()}
                                       {activeTab === 'reservas' && (
               <div className="space-y-4">
                  <AgendaHeader 
                    agendaSubTab={agendaSubTab}
                    setAgendaSubTab={setAgendaSubTab as any}
                    search={search}
                    setSearch={setSearch}
                    filterDate={filterDate}
                    setFilterDate={setFilterDate}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    isAllowedDay={isAllowedDay}
                  />

                  <BookingTable  
                      bookings={[...bookings, ...(orders || []).map(o => ({...o, is_order: true}))].filter(b => {
                        const bDate = b.visit_date || (typeof b.created_at === 'string' ? b.created_at.split('T')[0] : '');
                        const today = format(new Date(), 'yyyy-MM-dd');
                        const matchesSearch = !search || 
                          (b.name || b.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.phone || b.customer_phone || '').includes(search) ||
                          (b.confirmation_code || '').includes(search);
                        const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'pending' && (!b.status || b.status.toLowerCase() === 'pending' || b.status.toLowerCase() === 'awaiting_payment' || b.status.toLowerCase() === 'waiting_local')) ||
                          (b.status && b.status.toLowerCase() === statusFilter.toLowerCase());
                        let matchesDate = true;
                        if (filterDate) { matchesDate = bDate && bDate.startsWith(filterDate); } 
                        else if (!search) {
                          if (agendaSubTab === 'hoje') matchesDate = bDate === today;
                          else if (agendaSubTab === 'futuras') matchesDate = bDate > today;
                          else if (agendaSubTab === 'historico') matchesDate = bDate < today;
                        }
                        return matchesSearch && matchesStatus && matchesDate;
                      })}
                      onStatusChange={updateBookingStatus}
                      onAddNote={addBookingNote}
                      onReschedule={async (id, date, isOrder) => {
                         setLoading(true);
                         try {
                           const table = isOrder ? 'orders' : 'bookings';
                           const idField = isOrder ? 'order_id' : 'booking_id';
                           
                           // 1. Update the main record
                           const { error: mainError } = await supabase.from(table).update({ visit_date: date }).eq('id', id);
                           if (mainError) throw mainError;

                           // 2. Update related kiosks
                           await supabase.from('kiosk_reservations').update({ reservation_date: date }).eq(idField, id);
                           
                           // 3. Update related quads
                           await supabase.from('quad_reservations').update({ reservation_date: date }).eq(idField, id);

                           toast({ title: "✓ Toda a reserva foi reagendada para " + format(parseISO(date), 'dd/MM/yyyy') });
                           fetchData();
                         } catch (err: any) {
                           console.error('Reschedule error:', err);
                           toast({ title: "Erro ao reagendar", description: err.message, variant: "destructive" });
                         } finally {
                           setLoading(false);
                         }
                      }}
                      onConvertToCredit={(b) => convertToCredit(b, b.is_order ? 'order' : 'reservas')}
                      onDelete={async (id, isOrder) => {
                          const table = isOrder ? 'orders' : 'bookings';
                          const idField = isOrder ? 'order_id' : 'booking_id';
                          if (!confirm("Deseja realmente excluir esta reserva e todos os itens vinculados?")) return;
                          
                          setLoading(true);
                          try {
                            // 1. Delete related items first to avoid foreign key issues
                            await supabase.from('kiosk_reservations').delete().eq(idField, id);
                            await supabase.from('quad_reservations').delete().eq(idField, id);
                            await supabase.from('order_items').delete().eq('order_id', id);
                            
                            // 2. Delete main record
                            const { error } = await supabase.from(table).delete().eq('id', id);
                            if (error) throw error;
                            
                            toast({ title: "✓ Removido com sucesso" });
                            fetchData();
                          } catch (err: any) {
                            console.error('Delete error:', err);
                            toast({ title: "Erro ao remover: " + (err?.message || ''), variant: "destructive" });
                          } finally {
                            setLoading(false);
                          }
                      }}
                      onRemoveItem={handleRemoveItem}
                      updatingId={updatingId}
                      onSyncPayment={handleSyncPayment}

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
                        } finally { setIsUploading(false); }
                      }}
                      isUploading={isUploading}
                      onRefresh={fetchData}
                      onGeneratePayment={handleGeneratePayment}
                      onUpdateCustomer={async (id, data, isOrder) => {
                        const table = isOrder ? 'orders' : 'bookings';
                        const updateData = isOrder ? { customer_name: data.name, customer_phone: data.phone, customer_cpf: data.cpf } : { name: data.name, phone: data.phone, cpf: data.cpf };
                        const { error } = await supabase.from(table).update(updateData).eq('id', id);
                        if (error) { toast({ title: "Erro ao atualizar cliente", variant: "destructive" }); return false; }
                        else { toast({ title: "✓ Cliente atualizado" }); fetchData(); return true; }
                      }}
                      isAllowedDay={isAllowedDay}
                      kioskReservations={kioskReservations}
                      quadReservations={quadReservations}
                      totalQuads={totalQuads}
                  />
               </div>
             )}
             {activeTab === 'quiosques' && renderKioskTab()}
             {activeTab === 'quads' && renderQuadTab()}
             {activeTab === 'vendas' && renderOrderTab()}
             {activeTab === 'creditos' && (
                <AdminCreditsTab credits={credits} fetchData={fetchData} toast={toast} />
             )}
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
         <DialogContent className="rounded-[2rem] border-4 border-blue-200 shadow-3xl max-w-md bg-white p-0 overflow-hidden">
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
                      const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= (totalQuads * 4);
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
                  /* MODAL HIDDEN */
        {/* Payment Modal for Admin PIX Generation */}
        {selectedPaymentBooking && (
          <PaymentModal
            open={isPaymentModalOpen}
            onOpenChange={setIsPaymentModalOpen}
            orderId={selectedPaymentBooking.id}
            name={selectedPaymentBooking.name || selectedPaymentBooking.customer_name}
            email={selectedPaymentBooking.email || 'contato@balneariolessa.com.br'}
            phone={selectedPaymentBooking.phone || selectedPaymentBooking.customer_phone}
            cpf={selectedPaymentBooking.cpf || selectedPaymentBooking.customer_cpf}
            totalAmount={selectedPaymentBooking.total_amount}
            initialMethod="PIX"
            onSuccess={() => {
               fetchData();
               setIsPaymentModalOpen(false);
            }}
          />
        )}

        {editingKioskGroup && (
           <EditKioskDialog 
             group={editingKioskGroup} 
             onClose={() => setEditingKioskGroup(null)} 
             onUpdated={() => fetchData()} 
             updateOrderTotal={updateOrderTotal}
           />
        )}
    </div>

  );
}

// Logic for Editing Kiosks
function EditKioskDialog({ group, onClose, onUpdated, updateOrderTotal }: any) {
  const [selectedKiosks, setSelectedKiosks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchOccupied = async () => {
      const ids = await getBookedKioskIds(group.reservation_date);
      // Exclude current kiosks from occupied list so they show as selectable
      const currentIds = group.items.map((i: any) => i.kiosk_id).filter((id: any) => !isNaN(id)).map(Number);
      setBookedIds(ids.filter(id => !currentIds.includes(id)));
      setSelectedKiosks(currentIds);
    };
    fetchOccupied();
  }, [group]);

  const handleSave = async () => {
    if (selectedKiosks.length !== group.items.length) {
      toast({ title: 'Atenção', description: `Selecione exatamente ${group.items.length} quiosque(s).`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const orderId = group.items[0].order_id;
      
      for (let i = 0; i < group.items.length; i++) {
        const item = group.items[i];
        const newKioskId = selectedKiosks[i];
        const newKiosk = KIOSKS.find(k => k.id === newKioskId);
        const kioskType = newKiosk?.type === 'Maior' ? 'maior' : 'menor';
        const newPrice = newKiosk?.type === 'Maior' ? 100 : 75;

        // Prepare to find linked order item
        let oiId = null;
        const orderId = group.items[0]?.order_id;
        if (orderId && !String(orderId).startsWith('order-')) {
          const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
          const kioskItem = oItems?.find(oi => 
            (oi.product_id?.toLowerCase().includes('quiosque') || (oi as any).product_name?.toLowerCase().includes('quiosque')) &&
            (oi.id === item.order_item_id || group.items.length === 1)
          );
          if (kioskItem) oiId = kioskItem.id;
        }

        // Use edge function to bypass RLS for admin modifications
        const kioskLabel = String(newKioskId).padStart(2, '0');
        const { data: funcData, error: funcErr } = await supabase.functions.invoke('create-internal-order', {
           body: {
              action: 'update_kiosk',
              item_id: item.id,
              kiosk_id: newKioskId,
              kiosk_type: kioskType,
              price: newPrice,
              order_item_id: oiId,
              new_product_id: `Quiosque ${kioskLabel}`
           }
        });
        
        if (funcErr || (funcData && !funcData.success)) {
           throw funcErr || new Error(funcData?.error || 'Erro na edge function');
        }
      }
      
      if (orderId && !String(orderId).startsWith('order-')) {
        await updateOrderTotal(orderId);
      }
      toast({ title: 'Sucesso!', description: 'Quiosques atualizados.' });
      onUpdated();
      onClose();
    } catch(e: any) { 
      console.error(e);
      toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' }); 
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-primary uppercase">Mudar Quiosques</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">Selecione {group.items.length} unidades para a data {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}:</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5].map(id => {
              const kiosk = KIOSKS.find(k => k.id === id);
              const isBooked = bookedIds.includes(id);
              const isSelected = selectedKiosks.includes(id);
              return (
                <button
                  key={id} disabled={isBooked || loading}
                  onClick={() => {
                    if (isSelected) setSelectedKiosks(prev => prev.filter(v => v !== id));
                    else if (selectedKiosks.length < group.items.length) setSelectedKiosks(prev => [...prev, id]);
                  }}
                  className={cn("p-3 rounded-2xl flex flex-col items-center gap-1 transition-all border-2", 
                    isBooked ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" :
                    isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-lg scale-105" :
                    "bg-white border-slate-100 hover:border-emerald-200 text-slate-700"
                  )}
                >
                  <span className="text-[10px] font-black uppercase">{kiosk?.name.replace('QUIOSQUE - ', 'Q-')}</span>
                  {isBooked && <span className="text-[8px] font-bold">OCUPADO</span>}
                </button>
              );
            })}
          </div>
          <div className="pt-4 flex gap-2">
             <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
             <Button className="flex-1 bg-primary rounded-xl font-black" onClick={handleSave} disabled={loading || selectedKiosks.length !== group.items.length}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditQuadDialog({ item, onClose, onUpdated, updateOrderTotal }: any) {
  const [model, setModel] = useState(item.quad_type || 'individual');
  const [time, setTime] = useState(item.time_slot || '09:00');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const orderId = item.order_id;
      const qDate = parseToRODate(item.reservation_date);
      const day = qDate.getDay();
      const qD = getQuadDiscount(qDate);
      const discount = (day === 1 || day === 5) ? 0.2 : qD;
      
      const unitPrice = (QUAD_PRICES[model as keyof typeof QUAD_PRICES] || 150) * (1 - discount);
      
      // 1. Prepare to find linked order item
      let oiId = null;
      if (orderId && !String(orderId).startsWith('order-')) {
         const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
         const quadItem = oItems?.find(oi => 
           (oi.product_id?.toLowerCase().includes('quad') || (oi as any).product_name?.toLowerCase().includes('quad')) &&
           (normalizeQuadType((oi as any).product_name || oi.product_id) === normalizeQuadType(item.quad_type))
         );
         if (quadItem) oiId = quadItem.id;
      }

      // Use edge function to bypass RLS for admin modifications
      const { data: funcData, error: funcErr } = await supabase.functions.invoke('create-internal-order', {
         body: {
            action: 'update_quad',
            item_id: item.id,
            quad_type: model,
            time_slot: time,
            price: unitPrice * (item.quantity || 1),
            order_item_id: oiId,
            new_product_id: `Quadriciclo ${QUAD_MODELS_LABELS[model as keyof typeof QUAD_MODELS_LABELS] || 'Individual'}`
         }
      });

      if (funcErr || (funcData && !funcData.success)) {
         throw funcErr || new Error(funcData?.error || 'Erro na edge function');
      }
      
      if (orderId && !String(orderId).startsWith('order-')) {
         await updateOrderTotal(orderId);
      }

      toast({ title: "Sucesso!", description: "Reserva atualizada com sucesso." });
      onUpdated();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-primary uppercase">Mudar Modelo do Quad</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-2xl shadow-xl">
                  {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="font-black uppercase text-xs py-3">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="pt-4 flex gap-2">
             <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
             <Button className="flex-1 bg-primary rounded-xl font-black" onClick={handleSave} disabled={loading}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

