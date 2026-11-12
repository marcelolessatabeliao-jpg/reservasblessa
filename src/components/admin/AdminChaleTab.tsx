import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Home,
  DoorOpen,
  ShoppingBag, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Clock, 
  Calendar, 
  Search, 
  Filter,
  Coffee,
  Bed,
  Sparkles,
  Tent,
  Phone,
  UserCheck,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Info,
  Plus,
  Minus,
  Trash2,
  CalendarDays,
  X,
  Edit,
  FileCheck,
  StickyNote,
  QrCode,
  CreditCard,
  Share2,
  Check,
  RotateCcw,
  Paperclip,
  Copy,
  DollarSign,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Upload,
  Baby
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  formatCurrency,
  CHALE_UNITS,
  CHALE_PACKAGES,
  ChalePackageType,
  calculateStayPricing,
  calculateChaleTotal,
  calculateChaleGrossTotal,
  isChaleCheckInDay,
  isChaleCheckOutDay,
  QUAD_TIMES,
  KIOSK_INFO,
  QUAD_PRICES
} from '@/lib/booking-types';
import { AddItemsToBookingDialog } from './AddItemsToBookingDialog';
import { PaymentModal } from '@/components/booking/PaymentModal';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getGlobalSetting, updateGlobalSetting } from '@/lib/booking-service';
import html2canvas from 'html2canvas';

export interface ChaleReservation {
  id: string;
  chaleId: number;
  guestName: string;
  phone: string;
  cpf?: string;
  checkInDate: string;  // 'yyyy-MM-dd'
  checkInTime: string;  // '15:00' ou '09:00'
  checkOutDate: string; // 'yyyy-MM-dd'
  checkOutTime: string; // '12:00'
  packageTitle: string;
  packageType?: string;
  occupancyType: 'individual' | 'casal';
  adults: number;
  children: number;
  adultNames?: string[];
  childNames?: { name: string; ageLabel: string; ageGroup?: 'under11' | '12plus' }[];
  extraItems?: { name: string; quantity: number; price: number; timeSlot?: string }[];
  totalPrice: number;
  paymentMethod: string;
  status: 'paid' | 'pending' | 'cancelled';
  isCheckedIn: boolean;
  notes?: string;
  receiptUrl?: string | null;
  isOrder?: boolean;
  orderId?: string;
  confirmationCode?: string;
}

interface AdminChaleTabProps {
  orders?: any[];
  onRefresh?: () => void;
  onStatusChange?: (id: string, newStatus: string, isOrder: boolean) => Promise<void>;
  onAddNote?: (id: string, note: string, isOrder: boolean) => Promise<void>;
}

