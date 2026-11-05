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
  Trash2,
  CalendarDays,
  X,
  Edit,
  FileCheck,
  StickyNote,
  QrCode,
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
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatCurrency, CHALE_UNITS, CHALE_PACKAGES } from '@/lib/booking-types';
import { AddItemsToBookingDialog } from './AddItemsToBookingDialog';
import { cn } from '@/lib/utils';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import html2canvas from 'html2canvas';

export interface ChaleReservation {
  id: string;
  chaleId: number;
  guestName: string;
  phone: string;
  cpf?: string;
  checkInDate: string;  // 'yyyy-MM-dd'
  checkInTime: string;  // '15:00'
  checkOutDate: string; // 'yyyy-MM-dd'
  checkOutTime: string; // '11:00'
  packageTitle: string;
  packageType?: string;
  occupancyType: 'individual' | 'casal';
  adults: number;
  children: number;
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
  const [activeSubTab, setActiveSubTab] = useState<'chales' | 'camping'>('chales');

  // RESERVAS MANUAIS SALVAS LOCALMENTE
  const [localReservations, setLocalReservations] = useState<ChaleReservation[]>(() => {
    try {
      const saved = localStorage.getItem('lessa_admin_chale_reservations_v2');
      if (saved) return JSON.parse(saved);
      
      return [
        {
          id: 'res-default-1',
          chaleId: 1,
          guestName: 'Carlos Oliveira',
          phone: '(69) 99341-2290',
          cpf: '123.456.789-00',
          checkInDate: '2026-11-06',
          checkInTime: '14:00',
          checkOutDate: '2026-11-08',
          checkOutTime: '12:00',
          packageTitle: 'Combo 2 Noites — Sex a Dom (10% OFF)',
          packageType: 'combo_2n',
          occupancyType: 'casal',
          adults: 2,
          children: 0,
          totalPrice: 729,
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
      return saved ? JSON.parse(saved) : {
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

  // Edição de notas inline
  const [editingNoteChaleId, setEditingNoteChaleId] = useState<number | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState('');

  // Modal: Nova Reserva / Alterar Reserva
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);

  // Form Fields
  const [formChaleId, setFormChaleId] = useState<number>(1);
  const [formGuestName, setFormGuestName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formCheckInDate, setFormCheckInDate] = useState('');
  const [formCheckInTime, setFormCheckInTime] = useState('15:00');
  const [formCheckOutDate, setFormCheckOutDate] = useState('');
  const [formCheckOutTime, setFormCheckOutTime] = useState('11:00');
  const [formOccupancyType, setFormOccupancyType] = useState<'casal' | 'individual'>('casal');
  const [formPackageType, setFormPackageType] = useState<string>('combo_weekend');
  const [formPrice, setFormPrice] = useState<number>(900);
  const [formPaymentMethod, setFormPaymentMethod] = useState('PIX');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [formNotes, setFormNotes] = useState('');

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

  // Extrair reservas reais de Chalés e Camping a partir de orders
  const { realChaleOrders, campingBookings } = useMemo(() => {
    const list: ChaleReservation[] = [];
    const campings: any[] = [];

    (orders || []).forEach((order: any) => {
      const items = order.order_items || [];
      const orderDate = order.visit_date || (typeof order.created_at === 'string' ? order.created_at.split('T')[0] : '');

      items.forEach((item: any) => {
        const prod = (item.product_id || '').toLowerCase();
        
        if (prod.includes('chalé') || prod.includes('chale')) {
          const chaleId = item.metadata?.chale_id || 1;
          const pkgId = item.metadata?.package_type || 'combo_weekend';
          const pkg = CHALE_PACKAGES[pkgId as keyof typeof CHALE_PACKAGES];
          const pkgTitle = pkg ? pkg.title : (item.product_id || 'Hospedagem em Chalé');
          const cInDate = item.metadata?.check_in_date || orderDate || format(new Date(), 'yyyy-MM-dd');
          const cOutDate = item.metadata?.check_out_date || cInDate;

          list.push({
            id: order.id,
            chaleId: Number(chaleId),
            guestName: order.customer_name || 'Hóspede Lessa',
            phone: order.customer_phone || '(Não informado)',
            cpf: order.customer_cpf,
            checkInDate: cInDate,
            checkInTime: item.metadata?.check_in_time || '15:00',
            checkOutDate: cOutDate,
            checkOutTime: item.metadata?.check_out_time || '11:00',
            packageTitle: pkgTitle,
            packageType: pkgId,
            occupancyType: item.metadata?.occupancy_type || 'casal',
            adults: Math.min(2, Math.max(1, item.metadata?.adults || order.adults || 2)),
            children: item.metadata?.children || order.children || 0,
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
          campings.push({
            orderId: order.id,
            customerName: order.customer_name || 'Campista Lessa',
            phone: order.customer_phone || 'Não informado',
            peopleCount: item.quantity || 1,
            unitPrice: item.unit_price || 100,
            totalPrice: (item.quantity || 1) * (item.unit_price || 100),
            date: orderDate ? format(new Date(orderDate), 'dd/MM/yyyy') : '—',
            confirmationCode: order.confirmation_code,
            status: order.status || 'Confirmado'
          });
        }
      });
    });

    return { realChaleOrders: list, campingBookings: campings };
  }, [orders]);

  // NO PAINEL ADMIN: MOSTRA TODOS OS 12 CHALÉS (Chalés 01 a 12: 6 Alvenaria + 6 Vidro)
  const chalesList = useMemo(() => {
    return CHALE_UNITS.map(unit => {
      const localRes = localReservations.find(r => r.chaleId === unit.id && r.status !== 'cancelled');
      const onlineRes = realChaleOrders.find(r => r.chaleId === unit.id && r.status !== 'cancelled');
      
      const reservation = localRes || onlineRes;
      const isManualIndisponivel = manualStatuses[unit.id] === 'indisponivel';

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
    return chalesList.filter(c => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        c.name.toLowerCase().includes(q) ||
        (c.reservation && (
          c.reservation.guestName.toLowerCase().includes(q) ||
          c.reservation.phone.includes(q) ||
          (c.reservation.confirmationCode && c.reservation.confirmationCode.toLowerCase().includes(q))
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
  const handleToggleBlock = (chaleId: number) => {
    setManualStatuses(prev => {
      const next = { ...prev, [chaleId]: prev[chaleId] === 'indisponivel' ? 'disponivel' : 'indisponivel' };
      return next;
    });
    toast({
      title: manualStatuses[chaleId] === 'indisponivel' ? `Chalé ${chaleId} liberado (Verde)` : `Chalé ${chaleId} bloqueado para manutenção (Amarelo)`,
    });
  };

  // Abrir Modal de Nova Reserva
  const handleOpenNewBooking = (targetChaleId?: number) => {
    setIsEditing(false);
    setEditingResId(null);
    setFormChaleId(targetChaleId || 1);
    setFormGuestName('');
    setFormPhone('');
    setFormCpf('');
    const today = format(new Date(), 'yyyy-MM-dd');
    const sunday = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    setFormCheckInDate(today);
    setFormCheckInTime('14:00');
    setFormCheckOutDate(sunday);
    setFormCheckOutTime('12:00');
    setFormOccupancyType('casal');
    setFormPackageType('combo_2n');
    setFormPrice(729);
    setFormPaymentMethod('PIX');
    setFormPaymentStatus('paid');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Abrir Modal para Alterar Reserva Existente
  const handleOpenEditBooking = (reservation: ChaleReservation) => {
    setIsEditing(true);
    setEditingResId(reservation.id);
    setFormChaleId(reservation.chaleId);
    setFormGuestName(reservation.guestName);
    setFormPhone(reservation.phone);
    setFormCpf(reservation.cpf || '');
    setFormCheckInDate(reservation.checkInDate);
    setFormCheckInTime(reservation.checkInTime);
    setFormCheckOutDate(reservation.checkOutDate);
    setFormCheckOutTime(reservation.checkOutTime);
    setFormOccupancyType(reservation.occupancyType || 'casal');
    setFormPackageType(reservation.packageType || 'custom');
    setFormPrice(reservation.totalPrice);
    setFormPaymentMethod(reservation.paymentMethod || 'PIX');
    setFormPaymentStatus(reservation.status === 'paid' ? 'paid' : 'pending');
    setFormNotes(reservation.notes || '');
    setIsModalOpen(true);
  };

  // Salvar Nova Reserva ou Atualização
  const handleSaveBooking = async () => {
    if (!formGuestName.trim()) {
      alert('Por favor, informe o nome do hóspede.');
      return;
    }

    if (isEditing && editingResId) {
      setLocalReservations(prev => prev.map(r => {
        if (r.id === editingResId) {
          return {
            ...r,
            chaleId: formChaleId,
            guestName: formGuestName,
            phone: formPhone,
            cpf: formCpf,
            checkInDate: formCheckInDate,
            checkInTime: formCheckInTime,
            checkOutDate: formCheckOutDate,
            checkOutTime: formCheckOutTime,
            occupancyType: formOccupancyType,
            packageType: formPackageType,
            totalPrice: formPrice,
            paymentMethod: formPaymentMethod,
            status: formPaymentStatus,
            notes: formNotes
          };
        }
        return r;
      }));

      try {
        await supabase.from('orders').update({
          customer_name: formGuestName,
          customer_phone: formPhone,
          total_amount: formPrice,
          status: formPaymentStatus,
          notes: formNotes
        }).eq('id', editingResId);
      } catch (e) {}

      toast({ title: `✓ Reserva do Chalé ${formChaleId} atualizada!` });
    } else {
      const newReservation: ChaleReservation = {
        id: `res-${Date.now()}`,
        chaleId: formChaleId,
        guestName: formGuestName,
        phone: formPhone || '(69) 99999-0000',
        cpf: formCpf,
        checkInDate: formCheckInDate,
        checkInTime: formCheckInTime,
        checkOutDate: formCheckOutDate,
        checkOutTime: formCheckOutTime,
        packageTitle: formPackageType === 'combo_2n' ? 'Combo 2 Noites (Sex a Dom)' :
                       formPackageType === 'combo_3n_qui' ? 'Combo 3 Noites (Qui a Dom)' :
                       formPackageType === 'combo_3n_seg' ? 'Combo 3 Noites (Sex a Seg)' :
                       formPackageType === 'combo_4n' ? 'Combo 4 Noites (Qui a Seg)' :
                       formPackageType === 'diaria_sab_dom' ? 'Diária Sábado a Domingo' :
                       formPackageType === 'diaria_sex_sab' ? 'Diária Sexta a Sábado' :
                       formPackageType === 'diaria_qui_sex' ? 'Diária Quinta a Sexta' :
                       formPackageType === 'diaria_dom_seg' ? 'Diária Domingo a Segunda' : 'Hospedagem Personalizada',
        packageType: formPackageType,
        occupancyType: formOccupancyType,
        adults: formOccupancyType === 'casal' ? 2 : 1,
        children: 0,
        totalPrice: Number(formPrice),
        paymentMethod: formPaymentMethod,
        status: formPaymentStatus,
        isCheckedIn: false,
        confirmationCode: `CHA-${Math.floor(1000 + Math.random() * 9000)}`,
        notes: formNotes || 'Reserva interna realizada pelo Host Admin.'
      };

      setLocalReservations(prev => [...prev.filter(r => r.chaleId !== formChaleId), newReservation]);
      toast({ title: `✓ Chalé ${formChaleId} reservado e marcado como Ocupado (Vermelho)!` });
    }

    setIsModalOpen(false);
    if (onRefresh) onRefresh();
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

            {/* Sub-abas: Chalés / Camping */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-2xl border border-white/15">
              <button
                onClick={() => setActiveSubTab('chales')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  activeSubTab === 'chales'
                    ? "bg-amber-400 text-slate-950 shadow-md scale-[1.02]"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <Bed className="w-4 h-4" /> Chalés (12)
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
            <span className="text-[11px] font-black text-emerald-300 uppercase block tracking-wider">Chalés Livres</span>
            <span className="text-3xl font-black text-white">{countDisponiveis}</span>
          </div>

          <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-red-300 uppercase block tracking-wider">Chalés Ocupados</span>
            <span className="text-3xl font-black text-white">{countOcupados}</span>
          </div>

          <div className="bg-amber-950/80 border-2 border-amber-400/60 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-amber-300 uppercase block tracking-wider">Manutenção</span>
            <span className="text-3xl font-black text-white">{countIndisponiveis}</span>
          </div>

          <div className="bg-purple-950/80 border-2 border-purple-400/50 rounded-2xl p-3.5 text-center shadow-md">
            <span className="text-[11px] font-black text-purple-300 uppercase block tracking-wider">Campistas</span>
            <span className="text-3xl font-black text-white">
              {campingBookings.reduce((sum, c) => sum + (c.peopleCount || 0), 0)}
            </span>
          </div>
        </div>
      </div>

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
                          Entrada: 14h · Saída: 12h · Café das 07h às 09h
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
                      Capacidade Máx: 2 adultos
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

      {/* MODAL: NOVA RESERVA OU ALTERAR RESERVA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-6 bg-white border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              {isEditing ? `Alterar Reserva - Chalé ${formChaleId}` : 'Nova Reserva Interna de Chalé'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              Preencha os dados do hóspede, datas, horários e valores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-slate-900">Selecione o Chalé (01 ao 12):</Label>
              <select
                value={formChaleId}
                onChange={(e) => setFormChaleId(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
              >
                {CHALE_UNITS.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.type === 'alvenaria' ? 'Alvenaria' : 'Vidro Panorâmico'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-black text-slate-900">Nome do Hóspede:</Label>
                <Input
                  placeholder="Nome completo"
                  value={formGuestName}
                  onChange={(e) => setFormGuestName(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-black text-slate-900">WhatsApp / Telefone:</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Data de Entrada:</Label>
                <Input
                  type="date"
                  value={formCheckInDate}
                  onChange={(e) => setFormCheckInDate(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Horário Entrada:</Label>
                <Input
                  type="time"
                  value={formCheckInTime}
                  onChange={(e) => setFormCheckInTime(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Data de Saída:</Label>
                <Input
                  type="date"
                  value={formCheckOutDate}
                  onChange={(e) => setFormCheckOutDate(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Horário Saída:</Label>
                <Input
                  type="time"
                  value={formCheckOutTime}
                  onChange={(e) => setFormCheckOutTime(e.target.value)}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Ocupação:</Label>
                <select
                  value={formOccupancyType}
                  onChange={(e) => setFormOccupancyType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                >
                  <option value="casal">Casal (2 Adultos)</option>
                  <option value="individual">Individual (1 Adulto)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Pacote Comercial:</Label>
                <select
                  value={formPackageType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormPackageType(val);
                    const isC = formOccupancyType === 'casal';
                    if (val === 'combo_2n') setFormPrice(isC ? 729 : 639);
                    else if (val === 'combo_3n_qui') setFormPrice(isC ? 990 : 855);
                    else if (val === 'combo_3n_seg') setFormPrice(isC ? 972 : 837);
                    else if (val === 'combo_4n') setFormPrice(isC ? 1233 : 1053);
                    else if (val === 'diaria_sab_dom') setFormPrice(isC ? 420 : 370);
                    else if (val === 'diaria_sex_sab') setFormPrice(isC ? 390 : 340);
                    else if (val === 'diaria_qui_sex') setFormPrice(isC ? 290 : 240);
                    else if (val === 'diaria_dom_seg') setFormPrice(isC ? 270 : 220);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                >
                  <option value="combo_2n">Combo 2 Noites — Sex a Dom (R$ 729 / 639 - 10% OFF)</option>
                  <option value="combo_3n_qui">Combo 3 Noites — Qui a Dom (R$ 990 / 855 - 10% OFF)</option>
                  <option value="combo_3n_seg">Combo 3 Noites — Sex a Seg (R$ 972 / 837 - 10% OFF)</option>
                  <option value="combo_4n">Combo 4 Noites — Qui a Seg (R$ 1.233 / 1.053 - 10% OFF)</option>
                  <option value="diaria_sab_dom">Diária Sáb a Dom (R$ 420 / 370)</option>
                  <option value="diaria_sex_sab">Diária Sex a Sáb (R$ 390 / 340)</option>
                  <option value="diaria_qui_sex">Diária Qui a Sex (R$ 290 / 240)</option>
                  <option value="diaria_dom_seg">Diária Dom a Seg (R$ 270 / 220)</option>
                  <option value="custom">Valor Personalizado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Valor Total (R$):</Label>
                <Input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(Number(e.target.value))}
                  className="h-10 text-xs font-bold rounded-xl border-slate-300 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Pagamento:</Label>
                <select
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                >
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cortesia">Cortesia</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black text-slate-900">Status:</Label>
                <select
                  value={formPaymentStatus}
                  onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-slate-50 font-bold text-xs text-slate-900"
                >
                  <option value="paid">PAGO OK</option>
                  <option value="pending">Aguardando Pagamento</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-slate-900">Notas / Observações Internas:</Label>
              <Textarea
                placeholder="Ex: Reserva balcão, solicitou berço, com desconto..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="text-xs font-medium rounded-xl border-slate-300 min-h-[70px] text-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveBooking}
              className="rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider"
            >
              {isEditing ? 'Salvar Alterações' : 'Confirmar Reserva'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">WhatsApp:</span>
                    <span className="font-bold text-white">{voucherRes.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Check-in (Entrada):</span>
                    <span className="font-black text-white">{voucherRes.checkInDate} às {voucherRes.checkInTime}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Check-out (Saída):</span>
                    <span className="font-black text-amber-300">{voucherRes.checkOutDate} às {voucherRes.checkOutTime}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Pacote:</span>
                    <span className="font-black text-amber-400">{voucherRes.packageTitle}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-emerald-200 font-bold uppercase text-[10px]">Café da Manhã & Day Use:</span>
                    <span className="font-black text-emerald-300">Inclusos ✓</span>
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
      <AddItemsToBookingDialog
        booking={addItemsBooking}
        isOpen={isAddItemsOpen}
        setIsOpen={setIsAddItemsOpen}
        onAdded={() => {
          if (onRefresh) onRefresh();
        }}
      />

    </div>
  );
}