export function AdminChaleTab({ 
  orders = [], 
  onRefresh,
  onStatusChange,
  onAddNote 
}: AdminChaleTabProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'disponivel' | 'indisponivel' | 'ocupado'>('todos');
  const [activeSubTab, setActiveSubTab] = useState<'mapa' | 'chales' | 'camping'>('mapa');

  // RESERVAS MANUAIS SALVAS LOCALMENTE
  const [localReservations, setLocalReservations] = useState<ChaleReservation[]>(() => {
    try {
      const saved = localStorage.getItem('lessa_admin_chale_reservations_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      
      return [
        {
          id: 'res-default-1',
          chaleId: 1,
          guestName: 'Carlos Oliveira',
          phone: '(69) 99341-2290',
          cpf: '123.456.789-00',
          checkInDate: '2026-11-06',
          checkInTime: '15:00',
          checkOutDate: '2026-11-08',
          checkOutTime: '12:00',
          packageTitle: 'Combo 2 Noites — Sex a Dom (10% OFF)',
          packageType: 'combo-2n-sex-dom',
          occupancyType: 'casal',
          adults: 2,
          children: 1,
          adultNames: ['Carlos Oliveira (Titular)', 'Fernanda Oliveira (Acompanhante)'],
          childNames: [{ name: 'Lucas Oliveira (8 anos)', ageLabel: 'Até 11 anos • Filho(a) Hóspede', ageGroup: 'under11' }],
          extraItems: [
            { name: 'Quiosque 02 (Churrasqueira, Pia e Grelha)', quantity: 1, price: 90.00 },
            { name: 'Passeio de Quadriciclo — De Dupla', quantity: 1, price: 175.50, timeSlot: '10:00' }
          ],
          totalPrice: 1174.50,
          paymentMethod: 'PIX',
          status: 'paid',
          isCheckedIn: true,
          confirmationCode: 'CHA-8931',
          notes: 'Reserva online - 10% OFF aplicado. Day use de domingo incluso até 17h (saída chalé 12h).'
        }
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lessa_admin_chale_reservations_v2', JSON.stringify(localReservations));
    } catch (err) {
      console.error('Erro ao salvar reservas de chalé:', err);
    }
  }, [localReservations]);

  // Status de bloqueio manual (Manutenção: amarelo) - Default: Chalé 06 e Vidros 07 a 12 indisponíveis
  const [manualStatuses, setManualStatuses] = useState<Record<number, 'disponivel' | 'indisponivel'>>(() => {
    try {
      const saved = localStorage.getItem('lessa_admin_chale_statuses_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
      return {
        6: 'indisponivel',
        7: 'indisponivel',
        8: 'indisponivel',
        9: 'indisponivel',
        10: 'indisponivel',
        11: 'indisponivel',
        12: 'indisponivel'
      };
    } catch {
      return {
        6: 'indisponivel',
        7: 'indisponivel',
        8: 'indisponivel',
        9: 'indisponivel',
        10: 'indisponivel',
        11: 'indisponivel',
        12: 'indisponivel'
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lessa_admin_chale_statuses_v2', JSON.stringify(manualStatuses));
    } catch (err) {
      console.error('Erro ao salvar statuses de chalé:', err);
    }
  }, [manualStatuses]);

  // Sincronizar bloqueios de manutenção com Supabase (site_settings -> disabled_chale_ids)
  useEffect(() => {
    let active = true;
    getGlobalSetting('disabled_chale_ids', null).then((remoteDisabled) => {
      if (!active) return;
      if (Array.isArray(remoteDisabled)) {
        const disabledSet = new Set(remoteDisabled.map(Number).filter((n) => !isNaN(n)));
        const synced: Record<number, 'disponivel' | 'indisponivel'> = {};
        CHALE_UNITS.forEach((unit) => {
          synced[unit.id] = disabledSet.has(unit.id) ? 'indisponivel' : 'disponivel';
        });
        setManualStatuses(synced);
      } else {
        const currentDisabled = Object.entries(manualStatuses)
          .filter(([, status]) => status === 'indisponivel')
          .map(([id]) => Number(id))
          .filter((n) => !isNaN(n));
        updateGlobalSetting('disabled_chale_ids', currentDisabled);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Edição de notas inline
  const [editingNoteChaleId, setEditingNoteChaleId] = useState<number | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // Modal: Nova Reserva / Alterar Reserva
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [isChaleLocked, setIsChaleLocked] = useState(false);

  // Form Fields
  const [formChaleId, setFormChaleId] = useState<number>(1);
  const [formGuestName, setFormGuestName] = useState('');
  const [formAdult2Name, setFormAdult2Name] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formCheckInDate, setFormCheckInDate] = useState('2026-11-06');
  const [formCheckInTime, setFormCheckInTime] = useState('15:00');
  const [formCheckOutDate, setFormCheckOutDate] = useState('2026-11-08');
  const [formCheckOutTime, setFormCheckOutTime] = useState('12:00');
  const [formOccupancyType, setFormOccupancyType] = useState<'casal' | 'individual'>('casal');
  const [formPackageType, setFormPackageType] = useState<ChalePackageType | 'custom'>('combo-2n-sex-dom');
  const [formKids, setFormKids] = useState<{ name: string; ageGroup: 'under11' | '12plus' }[]>([]);
  const [formApplySiteDiscount, setFormApplySiteDiscount] = useState<boolean>(true);
  const [formCustomPriceOverride, setFormCustomPriceOverride] = useState<number | null>(null);
  const [formPaymentMethod, setFormPaymentMethod] = useState('PIX');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [formNotes, setFormNotes] = useState('');

  // Calendários Popover dentro do Modal
  const [isInCalendarOpen, setIsInCalendarOpen] = useState(false);
  const [isOutCalendarOpen, setIsOutCalendarOpen] = useState(false);

  // Adição de Serviços Extras na Reserva Interna
  const [extraKioskType, setExtraKioskType] = useState<'none' | 'familiar' | 'menor' | 'maior'>('none');
  const [extraKioskNumber, setExtraKioskNumber] = useState<number>(1);
  const [extraQuadType, setExtraQuadType] = useState<'none' | 'individual' | 'dupla'>('none');
  const [extraQuadTime, setExtraQuadTime] = useState<string>('10:00');
  const [extraQuadQty, setExtraQuadQty] = useState<number>(1);
  const [extraPescaQty, setExtraPescaQty] = useState<number>(0);
  const [extraSabaoQty, setExtraSabaoQty] = useState<number>(0);

  // PaymentModal para gerar QR Code PIX ou Cartão diretamente pela reserva interna
  const [adminPaymentData, setAdminPaymentData] = useState<{
    open: boolean;
    orderId: string;
    name: string;
    phone: string;
    cpf: string;
    totalAmount: number;
    initialMethod: 'PIX' | 'CREDIT_CARD';
    chaleId: number;
  } | null>(null);
  const [generatingPayment, setGeneratingPayment] = useState(false);

  // Modal: Reagendar Rápido
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleChaleId, setRescheduleChaleId] = useState<number | null>(null);
  const [rescheduleInDate, setRescheduleInDate] = useState('');
  const [rescheduleOutDate, setRescheduleOutDate] = useState('');

  // Modal: Gerador de Imagem do Voucher
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherRes, setVoucherRes] = useState<ChaleReservation | null>(null);
  const [voucherImageGenerated, setVoucherImageGenerated] = useState<string | null>(null);
  const [isGeneratingVoucherImage, setIsGeneratingVoucherImage] = useState(false);
  const voucherPrintRef = useRef<HTMLDivElement>(null);

  // Modal: Adicionar Itens / Produtos e Serviços manualmente à reserva
  const [isAddItemsOpen, setIsAddItemsOpen] = useState(false);
  const [addItemsBooking, setAddItemsBooking] = useState<any>(null);

  // Modal: Gerenciador de Anexos / Comprovantes
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptRes, setReceiptRes] = useState<ChaleReservation | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Datas de referência (Quinta, Sexta, Sábado, Domingo, Segunda) para os pacotes do modal
  const refWeekendDates = useMemo(() => {
    const base = formCheckInDate ? new Date(`${formCheckInDate}T12:00:00`) : new Date();
    const validBase = isNaN(base.getTime()) ? new Date() : base;
    const day = validBase.getDay();
    let thursday = new Date(validBase);
    if (day === 4) {
      // quinta
    } else if (day === 5) {
      thursday = addDays(validBase, -1);
    } else if (day === 6) {
      thursday = addDays(validBase, -2);
    } else if (day === 0) {
      thursday = addDays(validBase, -3);
    } else if (day === 1) {
      thursday = addDays(validBase, -4);
    } else {
      const diff = (4 - day + 7) % 7;
      thursday = addDays(validBase, diff);
    }
    return {
      thursday,
      friday: addDays(thursday, 1),
      saturday: addDays(thursday, 2),
      sunday: addDays(thursday, 3),
      monday: addDays(thursday, 4),
    };
  }, [formCheckInDate]);

  // Motor automático de cálculo de valores da reserva interna
  const modalStayPricing = useMemo(() => {
    const inDate = formCheckInDate ? new Date(`${formCheckInDate}T12:00:00`) : null;
    const outDate = formCheckOutDate ? new Date(`${formCheckOutDate}T12:00:00`) : null;
    return calculateStayPricing(inDate, outDate);
  }, [formCheckInDate, formCheckOutDate]);

  const modalPricingBreakdown = useMemo(() => {
    const inDate = formCheckInDate ? new Date(`${formCheckInDate}T12:00:00`) : null;
    const outDate = formCheckOutDate ? new Date(`${formCheckOutDate}T12:00:00`) : null;
    const pkgType: ChalePackageType = formPackageType === 'custom' ? 'combo-2n-sex-dom' : formPackageType;
    const adultsCount = formOccupancyType === 'casal' ? 2 : 1;
    const kidsAges = formKids.map(k => k.ageGroup);

    const chaleGross = calculateChaleGrossTotal(
      pkgType,
      adultsCount,
      kidsAges.length,
      1,
      inDate,
      outDate,
      { [formChaleId]: formOccupancyType },
      [formChaleId],
      kidsAges
    );

    const chaleComboOrTable = calculateChaleTotal(
      pkgType,
      adultsCount,
      kidsAges.length,
      undefined,
      true,
      1,
      inDate,
      outDate,
      { [formChaleId]: formOccupancyType },
      [formChaleId],
      kidsAges
    );

    // Se for diária avulsa (1 noite) e o desconto online de 10% estiver ativo, aplica 10% OFF sobre a diária avulsa também
    const isSingleNight = modalStayPricing.nightsCount === 1;
    const chaleFinal = formApplySiteDiscount
      ? (isSingleNight ? Math.round(chaleGross * 0.90 * 100) / 100 : chaleComboOrTable)
      : chaleGross;

    // Serviços extras
    const discountFactor = formApplySiteDiscount ? 0.90 : 1.0;
    const kioskGross = extraKioskType !== 'none' ? KIOSK_INFO[extraKioskType].price : 0;
    const kioskNet = Math.round(kioskGross * discountFactor * 100) / 100;

    const quadGross = extraQuadType !== 'none' ? QUAD_PRICES[extraQuadType] * extraQuadQty : 0;
    const quadNet = Math.round(quadGross * discountFactor * 100) / 100;

    const pescaGross = extraPescaQty * 20;
    const pescaNet = Math.round(pescaGross * discountFactor * 100) / 100;

    const sabaoGross = extraSabaoQty * 10;
    const sabaoNet = Math.round(sabaoGross * discountFactor * 100) / 100;

    const extrasGross = kioskGross + quadGross + pescaGross + sabaoGross;
    const extrasNet = kioskNet + quadNet + pescaNet + sabaoNet;

    const grandGross = chaleGross + extrasGross;
    const calculatedGrandTotal = Math.round((chaleFinal + extrasNet) * 100) / 100;
    const finalTotal = formCustomPriceOverride !== null ? formCustomPriceOverride : calculatedGrandTotal;

    return {
      chaleGross,
      chaleFinal,
      kioskGross,
      kioskNet,
      quadGross,
      quadNet,
      pescaGross,
      pescaNet,
      sabaoGross,
      sabaoNet,
      extrasGross,
      extrasNet,
      grandGross,
      calculatedGrandTotal,
      finalTotal
    };
  }, [
    formCheckInDate,
    formCheckOutDate,
    formPackageType,
    formOccupancyType,
    formKids,
    formChaleId,
    formApplySiteDiscount,
    formCustomPriceOverride,
    modalStayPricing.nightsCount,
    extraKioskType,
    extraQuadType,
    extraQuadQty,
    extraPescaQty,
    extraSabaoQty
  ]);

  // Aplicar pacote comercial e atualizar datas/horários automaticamente
  const handleSelectPackagePreset = (pkg: ChalePackageType | 'custom') => {
    setFormPackageType(pkg);
    setFormCustomPriceOverride(null);
    if (pkg === 'custom') return;

    const { thursday, friday, saturday, sunday, monday } = refWeekendDates;
    let inD = friday;
    let outD = sunday;
    let inTime = '15:00';

    if (pkg === 'combo-2n-sex-dom') {
      inD = friday; outD = sunday; inTime = '15:00';
    } else if (pkg === 'combo-2n-qui-sab') {
      inD = thursday; outD = saturday; inTime = '09:00';
    } else if (pkg === 'combo-2n-sab-seg') {
      inD = saturday; outD = monday; inTime = '15:00';
    } else if (pkg === 'combo-3n-qui-dom') {
      inD = thursday; outD = sunday; inTime = '09:00';
    } else if (pkg === 'combo-3n-sex-seg') {
      inD = friday; outD = monday; inTime = '15:00';
    } else if (pkg === 'combo-4n-qui-seg') {
      inD = thursday; outD = monday; inTime = '09:00';
    } else if (pkg === 'diaria-qui-sex') {
      inD = thursday; outD = friday; inTime = '15:00';
    } else if (pkg === 'diaria-sex-sab') {
      inD = friday; outD = saturday; inTime = '15:00';
    } else if (pkg === 'diaria-sab-dom') {
      inD = saturday; outD = sunday; inTime = '15:00';
    } else if (pkg === 'diaria-dom-seg') {
      inD = sunday; outD = monday; inTime = '15:00';
    }

    setFormCheckInDate(format(inD, 'yyyy-MM-dd'));
    setFormCheckOutDate(format(outD, 'yyyy-MM-dd'));
    setFormCheckInTime(inTime);
    setFormCheckOutTime('12:00');
  };

  // Atualizar data de entrada pelo calendário do modal
  const handleModalSelectCheckIn = (d: Date) => {
    const day = d.getDay();
    const inStr = format(d, 'yyyy-MM-dd');
    setFormCheckInDate(inStr);
    setFormCheckInTime(day === 4 ? '09:00' : '15:00');
    setFormCheckOutTime('12:00');
    setFormCustomPriceOverride(null);

    let outDate = addDays(d, 2);
    let nextPkg: ChalePackageType = 'combo-2n-sex-dom';
    if (day === 4) {
      outDate = addDays(d, 3);
      nextPkg = 'combo-3n-qui-dom';
    } else if (day === 5) {
      outDate = addDays(d, 2);
      nextPkg = 'combo-2n-sex-dom';
    } else if (day === 6) {
      outDate = addDays(d, 1);
      nextPkg = 'diaria-sab-dom';
    } else if (day === 0) {
      outDate = addDays(d, 1);
      nextPkg = 'diaria-dom-seg';
    }
    setFormCheckOutDate(format(outDate, 'yyyy-MM-dd'));
    setFormPackageType(nextPkg);
    setIsInCalendarOpen(false);
  };

  // Atualizar data de saída pelo calendário do modal
  const handleModalSelectCheckOut = (d: Date) => {
    const inDate = formCheckInDate ? new Date(`${formCheckInDate}T12:00:00`) : new Date();
    let validOut = d <= inDate ? addDays(inDate, 1) : d;
    setFormCheckOutDate(format(validOut, 'yyyy-MM-dd'));
    setFormCheckOutTime('12:00');
    setFormCustomPriceOverride(null);

    const inDay = inDate.getDay();
    const outDay = validOut.getDay();
    const diffNights = Math.round(Math.abs(validOut.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));

    let nextPkg: ChalePackageType = 'combo-2n-sex-dom';
    if (inDay === 5 && outDay === 0 && diffNights === 2) nextPkg = 'combo-2n-sex-dom';
    else if (inDay === 4 && outDay === 6 && diffNights === 2) nextPkg = 'combo-2n-qui-sab';
    else if (inDay === 6 && outDay === 1 && diffNights === 2) nextPkg = 'combo-2n-sab-seg';
    else if (inDay === 4 && outDay === 0 && diffNights === 3) nextPkg = 'combo-3n-qui-dom';
    else if (inDay === 5 && outDay === 1 && diffNights === 3) nextPkg = 'combo-3n-sex-seg';
    else if (inDay === 4 && outDay === 1 && diffNights === 4) nextPkg = 'combo-4n-qui-seg';
    else if (inDay === 4 && outDay === 5 && diffNights === 1) nextPkg = 'diaria-qui-sex';
    else if (inDay === 5 && outDay === 6 && diffNights === 1) nextPkg = 'diaria-sex-sab';
    else if (inDay === 6 && outDay === 0 && diffNights === 1) nextPkg = 'diaria-sab-dom';
    else if (inDay === 0 && outDay === 1 && diffNights === 1) nextPkg = 'diaria-dom-seg';

    setFormPackageType(nextPkg);
    setIsOutCalendarOpen(false);
  };

  // Extrair reservas reais de Chalés e Camping a partir de orders
  const { realChaleOrders, campingBookings } = useMemo(() => {
    const list: ChaleReservation[] = [];
    const campings: any[] = [];

    (orders || []).forEach((order: any) => {
      if (!order) return;
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const orderDate = order.visit_date || (typeof order.created_at === 'string' ? order.created_at.split('T')[0] : '');

      items.forEach((item: any) => {
        if (!item) return;
        const prod = (item.product_id || item.product_name || '').toLowerCase();
        
        if (prod.includes('chalé') || prod.includes('chale')) {
          let meta = item.metadata;
          if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
          }
          meta = meta || {};

          const chaleId = meta.chale_id || 1;
          const pkgId = meta.package_type || 'combo-2n-sex-dom';
          const pkg = CHALE_PACKAGES[pkgId as keyof typeof CHALE_PACKAGES];
          const pkgTitle = pkg ? pkg.title : (item.product_name || item.product_id || 'Hospedagem em Chalé');
          const cInDate = meta.check_in_date || orderDate || format(new Date(), 'yyyy-MM-dd');
          const cOutDate = meta.check_out_date || cInDate;

          list.push({
            id: order.id,
            chaleId: Number(chaleId),
            guestName: order.customer_name || 'Hóspede Lessa',
            phone: order.customer_phone || '(Não informado)',
            cpf: order.customer_cpf,
            checkInDate: cInDate,
            checkInTime: meta.check_in_time || '15:00',
            checkOutDate: cOutDate,
            checkOutTime: meta.check_out_time || '12:00',
            packageTitle: pkgTitle,
            packageType: pkgId,
            occupancyType: meta.occupancy_type || 'casal',
            adults: Math.min(2, Math.max(1, meta.adults || order.adults || 2)),
            children: meta.children || order.children || 0,
            totalPrice: Number(item.unit_price || order.total_amount || 0),
            paymentMethod: order.payment_method || 'PIX',
            status: order.status === 'paid' ? 'paid' : 'pending',
            isCheckedIn: false,
            notes: order.notes || 'Reserva online realizada pelo cliente',
            receiptUrl: order.receipt_url || null,
            isOrder: true,
            orderId: order.id,
            confirmationCode: order.confirmation_code
          });
        }

        if (prod.includes('camping')) {
          let formattedCampingDate = '—';
          if (orderDate) {
            try {
              const d = new Date(orderDate);
              if (!isNaN(d.getTime())) {
                formattedCampingDate = format(d, 'dd/MM/yyyy');
              } else {
                formattedCampingDate = String(orderDate);
              }
            } catch {
              formattedCampingDate = String(orderDate);
            }
          }

          campings.push({
            orderId: order.id,
            customerName: order.customer_name || 'Campista Lessa',
            phone: order.customer_phone || 'Não informado',
            peopleCount: item.quantity || 1,
            unitPrice: item.unit_price || 100,
            totalPrice: (item.quantity || 1) * (item.unit_price || 100),
            date: formattedCampingDate,
            confirmationCode: order.confirmation_code,
            status: order.status || 'Confirmado'
          });
        }
      });
    });

    return { realChaleOrders: list, campingBookings: campings };
  }, [orders]);

  // TODAS AS RESERVAS ATIVAS (Locais + Supabase Online)
  const allActiveReservations = useMemo(() => {
    const localList = Array.isArray(localReservations) ? localReservations : [];
    const onlineList = Array.isArray(realChaleOrders) ? realChaleOrders : [];
    return [...localList, ...onlineList].filter(r => r && r.status !== 'cancelled');
  }, [localReservations, realChaleOrders]);

  // MAPA DE OCUPAÇÃO: DATA SELECIONADA (Inicia a partir do dia 13/11/2026 - Primeira sexta disponível)
  const [mapTargetDate, setMapTargetDate] = useState<Date>(() => new Date('2026-11-13T12:00:00'));
  const [isMapCalendarOpen, setIsMapCalendarOpen] = useState(false);
  const mapTargetDateStr = format(mapTargetDate, 'yyyy-MM-dd');

  // RESUMO DE DATAS COM RESERVAS (MARCADORES NO CALENDÁRIO E DIAS)
  const bookedDatesSummary = useMemo(() => {
    const map: Record<string, { chaleId: number; guestName: string; code?: string; res: ChaleReservation }[]> = {};
    allActiveReservations.forEach(r => {
      if (!r || !r.checkInDate) return;
      try {
        const inStr = r.checkInDate.split('T')[0];
        const outStr = r.checkOutDate ? r.checkOutDate.split('T')[0] : inStr;
        const inD = parseISO(inStr);
        const outD = parseISO(outStr);
        let curr = new Date(inD);
        while (curr <= outD) {
          const dStr = format(curr, 'yyyy-MM-dd');
          if (!map[dStr]) map[dStr] = [];
          if (!map[dStr].some(x => x.chaleId === r.chaleId)) {
            map[dStr].push({ chaleId: r.chaleId, guestName: r.guestName, code: r.confirmationCode, res: r });
          }
          curr = addDays(curr, 1);
        }
      } catch (err) {
        console.warn('Erro ao processar data para mapa de ocupação:', err);
      }
    });
    return map;
  }, [allActiveReservations]);

  const upcomingBookedDates = useMemo(() => {
    return Object.keys(bookedDatesSummary)
      .filter(dStr => dStr >= '2026-11-12')
      .sort()
      .map(dStr => ({
        dateStr: dStr,
        bookings: bookedDatesSummary[dStr]
      }));
  }, [bookedDatesSummary]);

  // STATUS DOS 12 CHALÉS NA DATA SELECIONADA DO MAPA
  const chalesOnTargetDate = useMemo(() => {
    const statuses = (manualStatuses && typeof manualStatuses === 'object') ? manualStatuses : {};

    return (CHALE_UNITS || []).map(unit => {
      const reservation = allActiveReservations.find(r => {
        if (!r || Number(r.chaleId) !== unit.id) return false;
        const inStr = (r.checkInDate || '').split('T')[0];
        const outStr = (r.checkOutDate || inStr).split('T')[0];
        if (!inStr) return false;
        return mapTargetDateStr >= inStr && mapTargetDateStr <= outStr;
      });

      const isManualIndisponivel = statuses[unit.id] === 'indisponivel';
      let status: 'disponivel' | 'indisponivel' | 'ocupado' = 'disponivel';
      if (reservation) {
        status = 'ocupado';
      } else if (isManualIndisponivel) {
        status = 'indisponivel';
      }

      return {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        modelLabel: unit.modelLabel,
        capacity: unit.capacity,
        status,
        reservation
      };
    });
  }, [allActiveReservations, manualStatuses, mapTargetDateStr]);

  const mapCountDisponiveis = chalesOnTargetDate.filter(c => c.status === 'disponivel').length;
  const mapCountOcupados = chalesOnTargetDate.filter(c => c.status === 'ocupado').length;
  const mapCountIndisponiveis = chalesOnTargetDate.filter(c => c.status === 'indisponivel').length;

  // NO PAINEL ADMIN: MOSTRA TODOS OS 12 CHALÉS (Chalés 01 a 12: 6 Alvenaria + 6 Vidro)
  const chalesList = useMemo(() => {
    const localList = Array.isArray(localReservations) ? localReservations : [];
    const onlineList = Array.isArray(realChaleOrders) ? realChaleOrders : [];
    const statuses = (manualStatuses && typeof manualStatuses === 'object') ? manualStatuses : {};

    return (CHALE_UNITS || []).map(unit => {
      const localRes = localList.find(r => r && Number(r.chaleId) === unit.id && r.status !== 'cancelled');
      const onlineRes = onlineList.find(r => r && Number(r.chaleId) === unit.id && r.status !== 'cancelled');
      
      const reservation = localRes || onlineRes;
      const isManualIndisponivel = statuses[unit.id] === 'indisponivel';

      let status: 'disponivel' | 'indisponivel' | 'ocupado' = 'disponivel';
      if (reservation) {
        status = 'ocupado';
      } else if (isManualIndisponivel) {
        status = 'indisponivel';
      }

      return {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        status,
        reservation
      };
    });
  }, [localReservations, realChaleOrders, manualStatuses]);

  // Filtragem
  const filteredChales = useMemo(() => {
    return (chalesList || []).filter(c => {
      if (!c) return false;
      const q = (searchTerm || '').toLowerCase();
      const res = c.reservation;
      const guestName = String(res?.guestName || '').toLowerCase();
      const phone = String(res?.phone || '');
      const code = String(res?.confirmationCode || '').toLowerCase();
      const cName = String(c.name || '').toLowerCase();

      const matchesSearch = 
        !searchTerm ||
        cName.includes(q) ||
        (res && (
          guestName.includes(q) ||
          phone.includes(q) ||
          code.includes(q)
        ));

      const matchesStatus = filterStatus === 'todos' || c.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [chalesList, searchTerm, filterStatus]);

  // Contadores
  const countDisponiveis = chalesList.filter(c => c.status === 'disponivel').length;
  const countOcupados = chalesList.filter(c => c.status === 'ocupado').length;
  const countIndisponiveis = chalesList.filter(c => c.status === 'indisponivel').length;

  // Toggle Bloquear / Liberar Manutenção
  const handleToggleBlock = async (chaleId: number) => {
    const nextStatus: 'disponivel' | 'indisponivel' =
      manualStatuses[chaleId] === 'indisponivel' ? 'disponivel' : 'indisponivel';
    const nextStatuses: Record<number, 'disponivel' | 'indisponivel'> = {
      ...manualStatuses,
      [chaleId]: nextStatus
    };
    setManualStatuses(nextStatuses);

    const disabledIds = CHALE_UNITS
      .map((u) => u.id)
      .filter((id) => nextStatuses[id] === 'indisponivel');

    const ok = await updateGlobalSetting('disabled_chale_ids', disabledIds);
    if (!ok) {
      toast({
        title: 'Erro ao salvar bloqueio no site',
        description: 'Não foi possível sincronizar o bloqueio com o site de reservas. Tente novamente.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title:
        nextStatus === 'disponivel'
          ? `Chalé ${chaleId} liberado (Verde)`
          : `Chalé ${chaleId} bloqueado para manutenção (Amarelo)`,
    });
  };

  // Abrir Modal de Nova Reserva
  const handleOpenNewBooking = (targetChaleId?: number, initialCheckIn?: string, initialCheckOut?: string) => {
    setIsEditing(false);
    setEditingResId(null);
    const locked = typeof targetChaleId === 'number' && targetChaleId > 0;
    setIsChaleLocked(locked);
    setFormChaleId(targetChaleId || 1);
    setFormGuestName('');
    setFormAdult2Name('');
    setFormPhone('');
    setFormCpf('');

    let inDateStr = initialCheckIn;
    let outDateStr = initialCheckOut;

    if (!inDateStr) {
      const minDate = new Date('2026-11-12T00:00:00');
      let base = new Date();
      if (base < minDate) base = minDate;
      const day = base.getDay();
      let diffToFri = 0;
      if (day === 5) diffToFri = 0;
      else if (day < 5) diffToFri = 5 - day;
      else diffToFri = 6;
      const fri = addDays(base, diffToFri);
      inDateStr = format(fri, 'yyyy-MM-dd');
      outDateStr = format(addDays(fri, 2), 'yyyy-MM-dd');
    }

    setFormCheckInDate(inDateStr);
    setFormCheckInTime('15:00');
    setFormCheckOutDate(outDateStr || format(addDays(parseISO(inDateStr), 2), 'yyyy-MM-dd'));
    setFormCheckOutTime('12:00');
    setFormOccupancyType('casal');
    setFormPackageType('combo-2n-sex-dom');
    setFormKids([]);
    setFormApplySiteDiscount(true);
    setFormCustomPriceOverride(null);
    setExtraKioskType('none');
    setExtraKioskNumber(1);
    setExtraQuadType('none');
    setExtraQuadTime('10:00');
    setExtraQuadQty(1);
    setExtraPescaQty(0);
    setExtraSabaoQty(0);
    setFormPaymentMethod('PIX');
    setFormPaymentStatus('paid');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Abrir Modal para Alterar Reserva Existente
  const handleOpenEditBooking = (reservation: ChaleReservation) => {
    setIsEditing(true);
    setEditingResId(reservation.id);
    setIsChaleLocked(true);
    setFormChaleId(reservation.chaleId);
    setFormGuestName(reservation.guestName);
    setFormAdult2Name(reservation.adultNames?.[1] || '');
    setFormPhone(reservation.phone);
    setFormCpf(reservation.cpf || '');
    setFormCheckInDate(reservation.checkInDate);
    setFormCheckInTime(reservation.checkInTime || '15:00');
    setFormCheckOutDate(reservation.checkOutDate);
    setFormCheckOutTime(reservation.checkOutTime || '12:00');
    setFormOccupancyType(reservation.occupancyType || 'casal');
    const pkgKey = (reservation.packageType && CHALE_PACKAGES[reservation.packageType as ChalePackageType])
      ? (reservation.packageType as ChalePackageType)
      : 'combo-2n-sex-dom';
    setFormPackageType(pkgKey);
    setFormKids(
      (reservation.childNames || []).map(c => ({
        name: c.name,
        ageGroup: c.ageGroup || (c.ageLabel?.includes('12+') ? '12plus' : 'under11')
      }))
    );
    setFormApplySiteDiscount(true);
    setFormCustomPriceOverride(reservation.totalPrice);
    setExtraKioskType('none');
    setExtraQuadType('none');
    setExtraPescaQty(0);
    setExtraSabaoQty(0);
    setFormPaymentMethod(reservation.paymentMethod || 'PIX');
    setFormPaymentStatus(reservation.status === 'paid' ? 'paid' : 'pending');
    setFormNotes(reservation.notes || '');
    setIsModalOpen(true);
  };

  // Montar objeto de reserva estruturado com todos os nomes e itens extras
  const buildReservationFromForm = (overrideStatus?: 'paid' | 'pending', overrideMethod?: string, orderId?: string, confCode?: string): ChaleReservation => {
    const pkgInfo = formPackageType !== 'custom' ? CHALE_PACKAGES[formPackageType] : null;
    const pkgTitle = pkgInfo ? pkgInfo.title : `Hospedagem (${modalStayPricing.nightsCount} Noite${modalStayPricing.nightsCount > 1 ? 's' : ''})`;
    const adultNames = formOccupancyType === 'casal'
      ? [formGuestName.trim(), formAdult2Name.trim() || 'Acompanhante Adulto 2']
      : [formGuestName.trim()];

    const childNames = formKids.map((k, idx) => ({
      name: k.name.trim() || `Criança ${idx + 1}`,
      ageLabel: k.ageGroup === '12plus' ? '12+ anos • Filho(a) Hóspede' : 'Até 11 anos • Filho(a) Hóspede',
      ageGroup: k.ageGroup
    }));

    const extraItems: { name: string; quantity: number; price: number; timeSlot?: string }[] = [];
    if (extraKioskType !== 'none') {
      extraItems.push({
        name: `Quiosque ${String(extraKioskNumber).padStart(2, '0')} (${KIOSK_INFO[extraKioskType].label})`,
        quantity: 1,
        price: modalPricingBreakdown.kioskNet
      });
    }
    if (extraQuadType !== 'none') {
      extraItems.push({
        name: `Passeio de Quadriciclo (${extraQuadType === 'dupla' ? 'Dupla' : 'Individual'})`,
        quantity: extraQuadQty,
        price: modalPricingBreakdown.quadNet,
        timeSlot: extraQuadTime
      });
    }
    if (extraPescaQty > 0) {
      extraItems.push({
        name: 'Pesca Esportiva',
        quantity: extraPescaQty,
        price: modalPricingBreakdown.pescaNet
      });
    }
    if (extraSabaoQty > 0) {
      extraItems.push({
        name: 'Futebol de Sabão',
        quantity: extraSabaoQty,
        price: modalPricingBreakdown.sabaoNet
      });
    }

    return {
      id: editingResId || orderId || `res-${Date.now()}`,
      chaleId: formChaleId,
      guestName: formGuestName.trim(),
      phone: formPhone || '(69) 99999-0000',
      cpf: formCpf,
      checkInDate: formCheckInDate,
      checkInTime: formCheckInTime,
      checkOutDate: formCheckOutDate,
      checkOutTime: formCheckOutTime,
      packageTitle: pkgTitle,
      packageType: formPackageType,
      occupancyType: formOccupancyType,
      adults: formOccupancyType === 'casal' ? 2 : 1,
      children: formKids.length,
      adultNames,
      childNames,
      extraItems,
      totalPrice: Number(modalPricingBreakdown.finalTotal),
      paymentMethod: overrideMethod || formPaymentMethod,
      status: overrideStatus || formPaymentStatus,
      isCheckedIn: false,
      orderId: orderId,
      isOrder: !!orderId,
      confirmationCode: confCode || `CHA-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: formNotes || 'Reserva interna realizada pelo Painel Admin.'
    };
  };

  // Salvar Nova Reserva ou Atualização (Confirmação Interna / Balcão)
  const handleSaveBooking = async () => {
    if (!formGuestName.trim()) {
      toast({
        title: 'Informe o nome do titular',
        description: 'Por favor, preencha o nome completo do hóspede responsável.',
        variant: 'destructive'
      });
      return;
    }

    const built = buildReservationFromForm();

    if (isEditing && editingResId) {
      setLocalReservations(prev => prev.map(r => (r.id === editingResId ? { ...r, ...built } : r)));

      try {
        await supabase.from('orders').update({
          customer_name: built.guestName,
          customer_phone: built.phone,
          customer_cpf: built.cpf || null,
          total_amount: built.totalPrice,
          status: built.status,
          notes: built.notes
        }).eq('id', editingResId);
      } catch (e) {}

      toast({ title: `✓ Reserva do Chalé ${String(formChaleId).padStart(2, '0')} atualizada!` });
    } else {
      setLocalReservations(prev => [...prev.filter(r => r.chaleId !== formChaleId), built]);
      toast({ title: `✓ Chalé ${String(formChaleId).padStart(2, '0')} reservado com sucesso (${formatCurrency(built.totalPrice)})!` });
    }

    setIsModalOpen(false);
    if (onRefresh) onRefresh();
  };

  // Gerar Pagamento QR Code PIX ou Cartão diretamente do Modal Interno
  const handleGenerateAdminPayment = async (method: 'PIX' | 'CREDIT_CARD') => {
    if (!formGuestName.trim()) {
      toast({
        title: 'Informe o nome do titular',
        description: 'Preencha o nome do hóspede antes de gerar o pagamento.',
        variant: 'destructive'
      });
      return;
    }

    setGeneratingPayment(true);
    try {
      const confCode = `CHA-${Math.floor(1000 + Math.random() * 9000)}`;
      const built = buildReservationFromForm('pending', method === 'PIX' ? 'PIX' : 'Cartão de Crédito', undefined, confCode);

      // 1. Criar pedido no Supabase para permitir cobrança real via Asaas (PaymentModal)
      let createdOrderId = `local-${Date.now()}`;
      try {
        const { data: orderData, error: orderErr } = await (supabase as any)
          .from('orders')
          .insert({
            customer_name: built.guestName,
            customer_phone: built.phone,
            customer_cpf: built.cpf || null,
            visit_date: built.checkInDate,
            total_amount: built.totalPrice,
            status: 'pending',
            payment_method: method,
            confirmation_code: confCode,
            notes: built.notes
          })
          .select('id, confirmation_code')
          .single();

        if (!orderErr && orderData?.id) {
          createdOrderId = orderData.id;
          const allGuestNames = [
            ...(built.adultNames || [built.guestName]),
            ...(built.childNames || []).map(c => c.name)
          ];
          const itemsPayload: any[] = [
            {
              order_id: createdOrderId,
              product_id: `Chalé ${String(built.chaleId).padStart(2, '0')}: ${built.packageTitle}`,
              product_name: `Chalé ${String(built.chaleId).padStart(2, '0')} — ${built.packageTitle}`,
              quantity: 1,
              unit_price: modalPricingBreakdown.chaleFinal,
              total_price: modalPricingBreakdown.chaleFinal,
              metadata: {
                package_type: built.packageType,
                package_title: built.packageTitle,
                chale_id: built.chaleId,
                chale_ids: [built.chaleId],
                chalets_count: 1,
                chale_occupancies: { [built.chaleId]: built.occupancyType },
                chale_kids: { [built.chaleId]: formKids.map(k => k.ageGroup) },
                adults: built.adults,
                children: built.children,
                children_ages: formKids.map(k => k.ageGroup),
                guest_names: allGuestNames,
                check_in_date: built.checkInDate,
                check_in_time: built.checkInTime,
                check_out_date: built.checkOutDate,
                check_out_time: built.checkOutTime,
                chale_gross_price: modalPricingBreakdown.chaleGross,
                chale_net_price: modalPricingBreakdown.chaleFinal
              }
            }
          ];

          (built.extraItems || []).forEach(ext => {
            itemsPayload.push({
              order_id: createdOrderId,
              product_id: ext.name,
              product_name: ext.name,
              quantity: ext.quantity,
              unit_price: ext.price / Math.max(1, ext.quantity),
              total_price: ext.price,
              metadata: ext.timeSlot ? { time_slot: ext.timeSlot } : {}
            });
          });

          await (supabase as any).from('order_items').insert(itemsPayload);
        }
      } catch (dbErr) {
        console.warn('Aviso ao criar pedido Supabase para pagamento admin:', dbErr);
      }

      const finalReservation: ChaleReservation = {
        ...built,
        id: createdOrderId,
        orderId: createdOrderId,
        isOrder: true
      };

      setLocalReservations(prev => [...prev.filter(r => r.chaleId !== formChaleId), finalReservation]);
      setIsModalOpen(false);

      setAdminPaymentData({
        open: true,
        orderId: createdOrderId,
        name: built.guestName,
        phone: built.phone,
        cpf: built.cpf || '',
        totalAmount: built.totalPrice,
        initialMethod: method,
        chaleId: built.chaleId
      });
    } finally {
      setGeneratingPayment(false);
    }
  };

  // Excluir / Cancelar Reserva (libera o chalé)
  const handleDeleteBooking = async (res: ChaleReservation) => {
    if (!confirm(`Deseja realmente excluir/cancelar a reserva de ${res.guestName} no Chalé ${res.chaleId}? O chalé ficará LIVRE (Verde) imediatamente.`)) {
      return;
    }

    setLocalReservations(prev => prev.filter(r => r.id !== res.id && r.chaleId !== res.chaleId));

    if (res.isOrder && res.orderId) {
      try {
        await supabase.from('order_items').delete().eq('order_id', res.orderId);
        await supabase.from('orders').delete().eq('id', res.orderId);
      } catch (err) {
        console.error('Erro ao deletar pedido no Supabase:', err);
      }
    }

    toast({ title: `✓ Reserva excluída! Chalé ${res.chaleId} agora está LIVRE (Verde).` });
    if (onRefresh) onRefresh();
  };

  // Toggle PAGO OK
  const handleTogglePayment = async (res: ChaleReservation) => {
    const nextStatus: 'paid' | 'pending' = res.status === 'paid' ? 'pending' : 'paid';
    
    setLocalReservations(prev => prev.map(r => {
      if (r.id === res.id || r.chaleId === res.chaleId) {
        return { ...r, status: nextStatus };
      }
      return r;
    }));

    if (res.isOrder && onStatusChange) {
      await onStatusChange(res.id, nextStatus, true);
    } else {
      try {
        await supabase.from('orders').update({ status: nextStatus }).eq('id', res.id);
      } catch (e) {}
    }

    toast({ title: nextStatus === 'paid' ? "✓ Pagamento Confirmado (PAGO OK)" : "Aguardando Pagamento" });
  };

  // Toggle Check-in
  const handleToggleCheckIn = (res: ChaleReservation) => {
    const nextCheckIn = !res.isCheckedIn;
    setLocalReservations(prev => prev.map(r => {
      if (r.id === res.id || r.chaleId === res.chaleId) {
        return { ...r, isCheckedIn: nextCheckIn };
      }
      return r;
    }));
    toast({ title: nextCheckIn ? "✓ Check-in Realizado (Hóspede no Chalé)" : "Check-in Desfeito (Pendente)" });
  };

  // Adicionar produtos e serviços manualmente à reserva do chalé
  const handleOpenAddItems = (res: ChaleReservation) => {
    setAddItemsBooking({
      id: res.orderId || res.id,
      order_id: res.orderId || res.id,
      is_order: true,
      total_amount: res.totalPrice,
      visit_date: res.checkInDate,
      name: res.guestName,
      phone: res.phone
    });
    setIsAddItemsOpen(true);
  };

  // Marcar como desocupado e liberar chalé imediatamente para reservas no site
  const handleDesocuparChale = async (res: ChaleReservation) => {
    if (!confirm(`Deseja marcar o Chalé ${String(res.chaleId).padStart(2, '0')} como DESOCUPADO e torná-lo LIVRE imediatamente para reservas no site?`)) {
      return;
    }

    // 1. Remove da lista local
    setLocalReservations(prev => prev.filter(r => r.chaleId !== res.chaleId && r.id !== res.id));

    // 2. Se for pedido no Supabase, atualiza status para 'desocupado'
    const orderId = res.orderId || res.id;
    if (orderId) {
      try {
        await supabase.from('orders').update({
          status: 'desocupado',
          notes: `${res.notes ? res.notes + ' | ' : ''}Chalé desocupado pelo admin em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
        }).eq('id', orderId);
      } catch (err) {
        console.warn('Erro ao atualizar status do pedido para desocupado:', err);
      }
    }

    if (onRefresh) {
      await onRefresh();
    }

    toast({
      title: `✓ Chalé ${String(res.chaleId).padStart(2, '0')} Desocupado!`,
      description: "O chalé agora está LIVRE no painel e liberado para novas reservas no site."
    });
  };

  // Salvar Nota Interna
  const handleSaveNote = async (res: ChaleReservation, newNote: string) => {
    setLocalReservations(prev => prev.map(r => {
      if (r.id === res.id || r.chaleId === res.chaleId) {
        return { ...r, notes: newNote };
      }
      return r;
    }));

    if (res.isOrder && onAddNote) {
      await onAddNote(res.id, newNote, true);
    } else {
      try {
        await supabase.from('orders').update({ notes: newNote }).eq('id', res.id);
      } catch (e) {}
    }

    setEditingNoteChaleId(null);
    toast({ title: "✓ Nota interna salva com sucesso!" });
  };

  // Abrir Modal de Voucher com Gerador de Imagem
  const handleOpenVoucherModal = (res: ChaleReservation) => {
    setVoucherRes(res);
    setVoucherImageGenerated(null);
    setIsVoucherModalOpen(true);
  };

  // Gerar Imagem do Voucher via html2canvas (como Day Use)
  const handleGenerateVoucherImage = async () => {
    if (!voucherPrintRef.current) return;
    setIsGeneratingVoucherImage(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(voucherPrintRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/png');
      setVoucherImageGenerated(dataUrl);

      // Copiar para área de transferência
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast({ title: "✓ Imagem do Voucher Copiada!", description: "Cole diretamente na conversa do WhatsApp do cliente." });
      } catch (clipErr) {
        toast({ title: "✓ Imagem Gerada!", description: "Clique no botão Baixar Imagem para salvar o arquivo." });
      }
    } catch (err: any) {
      console.error('Erro ao gerar imagem do voucher:', err);
      toast({ title: "Erro ao gerar imagem", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingVoucherImage(false);
    }
  };

  // Baixar imagem do voucher gerada
  const handleDownloadVoucherImage = () => {
    if (!voucherImageGenerated || !voucherRes) return;
    const link = document.createElement('a');
    link.href = voucherImageGenerated;
    link.download = `voucher-chale-${voucherRes.chaleId}-${voucherRes.confirmationCode || 'ok'}.png`;
    link.click();
  };

  // Enviar texto no WhatsApp
  const handleSendVoucherWhatsApp = () => {
    if (!voucherRes) return;
    const msg = `*BALNEÁRIO LESSA - COMPROVANTE OFICIAL DE HOSPEDAGEM* 🌿\n\n` +
      `*Titular:* ${voucherRes.guestName}\n` +
      `*Chalé:* Chalé ${String(voucherRes.chaleId).padStart(2, '0')}\n` +
      `*Código:* ${voucherRes.confirmationCode || 'CHA-OK'}\n` +
      `*Entrada (Check-in):* ${voucherRes.checkInDate} às ${voucherRes.checkInTime}\n` +
      `*Saída (Check-out):* ${voucherRes.checkOutDate} às ${voucherRes.checkOutTime}\n` +
      `*Pacote:* ${voucherRes.packageTitle}\n` +
      `*Café da manhã:* Incluso das 07h às 09h (Sex, Sáb e Dom)\n` +
      `*Day Use:* Conforme regras do pacote\n` +
      `*Total:* ${formatCurrency(voucherRes.totalPrice)} (${voucherRes.status === 'paid' ? 'PAGO ✓' : 'A PAGAR'})\n\n` +
      `Apresente este voucher na recepção. Estamos ansiosos para recebê-los! ✨`;

    const phoneDigits = (voucherRes.phone || '').replace(/\D/g, '');
    const waLink = `https://api.whatsapp.com/send?phone=55${phoneDigits}&text=${encodeURIComponent(msg)}`;
    window.open(waLink, '_blank');
  };

  // Abrir Modal de Anexo / Comprovante
  const handleOpenReceiptModal = (res: ChaleReservation) => {
    setReceiptRes(res);
    setIsReceiptModalOpen(true);
  };

  // Upload de Comprovante de Pagamento
  const handleUploadReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !receiptRes) return;

    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Url = reader.result as string;
        
        // Atualiza localmente
        setLocalReservations(prev => prev.map(r => {
          if (r.id === receiptRes.id || r.chaleId === receiptRes.chaleId) {
            return { ...r, receiptUrl: base64Url };
          }
          return r;
        }));

        setReceiptRes(prev => prev ? { ...prev, receiptUrl: base64Url } : null);

        // Se for pedido Supabase, salva no banco
        if (receiptRes.isOrder && receiptRes.orderId) {
          try {
            await supabase.from('orders').update({ receipt_url: base64Url }).eq('id', receiptRes.orderId);
          } catch (supaErr) {}
        }

        toast({ title: "✓ Comprovante anexado com sucesso!" });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ title: "Erro ao anexar comprovante", description: err.message, variant: "destructive" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Remover Comprovante
  const handleRemoveReceipt = async () => {
    if (!receiptRes) return;
    setLocalReservations(prev => prev.map(r => {
      if (r.id === receiptRes.id || r.chaleId === receiptRes.chaleId) {
        return { ...r, receiptUrl: null };
      }
      return r;
    }));
    setReceiptRes(prev => prev ? { ...prev, receiptUrl: null } : null);
    if (receiptRes.isOrder && receiptRes.orderId) {
      try {
        await supabase.from('orders').update({ receipt_url: null }).eq('id', receiptRes.orderId);
      } catch (e) {}
    }
    toast({ title: "✓ Comprovante removido." });
  };

  // Reagendar Rápido
  const handleOpenReschedule = (res: ChaleReservation) => {
    setRescheduleChaleId(res.chaleId);
    setRescheduleInDate(res.checkInDate);
    setRescheduleOutDate(res.checkOutDate);
    setIsRescheduleOpen(true);
  };

  const handleSaveReschedule = () => {
    if (!rescheduleChaleId || !rescheduleInDate || !rescheduleOutDate) return;
    setLocalReservations(prev => prev.map(r => {
      if (r.chaleId === rescheduleChaleId) {
        return {
          ...r,
          checkInDate: rescheduleInDate,
          checkOutDate: rescheduleOutDate
        };
      }
      return r;
    }));
    setIsRescheduleOpen(false);
    toast({ title: "✓ Reserva reagendada com sucesso!" });
  };

  const selectedUnitObj = useMemo(() => {
    return CHALE_UNITS.find(u => u.id === formChaleId) || CHALE_UNITS[0];
  }, [formChaleId]);

  // CARD DO MAPA DE OCUPAÇÃO (Exibição por data selecionada)
  const renderChaleMapCard = (unit: typeof chalesOnTargetDate[0]) => {
    const isOccupied = unit.status === 'ocupado';
    const isAvailable = unit.status === 'disponivel';
    const isMaintenance = unit.status === 'indisponivel';
    const res = unit.reservation;

    return (
      <div
        key={unit.id}
        className={cn(
          "rounded-3xl border-2 transition-all shadow-sm overflow-hidden flex flex-col justify-between bg-white",
          isOccupied
            ? "border-red-400 ring-2 ring-red-100"
            : isAvailable
            ? "border-emerald-500 hover:shadow-md"
            : "border-amber-400 bg-amber-50/30"
        )}
      >
        {/* CARD TOP HEADER */}
        <div className={cn(
          "p-4 border-b flex items-center justify-between gap-2",
          isOccupied ? "bg-red-50 border-red-200" : isAvailable ? "bg-emerald-50/80 border-emerald-200" : "bg-amber-100/60 border-amber-200"
        )}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={cn(
              "w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs",
              isOccupied ? "bg-red-600 text-white" : isAvailable ? "bg-emerald-600 text-white" : "bg-amber-500 text-slate-950"
            )}>
              {String(unit.id).padStart(2, '0')}
            </span>
            <div className="min-w-0">
              <h5 className="font-black text-sm text-slate-900 truncate">
                {unit.name}
              </h5>
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                {unit.modelLabel}
              </p>
            </div>
          </div>

          <Badge className={cn(
            "text-[10px] font-black uppercase px-2.5 py-1 tracking-wider shrink-0 shadow-xs",
            isOccupied
              ? "bg-red-600 hover:bg-red-600 text-white"
              : isAvailable
              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
              : "bg-amber-500 hover:bg-amber-500 text-slate-950"
          )}>
            {isOccupied ? 'OCUPADO' : isAvailable ? 'LIVRE' : 'MANUTENÇÃO'}
          </Badge>
        </div>

        {/* CARD CONTENT */}
        <div className="p-4 space-y-3 flex-1 text-xs">
          {isOccupied && res ? (
            <div className="space-y-2.5">
              <div className="bg-white rounded-xl border border-red-200 p-3 shadow-xs space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Hóspede Titular</span>
                    <h6 className="font-black text-sm text-slate-900">{res.guestName}</h6>
                  </div>
                  {res.confirmationCode && (
                    <Badge variant="outline" className="border-red-300 text-red-700 font-mono text-[9px] font-black">
                      {res.confirmationCode}
                    </Badge>
                  )}
                </div>

                {res.adultNames && res.adultNames.length > 1 && (
                  <p className="text-[11px] text-slate-600">
                    <span className="font-bold">Acompanhante:</span> {res.adultNames[1]}
                  </p>
                )}

                {res.childNames && res.childNames.length > 0 && (
                  <p className="text-[11px] text-slate-600">
                    <span className="font-bold">Crianças ({res.childNames.length}):</span> {res.childNames.map(c => c.name).join(', ')}
                  </p>
                )}

                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-800 truncate mr-2">{res.packageTitle}</span>
                  <span className="font-black text-slate-900 shrink-0">{formatCurrency(res.totalPrice)}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
                  <span>Entrada: {res.checkInDate} ({res.checkInTime})</span>
                  <span>Saída: {res.checkOutDate} ({res.checkOutTime})</span>
                </div>
              </div>

              {/* CONTATO DO HÓSPEDE */}
              <div className="flex items-center justify-between text-xs text-slate-700 px-1">
                <span className="font-bold flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {res.phone || 'Sem telefone'}
                </span>
                <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5", res.status === 'paid' ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800 border border-amber-300")}>
                  {res.status === 'paid' ? 'PAGO OK' : 'PENDENTE'}
                </Badge>
              </div>
            </div>
          ) : isAvailable ? (
            <div className="space-y-3 py-2 text-center">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-xs uppercase tracking-tight">
                  Chalé Totalmente Disponível
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {unit.capacity} • Cama casal, ar-condicionado, café e Day Use.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => handleOpenNewBooking(unit.id, mapTargetDateStr, format(addDays(mapTargetDate, 2), 'yyyy-MM-dd'))}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-xl h-10 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Reservar Este Chalé
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-3 text-center">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-slate-900 text-xs uppercase tracking-tight">
                  Chalé Bloqueado para Manutenção
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Unidade indisponível para reservas de hóspedes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CARD FOOTER ACTIONS */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1.5 flex-wrap">
          {isOccupied && res ? (
            <>
              <button
                type="button"
                onClick={() => handleOpenVoucherModal(res)}
                className="text-[11px] font-bold text-slate-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                title="Visualizar e Imprimir Voucher"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> Voucher
              </button>

              <button
                type="button"
                onClick={() => handleOpenEditBooking(res)}
                className="text-[11px] font-bold text-slate-700 hover:text-blue-800 bg-white hover:bg-blue-50 border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                title="Editar dados da reserva"
              >
                <Edit className="w-3.5 h-3.5 text-blue-600" /> Editar
              </button>

              <button
                type="button"
                onClick={() => handleMarkAsVacant(res)}
                className="text-[11px] font-black text-amber-900 hover:text-white bg-amber-100 hover:bg-amber-600 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer transition-all ml-auto"
                title="Desocupar e liberar chalé imediatamente"
              >
                <RotateCcw className="w-3 h-3" /> Desocupar
              </button>
            </>
          ) : isAvailable ? (
            <button
              type="button"
              onClick={() => handleToggleBlock(unit.id)}
              className="text-[10px] font-bold text-amber-800 hover:text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-all ml-auto cursor-pointer"
            >
              Bloquear p/ Manutenção
            </button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => handleToggleBlock(unit.id)}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-8 rounded-lg cursor-pointer"
            >
              ✓ Liberar Chalé
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL COM ESTATÍSTICAS E CONTROLE */}
      <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white rounded-3xl border-2 border-amber-400 shadow-2xl p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black">
                <Home className="w-5 h-5 stroke-[2.5]" />
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-amber-400">
                Painel Host & Hospedagem (Chalés 01 ao 12 e Camping)
              </h3>
            </div>
            <p className="text-xs text-emerald-200/90 font-medium">
              Gestão administrativa de todos os 12 chalés (6 Alvenaria + 6 Vidro), controle de reservas, geração de voucher em imagem e anexos.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* BOTÃO NOVA RESERVA DE CHALÉ */}
            <Button
              onClick={() => handleOpenNewBooking()}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl h-11 px-5 shadow-lg flex items-center gap-2 border-2 border-emerald-300"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Nova Reserva de Chalé
            </Button>

            {/* Sub-abas: Mapa de Ocupação / Chalés Geral / Camping */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/15">
              <button
                onClick={() => setActiveSubTab('mapa')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  activeSubTab === 'mapa'
                    ? "bg-amber-400 text-slate-950 shadow-md scale-[1.02]"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <CalendarDays className="w-4 h-4" /> Mapa de Ocupação
              </button>
              <button
                onClick={() => setActiveSubTab('chales')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  activeSubTab === 'chales'
                    ? "bg-amber-400 text-slate-950 shadow-md scale-[1.02]"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <Bed className="w-4 h-4" /> Chalés Geral (12)
              </button>
              <button
                onClick={() => setActiveSubTab('camping')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  activeSubTab === 'camping'
                    ? "bg-amber-400 text-slate-950 shadow-md scale-[1.02]"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <Tent className="w-4 h-4" /> Camping ({campingBookings.length})
              </button>
            </div>
          </div>
        </div>

        {/* INDICADORES VISUAIS: Ocupado=Vermelho, Livres=Verde, Manutenção=Amarelo */}
        <div className="pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-900/80 border-2 border-emerald-400/50 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-emerald-300 uppercase block tracking-wider">
              {activeSubTab === 'mapa' ? 'Chalés Livres na Data' : 'Chalés Livres'}
            </span>
            <span className="text-3xl font-black text-white">
              {activeSubTab === 'mapa' ? mapCountDisponiveis : countDisponiveis}
            </span>
          </div>

          <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-red-300 uppercase block tracking-wider">
              {activeSubTab === 'mapa' ? 'Chalés Ocupados na Data' : 'Chalés Ocupados'}
            </span>
            <span className="text-3xl font-black text-white">
              {activeSubTab === 'mapa' ? mapCountOcupados : countOcupados}
            </span>
          </div>

          <div className="bg-amber-950/80 border-2 border-amber-400/60 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-amber-300 uppercase block tracking-wider">
              Manutenção
            </span>
            <span className="text-3xl font-black text-white">
              {activeSubTab === 'mapa' ? mapCountIndisponiveis : countIndisponiveis}
            </span>
          </div>

          <div className="bg-purple-950/80 border-2 border-purple-400/50 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-purple-300 uppercase block tracking-wider">
              {activeSubTab === 'mapa' ? 'Data Selecionada' : 'Campistas'}
            </span>
            <span className={cn("font-black text-white", activeSubTab === 'mapa' ? "text-xl sm:text-2xl mt-1 block" : "text-3xl")}>
              {activeSubTab === 'mapa' 
                ? format(mapTargetDate, 'dd/MM/yyyy')
                : campingBookings.reduce((sum, c) => sum + (c.peopleCount || 0), 0)
              }
            </span>
          </div>
        </div>
      </div>

      {/* ABA: MAPA DE OCUPAÇÃO DOS CHALÉS */}
      {activeSubTab === 'mapa' && (
        <div className="space-y-6">
          {/* BARRA DE CONTROLE DE DATA DO MAPA COM MARCADORES NOS DIAS */}
          <div className="bg-white rounded-3xl border-2 border-emerald-300 p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-700" />
                  Mapa de Ocupação dos Chalés por Período
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Selecione a data ou fim de semana para visualizar em tempo real quais chalés estarão ocupados ou livres.
                </p>
              </div>

              {/* CONTROLES DE NAVEGAÇÃO DE DATA */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapTargetDate(prev => addDays(prev, -1))}
                  className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-100 cursor-pointer"
                >
                  ◀ Dia Anterior
                </Button>

                {/* POPOVER CALENDÁRIO COM MARCADORES */}
                <Popover open={isMapCalendarOpen} onOpenChange={setIsMapCalendarOpen}>
                  <PopoverTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      className="h-10 px-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-xs hover:bg-emerald-100 transition-all select-none"
                    >
                      <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{format(mapTargetDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
                      <Badge className={cn("text-[9px] font-black uppercase px-1.5 py-0.5", mapCountOcupados > 0 ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
                        {mapCountOcupados > 0 ? `${mapCountOcupados} ocupado(s)` : '100% Livre'}
                      </Badge>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-3xl border-2 border-emerald-600 bg-white shadow-2xl overflow-hidden" align="center">
                    <div className="bg-emerald-950 text-white p-3 border-b border-emerald-800">
                      <h5 className="text-xs font-black uppercase tracking-tight flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-amber-400" />
                        Escolha a Data do Mapa
                      </h5>
                      <p className="text-[10px] text-emerald-300">
                        Dias com reservas possuem marcadores no calendário
                      </p>
                    </div>
                    <div className="p-2 flex justify-center">
                      <CalendarUI
                        mode="single"
                        selected={mapTargetDate}
                        onSelect={(d) => {
                          if (d) {
                            setMapTargetDate(d);
                            setIsMapCalendarOpen(false);
                          }
                        }}
                        locale={ptBR}
                        className="p-1"
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapTargetDate(prev => addDays(prev, 1))}
                  className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Próximo Dia ▶
                </Button>
              </div>
            </div>

            {/* ATALHOS RÁPIDOS DE FINS DE SEMANA */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-black text-slate-500 uppercase text-[10px] tracking-wider shrink-0">
                Atalhos de Fins de Semana:
              </span>
              {[
                { label: 'Sex 13/11 a Dom 15/11', date: '2026-11-13' },
                { label: 'Sex 20/11 a Dom 22/11', date: '2026-11-20' },
                { label: 'Sex 27/11 a Dom 29/11', date: '2026-11-27' },
                { label: 'Sex 04/12 a Dom 06/12', date: '2026-12-04' },
                { label: 'Sex 11/12 a Dom 13/12', date: '2026-12-11' },
              ].map(shortcut => {
                const isSelected = mapTargetDateStr === shortcut.date;
                const hasReservations = Boolean(bookedDatesSummary[shortcut.date]);
                return (
                  <button
                    key={shortcut.date}
                    type="button"
                    onClick={() => setMapTargetDate(new Date(`${shortcut.date}T12:00:00`))}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-black text-[11px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer",
                      isSelected
                        ? "bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-500"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    )}
                  >
                    {hasReservations && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    {shortcut.label}
                  </button>
                );
              })}
            </div>

            {/* MARCADORES NOS DIAS: PRÓXIMAS DATAS COM RESERVAS REGISTRADAS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />
                  Datas com Marcadores de Reservas Ativas:
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {upcomingBookedDates.length} data(s) com chalés ocupados
                </span>
              </div>

              {upcomingBookedDates.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Nenhuma reserva registrada para datas futuras. Todos os chalés estão disponíveis.
                </p>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                  {upcomingBookedDates.map(item => {
                    const isCurrent = item.dateStr === mapTargetDateStr;
                    const dateFormatted = format(parseISO(item.dateStr), 'dd/MM (EEE)', { locale: ptBR });
                    const chaletsListText = item.bookings.map(b => `Ch ${String(b.chaleId).padStart(2, '0')}`).join(', ');
                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => setMapTargetDate(new Date(`${item.dateStr}T12:00:00`))}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all flex items-center gap-1.5 border shadow-xs cursor-pointer",
                          isCurrent
                            ? "bg-red-600 text-white border-red-700 ring-2 ring-red-400"
                            : "bg-white text-slate-800 border-red-200 hover:bg-red-50"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full", isCurrent ? "bg-white" : "bg-red-500")} />
                        <span>{dateFormatted}:</span>
                        <span className={cn("text-[10px] font-bold uppercase", isCurrent ? "text-red-100" : "text-red-700")}>
                          {chaletsListText} ({item.bookings.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* GRADE DOS 12 CHALÉS NA DATA SELECIONADA */}
          {/* GRUPO 1: CHALÉS DE ALVENARIA (01 AO 06) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-2">
              <h4 className="text-base sm:text-lg font-black text-emerald-950 flex items-center gap-2">
                <Home className="w-5 h-5 text-emerald-700" />
                Chalés de Alvenaria Tradicional (Chalés 01 ao 06)
              </h4>
              <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[10px] uppercase">
                6 Unidades
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {chalesOnTargetDate.filter(c => c.type === 'alvenaria').map(unit => renderChaleMapCard(unit))}
            </div>
          </div>

          {/* GRUPO 2: CHALÉS DE VIDRO PANORÂMICO (07 AO 12) */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b-2 border-amber-600 pb-2">
              <h4 className="text-base sm:text-lg font-black text-amber-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                Chalés de Vidro Panorâmico — Luxo (Chalés 07 ao 12)
              </h4>
              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] uppercase">
                6 Unidades
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {chalesOnTargetDate.filter(c => c.type === 'vidro').map(unit => renderChaleMapCard(unit))}
            </div>
          </div>
        </div>
      )}

      {/* ABA: CHALÉS (MOSTRA TODOS OS 12 CHALÉS NO PAINEL ADMIN) */}
      {activeSubTab === 'chales' && (
        <div className="space-y-6">
          
          {/* BARRA DE FILTRO E BUSCA */}
          <div className="bg-white rounded-3xl border-2 border-emerald-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar chalé, hóspede, telefone ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 rounded-xl border-slate-300 focus-visible:ring-emerald-600 font-bold text-xs sm:text-sm text-slate-900"
                />
              </div>

              {/* Botões de Filtro */}
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                <button
                  onClick={() => setFilterStatus('todos')}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap",
                    filterStatus === 'todos' 
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  Todos ({chalesList.length})
                </button>

                <button
                  onClick={() => setFilterStatus('disponivel')}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border",
                    filterStatus === 'disponivel' 
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                      : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                  )}
                >
                  Livres ({countDisponiveis})
                </button>

                <button
                  onClick={() => setFilterStatus('ocupado')}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border",
                    filterStatus === 'ocupado' 
                      ? "bg-red-600 text-white border-red-700 shadow-sm"
                      : "bg-red-50 text-red-900 border-red-300 hover:bg-red-100"
                  )}
                >
                  Ocupados ({countOcupados})
                </button>

                <button
                  onClick={() => setFilterStatus('indisponivel')}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border",
                    filterStatus === 'indisponivel' 
                      ? "bg-amber-400 text-slate-950 border-amber-500 shadow-sm"
                      : "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100"
                  )}
                >
                  Manutenção ({countIndisponiveis})
                </button>
              </div>
            </div>
          </div>

          {/* GRID DOS 12 CHALÉS: FUNDO BRANCO E ALTO CONTRASTE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredChales.map((unit) => {
              const isOccupied = unit.status === 'ocupado';
              const isAvailable = unit.status === 'disponivel';
              const isBlocked = unit.status === 'indisponivel';
              const res = unit.reservation;

              return (
                <div
                  key={unit.id}
                  className={cn(
                    "rounded-[2rem] border-2 p-5 sm:p-6 shadow-md transition-all flex flex-col justify-between space-y-4 bg-white",
                    isAvailable && "border-emerald-400",
                    isOccupied && "border-red-400",
                    isBlocked && "border-amber-400 bg-amber-50/10"
                  )}
                >
                  {/* TOPO DO CARD: CHALÉ E STATUS */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "p-3 rounded-2xl font-black text-sm shrink-0 flex items-center justify-center shadow-xs",
                        isAvailable && "bg-emerald-100 text-emerald-950 border border-emerald-300",
                        isOccupied && "bg-red-100 text-red-950 border border-red-300",
                        isBlocked && "bg-amber-100 text-amber-950 border border-amber-300"
                      )}>
                        <Home className="w-5 h-5 stroke-[2.5]" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-amber-400">
                            Chalé {String(unit.id).padStart(2, '0')}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {unit.type === 'alvenaria' ? 'Alvenaria Tradicional' : 'Vidro Panorâmico (Luxo)'}
                          </span>
                        </div>
                        <h4 className="font-black text-lg text-slate-950 mt-0.5">{unit.name}</h4>
                        <span className="text-xs font-bold text-slate-800 block">
                          Entrada: 15h (Qui 09h) · Saída: 12h · Café das 07h às 09h
                        </span>
                      </div>
                    </div>

                    {/* BADGES: Ocupado=Vermelho, Livre=Verde, Manutenção=Amarelo */}
                    <Badge className={cn(
                      "font-black uppercase tracking-wider text-xs px-3.5 py-1.5 rounded-xl shadow-xs",
                      isAvailable && "bg-emerald-600 text-white border border-emerald-700",
                      isOccupied && "bg-red-600 text-white border border-red-700 animate-pulse",
                      isBlocked && "bg-amber-400 text-slate-950 border border-amber-500 font-black"
                    )}>
                      {isAvailable ? 'LIVRE' : isOccupied ? 'OCUPADO' : 'MANUTENÇÃO'}
                    </Badge>
                  </div>

                  {/* SE OCUPADO: DADOS DO HÓSPEDE E FERRAMENTAS COM FUNDO BRANCO */}
                  {isOccupied && res ? (
                    <div className="space-y-4">
                      
                      <div className="bg-white rounded-2xl p-4 border-2 border-red-200 shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[10px] font-black uppercase text-red-700 tracking-wider block">Responsável da Reserva</span>
                            <span className="font-black text-base text-slate-950">{res.guestName}</span>
                            <span className="text-xs text-slate-800 font-bold flex items-center gap-1.5 mt-0.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" /> {res.phone}
                            </span>
                          </div>

                          <div className="text-right">
                            <Badge className="font-black text-[11px] bg-amber-400 text-slate-950 border-amber-500 uppercase">
                              {res.packageTitle}
                            </Badge>
                            <span className="text-[11px] text-slate-600 font-bold block mt-1">
                              Cód: {res.confirmationCode || `CHA-${res.chaleId}`}
                            </span>
                          </div>
                        </div>

                        {/* DETALHES DE DATAS E HORÁRIOS */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-500 block">Check-in:</span>
                            <span className="text-slate-950 font-black">{res.checkInDate} às {res.checkInTime}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-500 block">Check-out:</span>
                            <span className="text-slate-950 font-black">{res.checkOutDate} às {res.checkOutTime}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-500 block">Valor da Reserva:</span>
                            <span className="text-emerald-700 font-black text-sm">{formatCurrency(res.totalPrice)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-500 block">Forma de Pagamento:</span>
                            <span className="text-slate-900 font-black">{res.paymentMethod || 'PIX'}</span>
                          </div>
                        </div>

                        {/* BOTÕES DE FERRAMENTAS: LEGÍVEIS, COM ÍCONES E FUNDO BRANCO */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Ações Rápidas • Controle de Reserva
                          </span>

                          <div className="space-y-1.5">
                            {/* LINHA 1 DE AÇÕES: STATUS, CHECK-IN, ITENS E DESOCUPAR */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {/* PAGO OK */}
                              <Button
                                size="sm"
                                onClick={() => handleTogglePayment(res)}
                                className={cn(
                                  "h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 bg-white transition-all shadow-xs",
                                  res.status === 'paid'
                                    ? "border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                                    : "border-amber-500 text-amber-800 hover:bg-amber-50"
                                )}
                                title="Alterar status de pagamento"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[9px] uppercase tracking-wider">
                                  {res.status === 'paid' ? 'PAGO OK' : 'A PAGAR'}
                                </span>
                              </Button>

                              {/* CHECK-IN */}
                              <Button
                                size="sm"
                                onClick={() => handleToggleCheckIn(res)}
                                className={cn(
                                  "h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 bg-white transition-all shadow-xs",
                                  res.isCheckedIn
                                    ? "border-blue-600 text-blue-800 hover:bg-blue-50"
                                    : "border-slate-400 text-slate-800 hover:bg-slate-50"
                                )}
                                title="Registrar hóspede no chalé"
                              >
                                <UserCheck className="w-3.5 h-3.5 stroke-[2.5] text-blue-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[9px] uppercase tracking-wider">
                                  {res.isCheckedIn ? 'NO CHALÉ' : 'CHECK-IN'}
                                </span>
                              </Button>

                              {/* + PRODUTOS / SERVIÇOS */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAddItems(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-800 shadow-xs"
                                title="Adicionar produtos e serviços (quiosques, quadriciclos, refeições, pesca)"
                              >
                                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[9px] uppercase tracking-wider">
                                  + PRODUTOS
                                </span>
                              </Button>

                              {/* DESOCUPAR / LIBERAR CHALÉ */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDesocuparChale(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-teal-600 bg-white hover:bg-teal-50 text-teal-800 shadow-xs"
                                title="Marcar como desocupado e liberar chalé para novas reservas no site"
                              >
                                <DoorOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[9px] uppercase tracking-wider">
                                  DESOCUPAR
                                </span>
                              </Button>
                            </div>

                            {/* LINHA 2 DE AÇÕES: GESTÃO E COMPROVANTES */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                              {/* REAGENDAR */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReschedule(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-indigo-500 bg-white hover:bg-indigo-50 shadow-xs"
                                title="Reagendar estadia"
                              >
                                <CalendarDays className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[8.5px] uppercase tracking-wider">
                                  REAGENDAR
                                </span>
                              </Button>

                              {/* EDITAR */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditBooking(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-amber-500 bg-white hover:bg-amber-50 shadow-xs"
                                title="Editar dados da reserva"
                              >
                                <Edit className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[8.5px] uppercase tracking-wider">
                                  EDITAR
                                </span>
                              </Button>

                              {/* CANCELAR */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteBooking(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-rose-500 bg-white hover:bg-rose-50 shadow-xs"
                                title="Cancelar/Excluir reserva e liberar chalé"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[8.5px] uppercase tracking-wider">
                                  CANCELAR
                                </span>
                              </Button>

                              {/* VOUCHER EM IMAGEM */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenVoucherModal(res)}
                                className="h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 border-purple-500 bg-white hover:bg-purple-50 shadow-xs"
                                title="Gerar e compartilhar voucher oficial em imagem"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                <span className="text-slate-900 font-black text-[8.5px] uppercase tracking-wider">
                                  VOUCHER
                                </span>
                              </Button>

                              {/* ANEXO / COMPROVANTE */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenReceiptModal(res)}
                                className={cn(
                                  "h-10 rounded-xl font-black flex items-center justify-center gap-1.5 px-2 border-2 bg-white hover:bg-slate-50 shadow-xs col-span-2 sm:col-span-1",
                                  res.receiptUrl ? "border-emerald-500" : "border-slate-400"
                                )}
                                title="Visualizar ou anexar comprovante de pagamento"
                              >
                                <Paperclip className={cn("w-3.5 h-3.5 shrink-0", res.receiptUrl ? "text-emerald-600" : "text-slate-600")} />
                                <span className="text-slate-900 font-black text-[8.5px] uppercase tracking-wider">
                                  {res.receiptUrl ? 'ANEXO ✓' : 'ANEXO'}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* NOTAS INTERNAS GERAIS */}
                        <div className="bg-[#0b2b24] text-white p-3.5 rounded-2xl shadow-inner border border-emerald-900 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                              <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                              Notas Internas Gerais
                            </span>
                            {editingNoteChaleId !== unit.id && (
                              <button
                                onClick={() => {
                                  setEditingNoteChaleId(unit.id);
                                  setCurrentNoteText(res.notes || '');
                                }}
                                className="text-[10px] font-bold text-amber-400 hover:underline"
                              >
                                Editar Nota
                              </button>
                            )}
                          </div>

                          {editingNoteChaleId === unit.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={currentNoteText}
                                onChange={(e) => setCurrentNoteText(e.target.value)}
                                className="bg-black/30 border-emerald-700/60 text-white text-xs rounded-xl min-h-[60px]"
                                placeholder="Digite anotações internas para este chalé..."
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNote(res, currentNoteText)}
                                  className="h-7 px-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] rounded-lg"
                                >
                                  Salvar Nota
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingNoteChaleId(null)}
                                  className="h-7 px-2 text-white/60 hover:text-white text-[10px]"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p 
                              onClick={() => {
                                setEditingNoteChaleId(unit.id);
                                setCurrentNoteText(res.notes || '');
                              }}
                              className="text-xs text-emerald-100 font-medium italic cursor-pointer hover:text-white transition-colors"
                            >
                              "{res.notes || 'Sem anotações internas. Clique para adicionar.'}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SE DISPONÍVEL OU EM MANUTENÇÃO */
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                      <p className="text-sm font-black text-slate-900">
                        {isAvailable ? "✨ Chalé Totalmente Disponível" : "⛔ Bloqueado para Manutenção / Em Breve"}
                      </p>
                      <p className="text-xs text-slate-700 font-medium max-w-sm mx-auto">
                        {isAvailable 
                          ? "Este chalé está limpo, higienizado e pronto para receber hóspedes."
                          : "Temporariamente indisponível para reservas online."}
                      </p>

                      {isAvailable && (
                        <Button
                          onClick={() => handleOpenNewBooking(unit.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-10 px-6 shadow-sm"
                        >
                          + Reservar este Chalé
                        </Button>
                      )}
                    </div>
                  )}

                  {/* RODAPÉ DO CARD: CAPACIDADE E MANUTENÇÃO COM ALTO CONTRASTE */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-xs font-black text-slate-950">
                      Capacidade Máx: 2 adultos (+ até 2 crianças)
                    </span>

                    {isOccupied && res && (
                      <Button
                        size="sm"
                        onClick={() => handleDesocuparChale(res)}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-9 px-3 shadow-xs flex items-center gap-1.5 border border-teal-700"
                        title="Desocupar o chalé e torná-lo livre imediatamente no site"
                      >
                        <DoorOpen className="w-3.5 h-3.5" />
                        Desocupar Chalé
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBlock(unit.id)}
                      className={cn(
                        "rounded-xl text-xs font-black uppercase tracking-wider h-9 transition-all shadow-xs",
                        isBlocked 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 font-black" 
                          : "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 font-black"
                      )}
                    >
                      {isBlocked ? "Liberar Disponibilidade" : "Bloquear p/ Manutenção"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA: CAMPING */}
      {activeSubTab === 'camping' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border-2 border-emerald-200 p-6 shadow-sm">
            <h4 className="font-black text-emerald-950 text-lg flex items-center gap-2 mb-4">
              <Tent className="w-5 h-5 text-emerald-700" /> Reservas de Camping Balneário Lessa
            </h4>
            
            {campingBookings.length === 0 ? (
              <div className="p-8 text-center text-slate-600 text-xs font-bold bg-slate-50 rounded-2xl border border-slate-200">
                Nenhum pernoite de camping registrado no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campingBookings.map((camp, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-300 bg-slate-50 flex items-center justify-between shadow-xs">
                    <div>
                      <span className="font-black text-base text-emerald-950 block">{camp.customerName}</span>
                      <span className="text-xs font-bold text-slate-700 block">{camp.peopleCount} campista(s) · {camp.phone}</span>
                      <span className="text-xs text-emerald-800 font-black block mt-1">Data: {camp.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-sans font-black text-emerald-950 text-lg block">{formatCurrency(camp.totalPrice)}</span>
                      <Badge className="font-black text-[10px] bg-emerald-100 text-emerald-950 border-emerald-400 uppercase">
                        {camp.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL COMPLETO: NOVA RESERVA INTERNA DE CHALÉ OU ALTERAR RESERVA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl p-5 sm:p-6 bg-white border-2 border-emerald-200 shadow-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="space-y-1 border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              {isEditing
                ? `Alterar Reserva • Chalé ${String(formChaleId).padStart(2, '0')}`
                : isChaleLocked
                ? `Nova Reserva Interna • Chalé ${String(formChaleId).padStart(2, '0')}`
                : 'Nova Reserva Interna de Chalé'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              Motor oficial de datas, pacotes comerciais, nomes de todos os ocupantes, adição de serviços e geração de QR Code PIX / Cartão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. UNIDADE DO CHALÉ (TRAVADO QUANDO SELECIONADO NO CARD ESPECÍFICO) */}
            {isChaleLocked ? (
              <div className="bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 text-white p-3.5 rounded-2xl border-2 border-amber-400 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black">
                    <Home className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider block">
                      Unidade Selecionada para Reserva Interna
                    </span>
                    <span className="font-black text-sm sm:text-base text-white">
                      {selectedUnitObj.name} ({selectedUnitObj.modelLabel})
                    </span>
                  </div>
                </div>
                <Badge className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-2.5 py-1">
                  Chalé {String(formChaleId).padStart(2, '0')} Fixo
                </Badge>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-900">Selecione o Chalé (01 ao 12):</Label>
                <select
                  value={formChaleId}
                  onChange={(e) => setFormChaleId(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/40 font-black text-xs text-slate-950"
                >
                  {CHALE_UNITS.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.type === 'alvenaria' ? 'Alvenaria' : 'Vidro Panorâmico'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. MOTOR DE CALENDÁRIO E ATALHOS DE PACOTES COMERCIAIS */}
            <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-700" />
                  Datas, Horários e Pacotes Oficiais de Hospedagem
                </span>
                <span className="text-[10.5px] font-bold text-emerald-800">
                  Check-in: {formCheckInTime} · Check-out: {formCheckOutTime} ({modalStayPricing.nightsCount} noite{modalStayPricing.nightsCount > 1 ? 's' : ''})
                </span>
              </div>

              {/* Atalhos Rápidos de Pacotes Comerciais */}
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Pacote Comercial / Modalidade de Estadia:</Label>
                <select
                  value={formPackageType}
                  onChange={(e) => handleSelectPackagePreset(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border-2 border-emerald-500 bg-white font-black text-xs text-slate-950 shadow-2xs"
                >
                  <optgroup label="🔥 Combos Promocionais (10% OFF Automático)">
                    <option value="combo-2n-sex-dom">Combo 2 Noites — Sexta a Domingo (Casal R$ 819 · Ind. R$ 639)</option>
                    <option value="combo-2n-qui-sab">Combo 2 Noites — Quinta a Sábado (Casal R$ 702 · Ind. R$ 522)</option>
                    <option value="combo-2n-sab-seg">Combo 2 Noites — Sábado a Segunda (Casal R$ 711 · Ind. R$ 531)</option>
                    <option value="combo-3n-qui-dom">Combo 3 Noites — Quinta a Domingo (Casal R$ 1.125 · Ind. R$ 855)</option>
                    <option value="combo-3n-sex-seg">Combo 3 Noites — Sexta a Segunda (Casal R$ 1.107 · Ind. R$ 837)</option>
                    <option value="combo-4n-qui-seg">Combo 4 Noites — Quinta a Segunda (Casal R$ 1.413 · Ind. R$ 1.053)</option>
                  </optgroup>
                  <optgroup label="📅 Diárias Avulsas (1 Noite)">
                    <option value="diaria-qui-sex">Diária Avulsa — Quinta a Sexta (Casal R$ 340 · Ind. R$ 240)</option>
                    <option value="diaria-sex-sab">Diária Avulsa — Sexta a Sábado (Casal R$ 440 · Ind. R$ 340)</option>
                    <option value="diaria-sab-dom">Diária Avulsa — Sábado a Domingo (Casal R$ 470 · Ind. R$ 370)</option>
                    <option value="diaria-dom-seg">Diária Avulsa — Domingo a Segunda (Casal R$ 320 · Ind. R$ 220)</option>
                  </optgroup>
                  <optgroup label="⚙️ Personalizado">
                    <option value="custom">Período / Valor Personalizado</option>
                  </optgroup>
                </select>
              </div>

              {/* Calendário Interativo de Entrada e Saída + Horários */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-slate-900">📅 Data de Entrada (Check-in):</Label>
                  <div className="flex gap-1.5">
                    <Popover open={isInCalendarOpen} onOpenChange={setIsInCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex-1 h-10 px-3 rounded-xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-left font-black text-xs text-slate-950 flex items-center justify-between"
                        >
                          <span>
                            {formCheckInDate ? format(new Date(`${formCheckInDate}T12:00:00`), 'dd/MM/yyyy (EEE)', { locale: ptBR }) : 'Selecionar'}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 bg-white rounded-2xl border-2 border-emerald-600 shadow-xl" align="start">
                        <CalendarUI
                          mode="single"
                          selected={formCheckInDate ? new Date(`${formCheckInDate}T12:00:00`) : undefined}
                          onSelect={(d) => d && handleModalSelectCheckIn(d)}
                          disabled={(d) => !isChaleCheckInDay(d)}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={formCheckInTime}
                      onChange={(e) => setFormCheckInTime(e.target.value)}
                      className="w-24 h-10 text-xs font-black rounded-xl border-slate-300 bg-white text-slate-950"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-slate-900">📅 Data de Saída (Check-out):</Label>
                  <div className="flex gap-1.5">
                    <Popover open={isOutCalendarOpen} onOpenChange={setIsOutCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex-1 h-10 px-3 rounded-xl border-2 border-amber-500 bg-white hover:bg-amber-50 text-left font-black text-xs text-slate-950 flex items-center justify-between"
                        >
                          <span>
                            {formCheckOutDate ? format(new Date(`${formCheckOutDate}T12:00:00`), 'dd/MM/yyyy (EEE)', { locale: ptBR }) : 'Selecionar'}
                          </span>
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 bg-white rounded-2xl border-2 border-amber-500 shadow-xl" align="end">
                        <CalendarUI
                          mode="single"
                          selected={formCheckOutDate ? new Date(`${formCheckOutDate}T12:00:00`) : undefined}
                          onSelect={(d) => d && handleModalSelectCheckOut(d)}
                          disabled={(d) => !isChaleCheckOutDay(d)}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={formCheckOutTime}
                      onChange={(e) => setFormCheckOutTime(e.target.value)}
                      className="w-24 h-10 text-xs font-black rounded-xl border-slate-300 bg-white text-slate-950"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. OCUPAÇÃO E NOMES DE TODOS OS OCUPANTES (ADULTOS E CRIANÇAS) */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black uppercase text-slate-950 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-700" />
                  Ocupação e Identificação de Todos os Hóspedes
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormOccupancyType('casal');
                      setFormCustomPriceOverride(null);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-black border transition-all cursor-pointer",
                      formOccupancyType === 'casal'
                        ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300"
                    )}
                  >
                    👥 Casal (2 Adultos)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormOccupancyType('individual');
                      setFormCustomPriceOverride(null);
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-black border transition-all cursor-pointer",
                      formOccupancyType === 'individual'
                        ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300"
                    )}
                  >
                    👤 Individual (1 Adulto)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-black text-slate-900">Adulto 1 • Hóspede Titular:</Label>
                  <Input
                    placeholder="Nome completo do titular"
                    value={formGuestName}
                    onChange={(e) => setFormGuestName(e.target.value)}
                    className="h-10 text-xs font-bold rounded-xl border-slate-300 bg-white text-slate-900"
                  />
                </div>

                {formOccupancyType === 'casal' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-black text-slate-900">Adulto 2 • Acompanhante:</Label>
                    <Input
                      placeholder="Nome completo do acompanhante"
                      value={formAdult2Name}
                      onChange={(e) => setFormAdult2Name(e.target.value)}
                      className="h-10 text-xs font-bold rounded-xl border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-black text-slate-900">WhatsApp / Telefone:</Label>
                  <Input
                    placeholder="(69) 99999-0000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="h-10 text-xs font-bold rounded-xl border-slate-300 bg-white text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-black text-slate-900">CPF do Titular:</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    className="h-10 text-xs font-bold rounded-xl border-slate-300 bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Adicional de Crianças (Filhos dos Hóspedes — até 2 por chalé) */}
              <div className="pt-2.5 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Baby className="w-4 h-4 text-amber-600" />
                      Crianças Adicionais neste Chalé (Filhos • Máx 2):
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 block">
                      Até 11 anos: R$ 50/noite (R$ 45 em combo) · 12+ anos: R$ 100/noite (R$ 90 em combo)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={formKids.length === 0}
                      onClick={() => {
                        setFormKids(prev => prev.slice(0, -1));
                        setFormCustomPriceOverride(null);
                      }}
                      className="h-8 w-8 p-0 rounded-lg border-slate-300"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="w-6 text-center font-black text-xs text-slate-950">{formKids.length}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={formKids.length >= 2}
                      onClick={() => {
                        if (formKids.length < 2) {
                          setFormKids(prev => [...prev, { name: '', ageGroup: 'under11' }]);
                          setFormCustomPriceOverride(null);
                        }
                      }}
                      className="h-8 w-8 p-0 rounded-lg border-slate-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {formKids.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {formKids.map((kid, idx) => (
                      <div key={idx} className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-black text-amber-950">Criança {idx + 1}:</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormKids(prev => prev.map((k, i) => (i === idx ? { ...k, ageGroup: 'under11' } : k)));
                                setFormCustomPriceOverride(null);
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black border cursor-pointer",
                                kid.ageGroup === 'under11'
                                  ? "bg-amber-400 text-slate-950 border-amber-500"
                                  : "bg-white text-slate-600 border-slate-200"
                              )}
                            >
                              Até 11 anos
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormKids(prev => prev.map((k, i) => (i === idx ? { ...k, ageGroup: '12plus' } : k)));
                                setFormCustomPriceOverride(null);
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black border cursor-pointer",
                                kid.ageGroup === '12plus'
                                  ? "bg-amber-400 text-slate-950 border-amber-500"
                                  : "bg-white text-slate-600 border-slate-200"
                              )}
                            >
                              12+ anos
                            </button>
                          </div>
                        </div>
                        <Input
                          placeholder={`Nome e idade da criança ${idx + 1}`}
                          value={kid.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormKids(prev => prev.map((k, i) => (i === idx ? { ...k, name: val } : k)));
                          }}
                          className="h-9 text-xs font-bold bg-white border-amber-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. ADIÇÃO DE SERVIÇOS EXTRAS NA RESERVA (QUIOSQUES, QUADRICICLOS, DIVERSÕES) */}
            <div className="bg-white p-3.5 rounded-2xl border-2 border-emerald-100 space-y-3">
              <span className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                Adição de Serviços Opcionais na Mesma Reserva (Quiosque, Quadriciclo, Diversões)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Quiosque */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-slate-800">Adicionar Quiosque:</Label>
                  <div className="flex gap-1.5">
                    <select
                      value={extraKioskType}
                      onChange={(e) => {
                        setExtraKioskType(e.target.value as any);
                        setFormCustomPriceOverride(null);
                      }}
                      className="flex-1 h-9 px-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                    >
                      <option value="none">Nenhum Quiosque</option>
                      <option value="familiar">Quiosque Familiar (R$ 75)</option>
                      <option value="menor">Quiosque Médio (R$ 100)</option>
                      <option value="maior">Quiosque Grande (R$ 150)</option>
                    </select>
                    {extraKioskType !== 'none' && (
                      <Input
                        type="number"
                        min={1}
                        max={22}
                        value={extraKioskNumber}
                        onChange={(e) => setExtraKioskNumber(Number(e.target.value) || 1)}
                        placeholder="Nº"
                        title="Número do Quiosque"
                        className="w-16 h-9 text-xs font-black text-center rounded-xl border-slate-300"
                      />
                    )}
                  </div>
                </div>

                {/* Passeio de Quadriciclo */}
                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-slate-800">Passeio de Quadriciclo:</Label>
                  <div className="flex gap-1.5">
                    <select
                      value={extraQuadType}
                      onChange={(e) => {
                        setExtraQuadType(e.target.value as any);
                        setFormCustomPriceOverride(null);
                      }}
                      className="flex-1 h-9 px-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                    >
                      <option value="none">Nenhum Quadriciclo</option>
                      <option value="individual">Individual (R$ 130)</option>
                      <option value="dupla">De Dupla (R$ 195)</option>
                    </select>
                    {extraQuadType !== 'none' && (
                      <select
                        value={extraQuadTime}
                        onChange={(e) => setExtraQuadTime(e.target.value)}
                        className="w-24 h-9 px-2 rounded-xl border border-amber-400 bg-amber-50 font-black text-xs text-slate-950"
                      >
                        {QUAD_TIMES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Pesca Esportiva */}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-black text-slate-900 block">🎣 Pesca Esportiva</span>
                    <span className="text-[10px] font-bold text-slate-500">R$ 20,00 por pessoa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExtraPescaQty(q => Math.max(0, q - 1));
                        setFormCustomPriceOverride(null);
                      }}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-5 text-center font-black text-xs">{extraPescaQty}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExtraPescaQty(q => q + 1);
                        setFormCustomPriceOverride(null);
                      }}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Futebol de Sabão */}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-black text-slate-900 block">🫧 Futebol de Sabão</span>
                    <span className="text-[10px] font-bold text-slate-500">R$ 10,00 por pessoa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExtraSabaoQty(q => Math.max(0, q - 1));
                        setFormCustomPriceOverride(null);
                      }}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-5 text-center font-black text-xs">{extraSabaoQty}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setExtraSabaoQty(q => q + 1);
                        setFormCustomPriceOverride(null);
                      }}
                      className="h-7 w-7 p-0 rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. RESUMO AUTOMÁTICO DE VALORES, PAGAMENTO E STATUS */}
            <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-4 rounded-2xl border-2 border-amber-400 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/15 pb-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                    Cálculo Automático da Reserva
                  </span>
                  <span className="text-xs font-bold text-emerald-100">
                    Hospedagem: {formatCurrency(modalPricingBreakdown.chaleFinal)}
                    {modalPricingBreakdown.extrasNet > 0 ? ` + Extras: ${formatCurrency(modalPricingBreakdown.extrasNet)}` : ''}
                  </span>
                </div>

                <label className="flex items-center gap-2 text-xs font-black text-amber-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formApplySiteDiscount}
                    onChange={(e) => {
                      setFormApplySiteDiscount(e.target.checked);
                      setFormCustomPriceOverride(null);
                    }}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                  Aplicar 10% OFF (Desconto Site / Combo)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-amber-300">Valor Final Total (R$):</Label>
                  <Input
                    type="number"
                    value={modalPricingBreakdown.finalTotal}
                    onChange={(e) => setFormCustomPriceOverride(Number(e.target.value))}
                    className="h-10 text-sm font-black rounded-xl border-amber-400 bg-white text-slate-950"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-emerald-200">Forma de Pagamento:</Label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-950"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cortesia">Cortesia</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-black text-emerald-200">Status da Reserva:</Label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-950"
                  >
                    <option value="paid">PAGO OK</option>
                    <option value="pending">Aguardando Pagamento</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-slate-900">Notas / Observações Internas:</Label>
              <Textarea
                placeholder="Ex: Reserva balcão, solicitou berço, com desconto..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs font-medium rounded-xl border-slate-300 min-h-[60px] text-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              onClick={() => handleGenerateAdminPayment('PIX')}
              disabled={generatingPayment}
              className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md"
            >
              {generatingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4 text-amber-300" />}
              Gerar QR Code PIX
            </Button>

            <Button
              type="button"
              onClick={() => handleGenerateAdminPayment('CREDIT_CARD')}
              disabled={generatingPayment}
              className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md"
            >
              {generatingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 text-amber-400" />}
              Pagar com Cartão
            </Button>

            <Button
              type="button"
              onClick={handleSaveBooking}
              className="flex-1 h-11 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md"
            >
              {isEditing ? 'Salvar Alterações' : '✓ Confirmar Reserva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE PAGAMENTO PIX / CARTÃO DISPARADO PELA RESERVA INTERNA */}
      {adminPaymentData && (
        <PaymentModal
          open={adminPaymentData.open}
          onOpenChange={(op) => setAdminPaymentData(prev => prev ? { ...prev, open: op } : null)}
          orderId={adminPaymentData.orderId}
          name={adminPaymentData.name}
          email=""
          phone={adminPaymentData.phone}
          cpf={adminPaymentData.cpf}
          totalAmount={adminPaymentData.totalAmount}
          initialMethod={adminPaymentData.initialMethod}
          onSuccess={() => {
            setLocalReservations(prev => prev.map(r => (
              r.chaleId === adminPaymentData.chaleId ? { ...r, status: 'paid' } : r
            )));
            setAdminPaymentData(null);
            toast({
              title: '✓ Pagamento Confirmado!',
              description: `A reserva do Chalé ${String(adminPaymentData.chaleId).padStart(2, '0')} foi marcada como PAGO OK.`
            });
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* MODAL: GERADOR DE IMAGEM DO VOUCHER COM HTML2CANVAS (COMO DAY USE) */}
      <Dialog open={isVoucherModalOpen} onOpenChange={setIsVoucherModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Comprovante & Voucher do Chalé {voucherRes?.chaleId}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Gere a imagem oficial do voucher para salvar ou enviar diretamente no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {voucherRes && (
            <div className="space-y-4 py-2">
              {/* CARTÃO DO VOUCHER PRONTO PARA CAPTURA POR HTML2CANVAS */}
              <div
                ref={voucherPrintRef}
                className="bg-gradient-to-br from-[#022112] via-[#04331c] to-[#01170c] text-white rounded-[2rem] p-6 shadow-2xl border-4 border-amber-400 space-y-4 relative overflow-hidden"
              >
                {/* Cabeçalho */}
                <div className="text-center space-y-1 pb-3 border-b border-white/20">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block">
                    🌿 Balneário Lessa • Hospedagem
                  </span>
                  <h3 className="font-sans font-black text-xl text-white tracking-tight">
                    VOUCHER DE HOSPEDAGEM
                  </h3>
                  <div className="inline-block bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-3 py-0.5 rounded-full">
                    Chalé {String(voucherRes.chaleId).padStart(2, '0')} · {voucherRes.confirmationCode || 'CHA-OK'}
                  </div>
                </div>

                {/* Dados da Estadia */}
                <div className="bg-white/10 rounded-2xl p-3.5 space-y-2 text-xs border border-white/15">
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Titular:</span>
                    <span className="font-black text-white">{voucherRes.guestName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">CPF:</span>
                    <span className="font-black text-amber-300">{voucherRes.cpf || '123.456.789-00'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Telefone / WhatsApp:</span>
                    <span className="font-bold text-white">{voucherRes.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Check-in (Entrada):</span>
                    <span className="font-black text-white">{voucherRes.checkInDate} às {voucherRes.checkInTime || '15:00'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Check-out (Saída):</span>
                    <span className="font-black text-amber-300">{voucherRes.checkOutDate} às {voucherRes.checkOutTime || '12:00'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Pacote & Modalidade:</span>
                    <span className="font-black text-amber-400 text-right">
                      {voucherRes.packageTitle} ({voucherRes.occupancyType === 'individual' ? 'Individual' : 'Casal'})
                    </span>
                  </div>
                  <div className="space-y-1 border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px] block">
                      Nomes dos Hóspedes ({voucherRes.adults} Adulto{voucherRes.adults > 1 ? 's' : ''}{voucherRes.children > 0 ? ` + ${voucherRes.children} Criança(s)` : ''}):
                    </span>
                    <div className="text-[11px] font-bold text-white space-y-0.5 pl-1">
                      {(voucherRes.adultNames && voucherRes.adultNames.length > 0
                        ? voucherRes.adultNames
                        : [voucherRes.guestName, ...(voucherRes.occupancyType === 'casal' ? ['Acompanhante Adulto 2'] : [])]
                      ).map((name, i) => (
                        <div key={i}>👤 {name}</div>
                      ))}
                      {(voucherRes.childNames && voucherRes.childNames.length > 0) ? (
                        voucherRes.childNames.map((c, i) => (
                          <div key={i} className="text-amber-300">👶 {c.name} ({c.ageLabel})</div>
                        ))
                      ) : voucherRes.children > 0 ? (
                        <div className="text-amber-300">👶 {voucherRes.children}x Criança adicional (Filho(a) do Hóspede)</div>
                      ) : null}
                    </div>
                  </div>
                  {voucherRes.extraItems && voucherRes.extraItems.length > 0 && (
                    <div className="space-y-1 border-b border-white/10 pb-1.5">
                      <span className="text-emerald-200 font-bold uppercase text-[10px] block">
                        Demais Itens Inclusos na Reserva:
                      </span>
                      <div className="text-[11px] font-bold text-amber-200 space-y-0.5 pl-1">
                        {voucherRes.extraItems.map((ext, i) => (
                          <div key={i} className="flex justify-between">
                            <span>• {ext.quantity}x {ext.name}{ext.timeSlot ? ` (${ext.timeSlot})` : ''}</span>
                            <span>{formatCurrency(ext.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Café (Sex-Dom 7h-9h) & Day Use:</span>
                    <span className="font-black text-emerald-300">100% Inclusos ✓</span>
                  </div>
                </div>

                {/* QR Code e Status */}
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-300 block">Status Pagamento:</span>
                    <span className={cn(
                      "text-xs font-black px-2.5 py-0.5 rounded-lg inline-block uppercase",
                      voucherRes.status === 'paid' ? "bg-emerald-500 text-slate-950" : "bg-amber-400 text-slate-950"
                    )}>
                      {voucherRes.status === 'paid' ? 'PAGO OK ✓' : 'A PAGAR'}
                    </span>
                    <span className="text-[11px] font-black text-white block pt-1">
                      Total: {formatCurrency(voucherRes.totalPrice)}
                    </span>
                  </div>

                  <div className="bg-white p-1.5 rounded-xl shadow-md">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=https://reservas.balneariolessa.com.br/voucher/${voucherRes.confirmationCode || 'CHA-OK'}`}
                      alt="QR Code do Voucher"
                      className="w-16 h-16"
                    />
                  </div>
                </div>

                <div className="text-center pt-1 border-t border-white/10 text-[9px] text-emerald-200/80 font-medium">
                  Apresente este voucher na portaria do Balneário Lessa.
                </div>
              </div>

              {/* Ações do Voucher: Gerar Imagem, Baixar e WhatsApp */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleGenerateVoucherImage}
                  disabled={isGeneratingVoucherImage}
                  className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  {isGeneratingVoucherImage ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando Imagem...</>
                  ) : (
                    <><ImageIcon className="w-4 h-4" /> 📷 Gerar e Copiar Imagem do Voucher</>
                  )}
                </Button>

                {voucherImageGenerated && (
                  <Button
                    onClick={handleDownloadVoucherImage}
                    variant="outline"
                    className="w-full h-10 border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Baixar Imagem Gerada (.PNG)
                  </Button>
                )}

                <Button
                  onClick={handleSendVoucherWhatsApp}
                  variant="outline"
                  className="w-full h-10 border-2 border-slate-300 text-slate-900 hover:bg-slate-100 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4 text-emerald-600" /> Enviar Mensagem no WhatsApp
                </Button>

                <Button
                  onClick={() => window.open(`/voucher/${voucherRes.confirmationCode || 'CHA-8931'}`, '_blank')}
                  variant="outline"
                  className="w-full h-10 border-2 border-amber-400 bg-amber-50 text-emerald-950 hover:bg-amber-100 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-amber-600" /> Ver Página Completa do Voucher ({voucherRes.confirmationCode || 'CHA-8931'})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: ANEXOS & COMPROVANTES DE PAGAMENTO FUNCIONANDO */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-emerald-600" />
              Comprovante • Chalé {receiptRes?.chaleId} ({receiptRes?.guestName})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Anexe ou visualize o comprovante de pagamento Pix, transferência ou cartão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {receiptRes?.receiptUrl ? (
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-emerald-300 overflow-hidden bg-slate-100 flex items-center justify-center max-h-64 shadow-xs">
                  <img 
                    src={receiptRes.receiptUrl} 
                    alt="Comprovante de pagamento" 
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() => window.open(receiptRes.receiptUrl!, '_blank')}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => window.open(receiptRes.receiptUrl!, '_blank')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase h-10 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-4 h-4" /> Abrir em Tela Cheia
                  </Button>
                  <Button
                    onClick={handleRemoveReceipt}
                    variant="outline"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50 font-black text-xs uppercase h-10 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-3 bg-slate-50">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-black text-xs text-slate-900 block">Nenhum comprovante anexado</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Selecione uma imagem ou foto do comprovante para anexar a esta reserva.
                  </span>
                </div>

                <input 
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleUploadReceiptFile}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingReceipt}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl h-10 px-5 shadow-sm"
                >
                  {uploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : "+ Anexar Comprovante"}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReceiptModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: REAGENDAMENTO RÁPIDO */}
      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border border-slate-200 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-black text-emerald-950 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-indigo-600" />
              Reagendar Chalé {rescheduleChaleId}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Altere as datas de entrada e saída para atualizar o período da estadia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-800">Nova Data de Entrada:</Label>
              <Input
                type="date"
                value={rescheduleInDate}
                onChange={(e) => setRescheduleInDate(e.target.value)}
                className="h-10 text-xs font-bold rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-800">Nova Data de Saída:</Label>
              <Input
                type="date"
                value={rescheduleOutDate}
                onChange={(e) => setRescheduleOutDate(e.target.value)}
                className="h-10 text-xs font-bold rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsRescheduleOpen(false)}
              className="rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveReschedule}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase"
            >
              Confirmar Reagendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ADICIONAR PRODUTOS/SERVIÇOS À RESERVA DO CHALÉ */}
      {isAddItemsOpen && addItemsBooking && (
        <AddItemsToBookingDialog
          booking={addItemsBooking}
          isOpen={isAddItemsOpen}
          setIsOpen={setIsAddItemsOpen}
          onAdded={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

    </div>
  );
}
