import { MessageCircle, CheckCircle, Loader2, ArrowRight, User, CreditCard, QrCode, Copy, Sparkles, Phone, X, ArrowLeft, Calendar, FileText, ShieldCheck } from 'lucide-react';
import { isValidCPF } from '@/utils/cpf-validator';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { saveBooking } from '@/lib/booking-service';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { PaymentModal } from './PaymentModal';
import { ChaleTermsModal, buildChaleTermsAcceptanceRecord, CHALE_TERMS_VERSION } from './ChaleTermsModal';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPersonPrice, formatCurrency, KIOSK_INFO, QUAD_LABELS, getQuadDiscount, ADDITIONAL_INFO, CHALE_PACKAGES, CAMPING_PRICE_PER_PERSON, WHATSAPP_NUMBER, isSundayOrHoliday, calculateChaleTotal, calculateChaleGrossTotal, calculateStayPricing, type BookingState, type AdultInfo, type ChildInfo } from '@/lib/booking-types';
import { useState, useEffect, useMemo } from 'react';
import { trackFBEvent } from '@/utils/pixel-events';

interface Props {
  booking: BookingState;
  totals: {
    entriesTotal: number;
    kiosksTotal: number;
    quadsTotal: number;
    additionalsTotal: number;
    chaleTotal?: number;
    campingTotal?: number;
    subtotal?: number;
    onlineDiscount?: number;
    total: number;
  };
  updateEntry?: (updates: Partial<BookingState['entry']>) => void;
  orderId: string | null;
  setOrderId: (id: string | null) => void;
  confirmationCode: string | null;
  setConfirmationCode: (code: string | null) => void;
  onRemoveAdult?: (index: number) => void;
  onRemoveChild?: (index: number) => void;
  onUpdateKiosk?: (index: number, updates: any) => void;
  onUpdateQuad?: (index: number, updates: any) => void;
  onUpdateAdditional?: (index: number, updates: any) => void;
  onUpdateChale?: (updates: any) => void;
  onUpdateCamping?: (updates: any) => void;
  onPrevStep?: () => void;
}

export function BookingOverview({ 
  booking, 
  totals, 
  updateEntry,
  orderId: persistedOrderId,
  setOrderId: setPersistedOrderId,
  confirmationCode: persistedConfirmationCode,
  setConfirmationCode: setPersistedConfirmationCode,
  onRemoveAdult,
  onRemoveChild,
  onUpdateKiosk,
  onUpdateQuad,
  onUpdateAdditional,
  onUpdateChale,
  onUpdateCamping,
  onPrevStep
}: Props) {
  const [saving, setSaving] = useState(false);
  const [paymentData, setPaymentData] = useState<{ open: boolean; orderId: string; confirmationCode?: string } | null>(null);
  const [activePaymentMethod, setActivePaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | null>(null);
  const [showCardInstallmentModal, setShowCardInstallmentModal] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [chaleTermsAccepted, setChaleTermsAccepted] = useState(false);
  const [chaleTermsAcceptedAt, setChaleTermsAcceptedAt] = useState<Date | null>(null);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [termsErrorHighlight, setTermsErrorHighlight] = useState(false);
  const { getPrice } = useServices();
  const { toast } = useToast();

  const hasSelectedChaleBooking = Boolean(
    booking.chale &&
    booking.chale.packageType &&
    ((booking.chale.chaleIds && booking.chale.chaleIds.length > 0) || booking.chale.chaleId)
  );

  const isChaleTermsAccepted = Boolean(booking.chale?.termsAccepted || chaleTermsAccepted);

  const chaleAcceptedAtDate = useMemo(() => {
    if (booking.chale?.termsAcceptedAt) {
      const d = new Date(booking.chale.termsAcceptedAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (chaleTermsAcceptedAt) return chaleTermsAcceptedAt;
    return null;
  }, [booking.chale?.termsAcceptedAt, chaleTermsAcceptedAt]);

  const formattedTermsAcceptedAt = useMemo(() => {
    if (!chaleAcceptedAtDate) return '';
    return chaleAcceptedAtDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [chaleAcceptedAtDate]);

  useEffect(() => {
    if (!persistedOrderId || paymentConfirmed) return;
 
    const channel = supabase
       .channel(`order-overview-${persistedOrderId}`)
       .on(
         'postgres_changes',
         { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${persistedOrderId}` },
         (payload) => {
            if (payload.new.status === 'paid' || payload.new.status === 'confirmed') {
              setPersistedConfirmationCode(payload.new.confirmation_code);
              setPaymentConfirmed(true);
              
              trackFBEvent('Purchase', { 
                value: totals.total, 
                currency: 'BRL', 
                content_name: 'Reserva Balneário Lessa',
                content_ids: [persistedOrderId]
              });

              toast({ title: 'Pagamento Confirmado!', description: 'Sua reserva está garantida!' });
            }
         }
       )
       .subscribe();
 
    return () => { supabase.removeChannel(channel); };
  }, [persistedOrderId, paymentConfirmed, toast, setPersistedConfirmationCode]);

  function calculateMembershipCost(people: { adultsCount: number; halfPriceCount: number }): number {
    const memberHalf = getPrice('entry_half', 25.0);
    const memberFull = getPrice('entry_full', 49.9);
    return (people.adultsCount * memberFull) + (people.halfPriceCount * memberHalf);
  }

  const hasAnything = totals.total > 0 || booking.entry.adults.length > 0 || booking.entry.children.length > 0;

  const handleCopyPix = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'PIX Copiado!',
      description: 'Código PIX Copia e Cola copiado.',
    });
  };

  const handleAction = async (method: 'PIX' | 'CREDIT_CARD' | 'LOCAL', installmentsCount: number = 1) => {
    const fullName = booking.entry.name?.trim();

    if (!fullName || !booking.entry.phone?.trim() || booking.entry.phone.length < 10) {
      toast({
        title: 'Dados Incompletos',
        description: 'Preencha o campo de Nome e WhatsApp.',
        variant: 'destructive'
      });
      return;
    }

    // Tracker: Lead
    trackFBEvent('Lead', { 
      content_name: 'Reserva Balneário Lessa', 
      value: totals.total, 
      currency: 'BRL' 
    });

    if (!booking.entry.cpf || !isValidCPF(booking.entry.cpf)) {
       toast({
         title: !booking.entry.cpf ? 'CPF Obrigatório' : 'CPF INVÁLIDO',
         description: 'Um CPF válido é necessário para sua reserva (inclusive pagamento no local).',
         variant: 'destructive'
       });
       return;
    }

    if (!booking.entry.visitDate) {
      toast({
        title: 'Selecione uma data',
        description: 'Escolha a data da sua visita no calendário na Etapa 1.',
        variant: 'destructive'
      });
      return;
    }

    const hasSelectedChale = (booking.chale?.chaleIds && booking.chale.chaleIds.length > 0) || !!booking.chale?.chaleId;
    const isTermsSigned = isChaleTermsAccepted;
    if (booking.chale && booking.chale.packageType && hasSelectedChale && !isTermsSigned) {
      setTermsErrorHighlight(true);
      toast({
        title: 'Aceite dos Termos Obrigatório',
        description: 'Para prosseguir com o pagamento da hospedagem, marque a caixa de aceite dos Termos e Condições de Hospedagem.',
        variant: 'destructive'
      });
      setTimeout(() => {
        const el = document.getElementById('chale-terms-box');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    const items: any[] = [];
    const isSunday = booking.entry.dayOfWeek === 'domingo' || isSundayOrHoliday(booking.entry.visitDate);
    
    booking.entry.adults.forEach(a => {
      const price = getPersonPrice(a, a.age >= 60, isSunday, getPrice);
      const label = a.isPCD ? 'Lessa Inclusão' : 
                   a.isMember ? 'Associado Lessa Club' :
                   a.isCounterPayment ? 'Entrada no Balcão' :
                   a.age >= 60 ? 'Lessa Vitalício' : 
                   a.isTeacher ? 'Lessa Professor Pass' :
                   a.isStudent ? 'Lessa Estudante Pass' :
                   a.isServer ? 'Lessa Servidor Pass' :
                   (a as any).isBloodDonor ? 'Lessa Doador Pass' :
                   a.isBirthday ? 'Aniversariante' :
                   'Adulto';
      items.push({ product_id: label, quantity: a.quantity || 1, unit_price: price });
    });

    booking.entry.children.forEach(c => {
      const price = getPersonPrice(c, c.age <= 11, isSunday, getPrice);
      const label = c.isPCD ? 'Lessa Kids PCD' : 'Lessa Kids';
      items.push({ product_id: label, quantity: c.quantity || 1, unit_price: price });
    });

    booking.kiosks.filter(k => k.quantity > 0).forEach(k => {
      const kioskLabel = k.selectedIds && k.selectedIds.length > 0
        ? `Quiosque ${k.selectedIds.sort((a,b)=>a-b).map(id => String(id).padStart(2,'0')).join(', ')}`
        : KIOSK_INFO[k.type].label;
      items.push({ 
        product_id: kioskLabel, 
        quantity: k.quantity, 
        unit_price: getPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price),
        metadata: { selectedIds: k.selectedIds || [] }
      });
    });

    booking.quads.filter(q => q.quantity > 0).forEach(q => {
      const fallbackMap: Record<string, number> = { individual: 130, dupla: 195, 'adulto-crianca': 195 };
      const basePrice = getPrice(`quad_${q.type}`, fallbackMap[q.type]);
      items.push({ 
        product_id: `Quad ${QUAD_LABELS[q.type]}`, 
        quantity: q.quantity, 
        unit_price: basePrice,
        metadata: { time: q.time } 
      });
    });

    booking.additionals.filter(a => a.quantity > 0).forEach(a => {
      items.push({ 
        product_id: ADDITIONAL_INFO[a.type].label, 
        quantity: a.quantity, 
        unit_price: getPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price) 
      });
    });

    let termsAcceptanceSnapshot: any = null;
    if (booking.chale && booking.chale.packageType && hasSelectedChale) {
      const pkg = CHALE_PACKAGES[booking.chale.packageType];
      if (pkg) {
        const chaletsCount = (booking.chale.chaleIds && booking.chale.chaleIds.length > 0)
          ? booking.chale.chaleIds.length
          : 1;
        const adults = Math.max(1, booking.chale.adultsCount || (chaletsCount * 2));
        const kids = booking.chale.childrenCount || 0;
        const chaleGross = calculateChaleGrossTotal(
          booking.chale.packageType,
          booking.chale.adultsCount,
          booking.chale.childrenCount,
          chaletsCount,
          booking.chale.checkInDate,
          booking.chale.checkOutDate,
          booking.chale.chaleOccupancies,
          booking.chale.chaleIds,
          booking.chale.childrenAges
        );
        const chalePrice = calculateChaleTotal(
          booking.chale.packageType,
          adults,
          kids,
          getPrice,
          booking.chale.includeSundayDayUse,
          chaletsCount,
          booking.chale.checkInDate,
          booking.chale.checkOutDate,
          booking.chale.chaleOccupancies,
          booking.chale.chaleIds,
          booking.chale.childrenAges
        );
        const chaleSiteNet = chaleGross > chalePrice
          ? chalePrice
          : Math.round(chaleGross * 0.90 * 100) / 100;
        termsAcceptanceSnapshot = buildChaleTermsAcceptanceRecord({
          guestName: fullName,
          guestCpf: booking.entry.cpf,
          guestPhone: booking.entry.phone,
          acceptedAt: chaleAcceptedAtDate || new Date(),
        });
        items.push({
          product_id: chaletsCount > 1 ? `Chalés (${chaletsCount} unidades): ${pkg.title}` : `Chalé: ${pkg.title}`,
          quantity: 1,
          unit_price: chaleSiteNet,
          metadata: {
            package_type: pkg.id,
            package_title: pkg.title,
            chale_id: booking.chale.chaleId || null,
            chale_ids: booking.chale.chaleIds || (booking.chale.chaleId ? [booking.chale.chaleId] : []),
            chalets_count: chaletsCount,
            chale_occupancies: booking.chale.chaleOccupancies || {},
            chale_kids: booking.chale.chaleKids || {},
            adults: adults,
            children: kids,
            children_ages: booking.chale.childrenAges || [],
            guest_names: booking.chale.guestNames || {},
            check_in_date: booking.chale.checkInDate ? format(booking.chale.checkInDate, 'yyyy-MM-dd') : (booking.date ? format(booking.date, 'yyyy-MM-dd') : null),
            check_in_time: '15:00',
            check_out_date: booking.chale.checkOutDate ? format(booking.chale.checkOutDate, 'yyyy-MM-dd') : null,
            check_out_time: '12:00',
            chale_gross_price: chaleGross,
            chale_net_price: chaleSiteNet,
            include_sunday_day_use: !!booking.chale.includeSundayDayUse,
            terms_acceptance: termsAcceptanceSnapshot
          }
        });
      }
    }

    if (booking.camping && (booking.camping.peopleCount > 0 || (booking.camping.adultsCount || 0) > 0)) {
      const payingAdults = booking.camping.adultsCount !== undefined ? booking.camping.adultsCount : booking.camping.peopleCount;
      const campingPrice = getPrice('camping_per_person', CAMPING_PRICE_PER_PERSON);
      items.push({
        product_id: 'Área de Camping',
        quantity: payingAdults,
        unit_price: campingPrice,
        metadata: {
          total_people: booking.camping.peopleCount,
          adults: payingAdults,
          children: booking.camping.childrenCount || 0,
          seniors: booking.camping.seniorsCount || 0
        }
      });
    }
    
    let orderIdToRollback: string | null = null;
    setSaving(true);
    try {
      let orderId = persistedOrderId;
      let confCode = persistedConfirmationCode;

      // Se não temos ordem ou os itens/valor mudaram drasticamente, o back-end cuida de atualizar se passarmos o ID
      let methodStatus = method !== 'LOCAL' ? 'awaiting_payment' : 'pending';
      if (totals.total === 0) methodStatus = 'confirmed';

      const result = await saveBooking({
        ...booking,
        entry: { ...booking.entry, name: fullName }
      }, totals.total, null, items, methodStatus, orderId);
      
      if (!result?.orderId) throw new Error("Erro ao salvar pedido.");
      orderId = result.orderId;
      orderIdToRollback = orderId;
      confCode = result.confirmationCode;
      
      setPersistedOrderId(orderId);
      setPersistedConfirmationCode(confCode);

      if (termsAcceptanceSnapshot) {
        const enrichedAcceptance = {
          ...termsAcceptanceSnapshot,
          orderId,
          reservationCode: confCode || '',
        };
        try {
          if (confCode) localStorage.setItem(`lessa_terms_acceptance_${confCode}`, JSON.stringify(enrichedAcceptance));
          if (orderId) localStorage.setItem(`lessa_terms_acceptance_${orderId}`, JSON.stringify(enrichedAcceptance));
        } catch (e) {}
      }

      if (totals.total === 0) {
         setPaymentConfirmed(true);
         toast({ title: 'Reserva Confirmada', description: 'Sua reserva gratuita foi concluída com sucesso!' });
         return;
      }

      if (method === 'PIX') {
        setPaymentData(null);
        
        trackFBEvent('InitiateCheckout', { 
          value: totals.total, 
          currency: 'BRL', 
          content_name: 'Reserva Balneário Lessa',
          payment_method: 'PIX'
        });

        const response = await supabase.functions.invoke('create-payment', {
          body: {
            orderId,
            name: fullName,
            email: booking.entry.email || '',
            phone: booking.entry.phone,
            cpf: booking.entry.cpf,
            billingType: 'PIX',
            value: totals.total,
            description: `Reserva Balneário Lessa - ${fullName}`,
          }
        });

        if (response.error || response.data?.error) {
          throw new Error(response.error?.message || response.data?.error || 'Erro ao gerar PIX');
        }

        const data = response.data.data;
        if (!data?.pix) throw new Error("A resposta do servidor não contém dados de PIX.");

        setPixData(data.pix);
        setActivePaymentMethod('PIX');
        toast({ title: 'PIX Gerado com Sucesso!', description: 'Finalize o pagamento abaixo.' });
      } else if (method === 'CREDIT_CARD') {
        trackFBEvent('InitiateCheckout', { 
          value: totals.total, 
          currency: 'BRL', 
          content_name: 'Reserva Balneário Lessa',
          payment_method: 'CreditCard'
        });

        const response = await supabase.functions.invoke('create-payment', {
          body: {
            orderId,
            name: fullName,
            email: booking.entry.email || '',
            phone: booking.entry.phone,
            cpf: booking.entry.cpf,
            billingType: 'CREDIT_CARD',
            value: totals.total,
            description: `Reserva Balneário Lessa - ${fullName}`,
          }
        });

        if (response.error || response.data?.error) {
          throw new Error(response.error?.message || response.data?.error || 'Erro ao preparar Cartão');
        }

        const data = response.data.data;
        if (data?.invoiceUrl) {
           toast({ title: 'Redirecionando...', description: 'Aguarde um momento para o pagamento seguro.' });
           setTimeout(() => {
              window.location.href = data.invoiceUrl;
           }, 500);
        } else {
           throw new Error("URL do checkout não encontrada.");
        }
      } else {
        await (supabase as any).from('orders').update({ 
          status: 'waiting_local',
          updated_at: new Date().toISOString()
        }).eq('id', orderId);
        
        const msg = buildWhatsAppMessage(booking, totals.total, false, confCode || undefined, getPrice, totals.subtotal, totals.onlineDiscount);
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        toast({ title: 'Enviado ao WhatsApp', description: 'Finalize o pagamento no local.' });
      }
    } catch (err: any) {
      console.error("[Booking] Error:", err);
      // Rollback: se o pedido foi criado mas o pagamento falhou, deletamos o pedido para evitar dados sujos
      // IMPORTANTE: apenas deletamos se for pagamento online (PIX/CARTAO) que falhou agora
      if (orderIdToRollback && method !== 'LOCAL') {
        console.log("[Booking] Rolling back order:", orderIdToRollback);
        await supabase.from('orders').delete().eq('id', orderIdToRollback);
        setPersistedOrderId(null);
        setPersistedConfirmationCode(null);
      }
      toast({ title: 'Falha no Agendamento', description: err.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  const handlePaymentSuccess = (method: string) => {
    console.log("[Booking] handlePaymentSuccess. Method:", method);
    if (method === 'local' || method === 'manual') {
      const msg = buildWhatsAppMessage(booking, totals.total, false, paymentData?.confirmationCode, getPrice, totals.subtotal, totals.onlineDiscount);
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      // For virtual payments, just show success. 
      // Do NOT open WhatsApp automatically anymore to satisfy "Pagamento Virtual" goal.
      toast({
        title: 'Sucesso!',
        description: 'Seu pagamento foi reconhecido. Acompanhe seu e-mail para o voucher.',
      });
      setPaymentData(null);
    }
  };

  const isSundayOrHolidayVisit = booking.entry.dayOfWeek === 'domingo' || isSundayOrHoliday(booking.entry.visitDate);

  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center justify-center p-10 mt-10 text-center space-y-4 bg-white/30 backdrop-blur-md rounded-2xl border border-white/60">
        <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center text-2xl shadow-sm">🛒</div>
        <p className="text-muted-foreground font-medium">Você ainda não selecionou nenhum item.<br />Comece escolhendo o que deseja!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="bg-emerald-50/40 rounded-3xl border-2 border-emerald-200/80 p-4 sm:p-6 shadow-sm space-y-5">

        {/* Entradas */}
        {/* Data selecionada */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 text-white rounded-2xl border-2 border-amber-400/80 p-3.5 sm:p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 block">Data da Reserva</span>
              <span className="font-sans font-black text-xs sm:text-sm text-white">
                {booking.entry.visitDate ? format(booking.entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }) : 'Não selecionada'}
              </span>
            </div>
          </div>
          <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 shadow-sm">
            Confirmada
          </Badge>
        </div>

        {/* Entradas */}
        {(booking.entry.adults.length > 0 || booking.entry.children.length > 0) && (
          <div className="pb-5 border-b border-primary/10">
            <h4 className="font-bold text-primary mb-3 uppercase tracking-widest text-[10px] sm:text-xs">Day Use (Entradas)</h4>
            <div className="space-y-3 text-sm sm:text-base text-muted-foreground">
              {/* Gratuidades e Balcão Primeiro */}
              {[...booking.entry.adults, ...booking.entry.children].filter(p => getPersonPrice(p, (p as any).age >= 60 || (p as any).age <= 11, isSundayOrHolidayVisit, getPrice) === 0).map((p, i) => {
                const qty = p.quantity || 1;
                const isBalcao = !!(p as any).isCounterPayment;

                let label = (p as any).age >= 60 ? 'Lessa Vitalício (Idoso)' : (p as any).age <= 11 ? 'Lessa Kids (Criança)' : 'Acesso';
                let sublabel = 'Acesso Gratuito';

                if (isBalcao) {
                  label = qty > 1 ? 'Entradas no Balcão' : 'Entrada no Balcão';
                  sublabel = 'Pagamento presencial no balcão (sem desconto — valor normal na bilheteria)';
                } else if (p.isPCD) {
                  label = 'Lessa Inclusão (PCD/TEA)';
                } else if (p.isBirthday) {
                  label = 'Aniversariante do Dia';
                } else if (p.isMember) {
                  label = 'Assinante Lessa Club 👑';
                  sublabel = 'Sócio Lessa Club Premium';
                }

                const itemBg = isBalcao 
                  ? 'text-amber-950 font-bold bg-amber-50/70 border-amber-200' 
                  : 'text-emerald-700 font-bold bg-emerald-50/50 border-emerald-100/50';

                const badgeClass = isBalcao
                  ? 'bg-amber-100 text-amber-950 border border-amber-300 font-black'
                  : 'bg-emerald-100 text-emerald-800 font-bold';

                const badgeText = isBalcao ? 'Balcão' : 'Grátis';

                return (
                  <div key={`free-${i}`} className={`relative flex justify-between items-start p-2.5 rounded-xl border group/item ${itemBg}`}>
                    <div>
                      <span className="text-sm">{qty}x {label}</span>
                      <span className="block text-[10px] uppercase tracking-wider opacity-75">{sublabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`whitespace-nowrap uppercase text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>{badgeText}</span>
                       {onRemoveAdult && !((p as any).age <= 11) && (
                         <button onClick={() => i < booking.entry.adults.length ? onRemoveAdult(i) : null} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                           <X className="h-3 w-3" />
                         </button>
                       )}
                       {onRemoveChild && (p as any).age <= 11 && (
                         <button onClick={() => onRemoveChild(i - booking.entry.adults.length)} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                           <X className="h-3 w-3" />
                         </button>
                       )}
                    </div>
                  </div>
                );
              })}

              {/* Alerta destacado para pagamento no balcão */}
              {booking.entry.adults.some((a: any) => a.isCounterPayment) && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-xs text-amber-950 font-bold flex items-start gap-2 shadow-sm">
                  <span className="text-base shrink-0 mt-0.5">⚠️</span>
                  <div className="space-y-0.5">
                    <p className="font-black text-amber-900 uppercase tracking-tight text-[11px]">Aviso sobre entradas no balcão:</p>
                    <p className="leading-relaxed">
                      Não há desconto na entrada se preferir pagar no balcão (será cobrado o <strong>valor normal de R$ 50,00 cada</strong>). O desconto de 10% da reserva online aplica-se apenas aos itens pagos agora pelo site.
                    </p>
                  </div>
                </div>
              )}

              {/* Pagantes */}
              {booking.entry.adults.filter(a => getPersonPrice(a, a.age >= 60, isSundayOrHolidayVisit, getPrice) > 0).map((a, i) => {
                const qty = a.quantity || 1;
                const price = getPersonPrice(a, a.age >= 60, isSundayOrHolidayVisit, getPrice);
                
                let label = 'Adulto Inteira';
                if (a.isTeacher) label = 'Lessa Professor Pass';
                else if (a.isServer) label = 'Lessa Servidor Pass';
                else if (a.isStudent) label = 'Lessa Estudante Pass';
                else if (a.takeDonation) label = 'Adulto Solidário';
                else if ((a as any).isBloodDonor) label = 'Lessa Doador Pass';
                
                return (
                  <div key={`adult-pay-${i}`} className="flex justify-between items-center py-1 group/item min-h-[32px]">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-black text-foreground uppercase tracking-tight truncate">{qty}x {label}</span>
                      {a.takeDonation && <span className="text-[8px] text-primary/60 font-black italic uppercase leading-none mt-0.5">Levar 1kg alimento</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs sm:text-sm whitespace-nowrap text-primary">{formatCurrency(price * qty)}</span>
                      {onRemoveAdult && (
                        <button onClick={() => onRemoveAdult(i)} className="p-1 hover:bg-primary/10 rounded-full transition-colors text-primary/40">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {booking.entry.children.filter(c => getPersonPrice(c, c.age <= 11, isSundayOrHolidayVisit, getPrice) > 0).map((c, i) => {
                const qty = c.quantity || 1;
                const price = getPersonPrice(c, c.age <= 11, isSundayOrHolidayVisit, getPrice);
                return (
                  <div key={`child-pay-${i}`} className="flex justify-between items-center py-1 group/item min-h-[32px]">
                    <span className="text-xs font-black text-foreground uppercase tracking-tight truncate flex-1 min-w-0">{qty}x Lessa Kids (6 a 11 anos)</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs sm:text-sm whitespace-nowrap text-primary">{formatCurrency(price * qty)}</span>
                      {onRemoveChild && (
                        <button onClick={() => onRemoveChild(i)} className="p-1 hover:bg-primary/10 rounded-full transition-colors text-primary/40">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                <span>Subtotal Entradas</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(totals.entriesTotal)}</span>
                  <span className="text-emerald-900 font-black">{formatCurrency(Math.round(totals.entriesTotal * 0.90 * 100) / 100)}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Quiosques */}
        {booking.kiosks.some(k => k.quantity > 0) && (
          <div className="pb-5 border-b border-emerald-200">
            <h4 className="font-black text-emerald-950 mb-3 uppercase tracking-widest text-[11px] sm:text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Quiosques
            </h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.kiosks.filter(k => k.quantity > 0).map(k => {
                const basePrice = getPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price);
                const kioskNames = k.selectedIds && k.selectedIds.length > 0
                  ? k.selectedIds.sort((a,b)=>a-b).map(id => `Quiosque ${String(id).padStart(2,'0')}`).join(' · ')
                  : `${k.quantity}x ${KIOSK_INFO[k.type].label}`;
                return (
                <div key={k.type} className="flex justify-between group/item items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-black text-emerald-950 truncate block">{kioskNames}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="whitespace-nowrap text-xs sm:text-sm font-black text-emerald-900">{formatCurrency(k.quantity * basePrice)}</span>
                    {onUpdateKiosk && (
                      <button onClick={() => {
                        const idx = booking.kiosks.findIndex(x => x.type === k.type);
                        onUpdateKiosk(idx, { quantity: 0, selectedIds: [] });
                      }} className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-slate-400 hover:text-emerald-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )})}
              <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                <span>Subtotal Quiosques</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(totals.kiosksTotal)}</span>
                  <span className="text-emerald-900 font-black">{formatCurrency(Math.round(totals.kiosksTotal * 0.90 * 100) / 100)}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quadriciclos */}
        {booking.quads.some(q => q.quantity > 0) && (
          <div className="pb-5 border-b border-emerald-200">
            <h4 className="font-black text-emerald-950 mb-3 uppercase tracking-widest text-[11px] sm:text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Passeios de Quadriciclo (40 min)
            </h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.quads.filter(q => q.quantity > 0).map((q, idx) => {
                const fallbackMap: Record<string, number> = { individual: 130, dupla: 195, 'adulto-crianca': 195 };
                const basePrice = getPrice(`quad_${q.type}`, fallbackMap[q.type]);
                const totalPrice = q.quantity * basePrice;
                const quadIdx = booking.quads.findIndex(x => x === q || (x.type === q.type && x.time === q.time));

                return (
                  <div key={`overview-quad-${q.type}-${q.time || 'notime'}-${idx}`} className="flex justify-between group/item items-center gap-2 bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-black truncate block text-emerald-950">
                        🏍️ {q.quantity}x {QUAD_LABELS[q.type]}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-600 font-bold">
                        {q.time && (
                          <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                            ⏰ Horário: {q.time}
                          </span>
                        )}
                        
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="whitespace-nowrap text-xs sm:text-sm font-black text-emerald-900">
                        {formatCurrency(totalPrice)}
                      </span>
                      {onUpdateQuad && (
                        <button
                          onClick={() => onUpdateQuad(quadIdx, { quantity: 0, time: null })}
                          className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-slate-400 hover:text-emerald-900"
                          title="Remover quadriciclo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                <span>Subtotal Quadriciclos</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(totals.quadsTotal)}</span>
                  <span className="text-emerald-900 font-black">{formatCurrency(Math.round(totals.quadsTotal * 0.90 * 100) / 100)}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chalé */}
        {booking.chale && booking.chale.packageType && ((booking.chale.chaleIds && booking.chale.chaleIds.length > 0) || booking.chale.chaleId) && (() => {
          const pkg = CHALE_PACKAGES[booking.chale.packageType];
          if (!pkg) return null;
          const activeIds = (booking.chale.chaleIds && booking.chale.chaleIds.length > 0)
            ? booking.chale.chaleIds
            : (booking.chale.chaleId ? [booking.chale.chaleId] : []);
          const chaletsCount = activeIds.length;
          if (chaletsCount === 0) return null;

          const adults = Math.max(1, booking.chale.adultsCount || (chaletsCount * 2));
          const kids = booking.chale.childrenCount || 0;
          const stayPricingOverview = calculateStayPricing(
            booking.chale.checkInDate,
            booking.chale.checkOutDate
          );
          const ovNights = Math.max(1, stayPricingOverview.nightsCount);
          const isOvCombo = ovNights >= 2;

          const chalePrice = calculateChaleTotal(
            booking.chale.packageType,
            adults,
            kids,
            getPrice,
            booking.chale.includeSundayDayUse,
            chaletsCount,
            booking.chale.checkInDate,
            booking.chale.checkOutDate,
            booking.chale.chaleOccupancies,
            activeIds,
            booking.chale.childrenAges
          );

          const chaleGrossPrice = calculateChaleGrossTotal(
            booking.chale.packageType,
            adults,
            kids,
            chaletsCount,
            booking.chale.checkInDate,
            booking.chale.checkOutDate,
            booking.chale.chaleOccupancies,
            activeIds,
            booking.chale.childrenAges
          );

          const chaleSiteNet = chaleGrossPrice > chalePrice
            ? chalePrice
            : Math.round(chaleGrossPrice * 0.90 * 100) / 100;

          return (
            <div className="pb-5 border-b border-emerald-200">
              <h4 className="font-black text-emerald-950 mb-3 uppercase tracking-widest text-[11px] sm:text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Hospedagem ({chaletsCount > 1 ? `${chaletsCount} Chalés` : 'Chalé'})
              </h4>
              <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <div className="flex justify-between items-start group/item gap-2 bg-white p-3.5 rounded-2xl border-2 border-emerald-200 shadow-xs">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <span className="text-xs sm:text-sm font-black block text-emerald-950">
                        🏡 {pkg.title} {chaletsCount > 1 ? `(${chaletsCount} unidades)` : ''}
                      </span>
                      {booking.chale.checkInDate && booking.chale.checkOutDate && (
                        <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                          📅 {format(new Date(booking.chale.checkInDate), "dd/MM (EEE)", { locale: ptBR })} às {stayPricingOverview.checkInHour} ➔ {format(new Date(booking.chale.checkOutDate), "dd/MM (EEE)", { locale: ptBR })} às 12h ({ovNights} noite{ovNights > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>

                    {/* Detalhamento claro por chalé: Modalidade + Valor da Tabela + Adicionais */}
                    <div className="space-y-2 pt-1 border-t border-emerald-100">
                      {activeIds.map((id, uIdx) => {
                        const isCasal = (booking.chale.chaleOccupancies?.[id] || 'casal') !== 'individual';
                        const ages = booking.chale.childrenAges || [];
                        const rawKids = booking.chale.chaleKids && booking.chale.chaleKids[id];
                        const kidsForThis: string[] = Array.isArray(rawKids)
                          ? rawKids
                          : (Array.isArray(ages) ? ages.slice(uIdx * 2, (uIdx + 1) * 2) : []);

                        const adultGross = isCasal ? stayPricingOverview.totalCasalGross : stayPricingOverview.totalIndividualGross;
                        const adultNet = isCasal ? stayPricingOverview.totalCasal : stayPricingOverview.totalIndividual;

                        return (
                          <div key={`overview-chale-${id}`} className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 text-xs space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1 font-black text-emerald-950">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                Chalé {String(id).padStart(2, '0')} · Modalidade {isCasal ? 'Casal (2 Adultos)' : 'Individual (1 Adulto)'}
                              </span>
                              <span className="text-[11px] font-black text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                                {isOvCombo ? (
                                  <>De <span className="line-through text-slate-400 mr-1">{formatCurrency(adultGross)}</span> por {formatCurrency(adultNet)}</>
                                ) : (
                                  formatCurrency(adultNet)
                                )}
                              </span>
                            </div>
                            {kidsForThis.length > 0 ? (
                              <div className="text-[11px] text-amber-950 font-bold pt-1 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-1">
                                <span>
                                  👶 <strong>Adicionais ({kidsForThis.length} Criança{kidsForThis.length > 1 ? 's' : ''}):</strong>{' '}
                                  {kidsForThis.map(a => a === '12plus' ? '12+ anos' : 'até 11 anos').join(', ')}
                                </span>
                                <span className="font-black text-amber-900">
                                  {kidsForThis.map((a, kIdx) => {
                                    const kGross = (a === '12plus' ? 100 : 50) * ovNights;
                                    const kNet = (a === '12plus' ? (isOvCombo ? 90 : 100) : (isOvCombo ? 45 : 50)) * ovNights;
                                    return (
                                      <span key={kIdx}>
                                        {kIdx > 0 ? ' + ' : '+ '}
                                        {isOvCombo ? (
                                          <>De <span className="line-through text-slate-400">{formatCurrency(kGross)}</span> por {formatCurrency(kNet)}</>
                                        ) : (
                                          formatCurrency(kNet)
                                        )}
                                      </span>
                                    );
                                  })}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10.5px] text-slate-500 font-medium">
                                Sem adicionais de crianças
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="whitespace-nowrap text-xs sm:text-sm font-black text-emerald-900">{formatCurrency(chalePrice)}</span>
                    {onUpdateChale && (
                      <button onClick={() => onUpdateChale({ packageType: null, chaleId: null, chaleIds: [], adultsCount: 0, childrenCount: 0, childrenAges: [], chaleKids: {} })} className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-slate-400 hover:text-emerald-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                  <span>Subtotal Hospedagem</span>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(chaleGrossPrice)}</span>
                    <span className="text-emerald-900 font-black">{formatCurrency(chaleSiteNet)}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Camping */}
        {booking.camping && (booking.camping.peopleCount > 0 || (booking.camping.adultsCount || 0) > 0) && (() => {
          const payingAdults = booking.camping.adultsCount !== undefined ? booking.camping.adultsCount : booking.camping.peopleCount;
          const campingPrice = getPrice('camping_per_person', CAMPING_PRICE_PER_PERSON);
          const totalCamping = payingAdults * campingPrice;

          return (
            <div className="pb-5 border-b border-emerald-200">
              <h4 className="font-black text-emerald-950 mb-3 uppercase tracking-widest text-[11px] sm:text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Camping
              </h4>
              <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
                <div className="flex justify-between items-center group/item gap-2 bg-white p-3 rounded-2xl border border-emerald-100 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-black truncate block text-emerald-950">
                      ⛺ {payingAdults}x Acesso Camping Adulto ({formatCurrency(campingPrice)} cada)
                    </span>
                    {(booking.camping.childrenCount || 0) > 0 && (
                      <span className="text-[11px] text-emerald-700 font-bold block">
                        + {booking.camping.childrenCount} criança(s) até 11 anos: Grátis
                      </span>
                    )}
                    {(booking.camping.seniorsCount || 0) > 0 && (
                      <span className="text-[11px] text-emerald-700 font-bold block">
                        + {booking.camping.seniorsCount} idoso(s) 60+: Grátis
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                      ☀️ Day use do dia seguinte incluso · ☕ Café da manhã não incluso
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="whitespace-nowrap text-xs sm:text-sm font-black text-emerald-900">{formatCurrency(totalCamping)}</span>
                    {onUpdateCamping && (
                      <button onClick={() => onUpdateCamping({ peopleCount: 0, adultsCount: 0, childrenCount: 0, seniorsCount: 0 })} className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-slate-400 hover:text-emerald-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                  <span>Subtotal Camping</span>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(totalCamping)}</span>
                    <span className="text-emerald-900 font-black">{formatCurrency(Math.round(totalCamping * 0.90 * 100) / 100)}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Adicionais */}
        {booking.additionals.some(a => a.quantity > 0) && (
          <div className="pb-5 border-b border-emerald-200">
            <h4 className="font-black text-emerald-950 mb-3 uppercase tracking-widest text-[11px] sm:text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Diversão e Lazer
            </h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.additionals.filter(a => a.quantity > 0).map(a => {
                const basePrice = getPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price);
                return (
                <div key={a.type} className="flex justify-between items-center group/item gap-2 bg-white p-2.5 rounded-xl border border-emerald-100 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-black text-emerald-950 truncate block">{a.quantity}x {ADDITIONAL_INFO[a.type].label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="whitespace-nowrap text-xs sm:text-sm font-black text-emerald-900">{formatCurrency(a.quantity * basePrice)}</span>
                    {onUpdateAdditional && (
                      <button onClick={() => {
                        const idx = booking.additionals.findIndex(x => x.type === a.type);
                        onUpdateAdditional(idx, { quantity: 0 });
                      }} className="p-1 hover:bg-emerald-100 rounded-full transition-colors text-slate-400 hover:text-emerald-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )})}
              <div className="flex justify-between font-black text-emerald-950 pt-2.5 mt-2 border-t border-emerald-200 text-sm items-center">
                <span>Subtotal Diversão</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-xs text-slate-400 line-through font-bold">{formatCurrency(totals.additionalsTotal)}</span>
                  <span className="text-emerald-900 font-black">{formatCurrency(Math.round(totals.additionalsTotal * 0.90 * 100) / 100)}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300">10% OFF</span>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Total Bruto e Descontos */}
        {(() => {
            const fullPriceBase = 50;
            // Entradas pagas no balcão não têm desconto online e não entram no cálculo de economia estimada
            const onlineEntries = [...booking.entry.adults, ...booking.entry.children].filter(p => !(p as any).isCounterPayment);
            const totalFullPrice = onlineEntries.reduce((acc, p) => acc + ((p.quantity || 1) * fullPriceBase), 0);
            const entrySavings = Math.max(0, totalFullPrice - totals.entriesTotal);
            const subtotal = totals.subtotal ?? (totals.entriesTotal + totals.kiosksTotal + totals.quadsTotal + totals.additionalsTotal);
            const discount = totals.onlineDiscount ?? (subtotal > 0 ? Math.round(subtotal * 0.10 * 100) / 100 : 0);
            const totalSavings = entrySavings + discount;
            
            return (
              <div className="pt-2 space-y-2">
                <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white rounded-3xl p-5 sm:p-6 border-2 border-amber-400 shadow-xl space-y-3.5 mb-4">
                  {discount > 0 ? (
                    <div className="space-y-1.5 pb-3 border-b border-white/10 text-xs sm:text-sm">
                      <div className="flex justify-between items-center text-emerald-200/90 font-bold">
                        <span>Valor Total da Reserva (Subtotal)</span>
                        <span className="font-black text-white text-sm sm:text-base">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center text-amber-300 font-black">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                            10% OFF
                          </span>
                          Desconto Reserva Online
                        </span>
                        <span className="font-black text-amber-300">- {formatCurrency(discount)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pb-3 border-b border-white/10 text-xs sm:text-sm">
                      <div className="flex justify-between items-center text-emerald-200/90 font-bold">
                        <span>Valor Total da Reserva (Subtotal)</span>
                        <span className="font-black text-white text-sm sm:text-base">{formatCurrency(subtotal)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <div>
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-black text-amber-400">
                          Total: {formatCurrency(totals.total)}
                        </span>
                        {discount > 0 && (
                          <span className="text-sm text-emerald-200/60 line-through font-bold">
                            {formatCurrency(subtotal)}
                          </span>
                        )}
                      </div>
                      {totalSavings > 0 && (
                        <span className="block text-[10px] text-emerald-300 font-black uppercase tracking-wider mt-1">
                          ✨ VOCÊ ESTÁ ECONOMIZANDO {formatCurrency(totalSavings)} NESTA RESERVA!
                        </span>
                      )}
                    </div>
                    {discount > 0 && (
                      <span className="inline-flex self-start sm:self-center text-[10px] sm:text-xs font-black text-slate-950 bg-amber-400 border border-amber-500 px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                        Economia de {formatCurrency(discount)}
                      </span>
                    )}
                  </div>
                </div>

             </div>
           );
        })()}

        {/* Seção de Dados do Pagador */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-700" /> CPF do Responsável (para PIX / Reserva)
            </h4>
            {booking.entry.name && (
              <span className="text-[11px] font-bold text-slate-500">
                Titular: <strong className="text-emerald-950">{booking.entry.name}</strong>
              </span>
            )}
          </div>
          <div className="space-y-1">
            <Input
              value={booking.entry.cpf || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                updateEntry?.({ cpf: val });
              }}
              placeholder="000.000.000-00 (apenas números)"
              className="rounded-xl border-2 border-slate-200 hover:border-emerald-400 focus-visible:border-emerald-600 focus-visible:ring-emerald-600 h-11 font-bold text-slate-800 text-sm shadow-xs transition-all"
            />
          </div>
        </div>

          <div className="flex flex-col gap-4">
            {paymentConfirmed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2rem] p-8 space-y-6 shadow-2xl border-4 border-green-500 flex flex-col items-center"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                  <CheckCircle className="w-12 h-12" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-gliker text-primary">Reserva Garantida!</h3>
                  <p className="text-sm text-muted-foreground font-medium">Apresente o código abaixo na bilheteria</p>
                </div>

                <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-3xl p-8 w-full text-center space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest mb-1">CÓDIGO VOUCHER</p>
                    <p className="text-4xl font-mono font-black text-primary tracking-[0.2em]">{persistedConfirmationCode}</p>
                  </div>
                  
                  <div className="flex justify-center bg-white p-4 rounded-2xl border shadow-sm max-w-[180px] mx-auto">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${persistedConfirmationCode}`} 
                      alt="QR Code" 
                      className="w-32 h-32"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  {totals.total > 0 ? (
                    <Button 
                      onClick={() => {
                        const msg = `🌿 *BALNEÁRIO FAMÍLIA LESSA*\n\nOlá! Minha reserva no Balneário Lessa foi confirmada! ✅\n\n📋 *RESUMO DO PEDIDO*\n👤 *Titular:* ${booking.entry.name}\n📅 *Data:* ${booking.entry.visitDate ? format(new Date(booking.entry.visitDate), "dd/MM/yyyy") : '—'}\n🔢 *Voucher:* ${persistedConfirmationCode}\n\n🔗 *VOUCHER DIGITAL:*\nhttps://reservas.balneariolessa.com.br/voucher/${persistedConfirmationCode}\n\n📍 *COMO CHEGAR:*\nVia Araras, Setor 09 – Ariquemes/RO`;
                        const phone = booking.entry.phone?.replace(/\D/g, '') || '';
                        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-black shadow-lg flex items-center justify-center gap-3 animate-pulse border-b-4 border-[#075E54]"
                    >
                       <Phone className="w-6 h-6 fill-current" /> RECEBER NO WHATSAPP
                    </Button>
                  ) : (
                    <div className="rounded-2xl p-1 text-center text-sm font-medium">
                      {booking.entry.adults.some((a: any) => a.isCounterPayment) ? (
                        <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 p-4 rounded-2xl text-left">
                          <p className="font-black text-amber-900 mb-1 flex items-center gap-1.5 text-sm uppercase tracking-tight">
                            <span>⚠️</span> Reserva Registrada com Sucesso!
                          </p>
                          <p className="text-xs leading-relaxed text-amber-900/90 font-bold">
                            Suas entradas foram selecionadas para <strong>pagamento presencial no balcão da bilheteria</strong> pelo valor normal de <strong>R$ 50,00 cada (sem desconto)</strong>. Apresente seu voucher digital ao chegar.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl">
                          Sua reserva é 100% gratuita. Não há necessidade de confirmação via WhatsApp. Apresente os comprovantes das gratuidades selecionadas diretamente no balcão da bilheteria ao chegar.
                        </div>
                      )}
                    </div>
                  )}

                  <Link to={`/voucher/${persistedConfirmationCode}`} target="_blank" className="w-full">
                    <Button variant="ghost" className="w-full h-14 rounded-2xl border-2 border-primary text-primary font-black shadow-sm flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all">
                       VER MEU VOUCHER DIGITAL <QrCode className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button onClick={() => window.location.reload()} variant="ghost" className="w-full h-10 rounded-2xl font-bold text-muted-foreground">FECHAR E VOLTAR</Button>
                </div>
                {totals.total > 0 && (
                  <p className="text-[10px] text-muted-foreground text-center px-4">
                    Clique no botão verde acima para receber seu comprovante oficial no WhatsApp.
                  </p>
                )}
              </motion.div>
            ) : !pixData ? (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-col items-center">
                  <button 
                    onClick={onPrevStep} 
                    className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-black text-sm uppercase tracking-widest mb-4 group transition-colors"
                  >
                     <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Alterar Pedido
                  </button>
                  {/* Visual spacer line */}
                  <div className="w-12 h-1 bg-primary/10 rounded-full mb-2"></div>
                </div>

                {/* ⚠️ Reservation guarantee warning */}
                {totals.total > 0 && (() => {
                  const hasBalcao = booking.entry.adults.some((a: any) => a.isCounterPayment);
                  return (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3.5 flex items-start gap-3 shadow-sm">
                      <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                      <div className="text-xs text-amber-900 font-bold leading-relaxed space-y-1">
                        <p className="font-black text-amber-950 text-sm">Sua reserva só será garantida após o pagamento!</p>
                        {hasBalcao ? (
                          <p className="text-amber-900/90 leading-relaxed">Você selecionou a opção de <span className="font-black underline">Pagar no Balcão</span> para a entrada. Os demais itens reservados pelo site <strong>devem ser pagos agora mesmo</strong> com o desconto online de 10% aplicado para garantir seu espaço. Pagamentos feitos no balcão não terão desconto de 10%!</p>
                        ) : (
                          <p className="text-amber-900/90 leading-relaxed">Efetue o pagamento agora para confirmar a sua reserva. Vagas não pagas não são reservadas e podem ser preenchidas por outros clientes. Pagamentos feitos no balcão não terão desconto de 10%!</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* CONFIRMAÇÃO DO ACEITE DOS TERMOS (Assinado na etapa de chalé) */}
                {hasSelectedChaleBooking && (
                  <div className="rounded-2xl p-3.5 sm:p-4 bg-emerald-950/90 text-white border-2 border-amber-400 flex items-center justify-between gap-2 shadow-md flex-wrap">
                    <div className="flex items-center gap-2 text-xs">
                      <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-emerald-100">
                        {isChaleTermsAccepted 
                          ? `Termos de Hospedagem aceitos ${formattedTermsAcceptedAt ? `em ${formattedTermsAcceptedAt}` : 'na etapa de chalé'}`
                          : 'Termos de Hospedagem: Aceite pendente na etapa de seleção do chalé'}
                      </span>
                    </div>
                    <Badge className={cn("text-[10px] font-black uppercase px-2.5 py-0.5", isChaleTermsAccepted ? "bg-amber-400 text-slate-950" : "bg-red-500 text-white")}>
                      {isChaleTermsAccepted ? 'Aceite Registrado ✓' : 'Pendente na Etapa 1'}
                    </Badge>
                  </div>
                )}

                {totals.total === 0 ? (
                  (() => {
                    const hasBalcao = booking.entry.adults.some((a: any) => a.isCounterPayment);
                    return (
                      <Button
                        size="lg"
                        onClick={() => handleAction('LOCAL')}
                        disabled={saving}
                        className={cn(
                          "w-full h-20 sm:h-24 rounded-2xl text-white font-black text-lg sm:text-xl flex items-center justify-center gap-4 shadow-xl active:scale-[0.97] transition-all group overflow-hidden relative border-2 cursor-pointer",
                          hasBalcao 
                            ? "bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 border-amber-400" 
                            : "bg-gradient-to-r from-[#094226] to-[#042817] hover:from-[#0d5531] hover:to-[#063a22] border-amber-400"
                        )}
                      >
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                          {saving ? <Loader2 className="h-7 w-7 animate-spin" /> : <CheckCircle className="h-7 w-7 text-white" />}
                        </div>
                        <div className="text-left leading-tight">
                          <span className="block text-[10px] text-amber-300 font-bold uppercase tracking-widest mb-0.5">
                            {hasBalcao ? "Pagamento no Balcão" : "Total Grátis"}
                          </span>
                          {hasBalcao ? "Confirmar Reserva" : "Concluir Reserva"}
                        </div>
                      </Button>
                    );
                  })()
                ) : (
                  <>
                    <div className={cn(
                      "grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 transition-opacity",
                      hasSelectedChaleBooking && !isChaleTermsAccepted && "opacity-60"
                    )}>
                      {/* Botão PIX */}
                      <Button
                        size="lg"
                        onClick={() => handleAction('PIX')}
                        disabled={saving}
                        className="h-20 sm:h-24 rounded-2xl bg-gradient-to-b from-[#094226] to-[#042817] hover:from-[#0d5531] hover:to-[#063a22] text-white font-black flex flex-row items-center justify-center gap-3 sm:gap-4 shadow-xl hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)] active:scale-[0.98] transition-all border-2 border-amber-400 px-4 sm:px-5 py-3 cursor-pointer"
                      >
                        <div className="p-2.5 sm:p-3 bg-amber-400/15 rounded-2xl border border-amber-400/30 shrink-0 flex items-center justify-center">
                          {saving && activePaymentMethod === 'PIX' ? (
                            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-amber-400" />
                          ) : (
                            <QrCode className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
                          )}
                        </div>
                        <div className="text-left leading-tight min-w-0">
                          <span className="inline-block bg-amber-400 text-slate-950 font-black text-[9.5px] sm:text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1 shadow-2xs whitespace-nowrap">
                            ⚡ 10% OFF ONLINE
                          </span>
                          <span className="block text-sm sm:text-lg font-black uppercase tracking-wide text-white whitespace-nowrap">
                            GERAR PIX
                          </span>
                        </div>
                      </Button>

                      {/* Botão CARTÃO DÉBITO E CRÉDITO (com suporte a parcelamento em até 12x) */}
                      <Button
                        size="lg"
                        onClick={() => {
                          if (hasSelectedChaleBooking && !isChaleTermsAccepted) {
                            handleAction('CREDIT_CARD', 1);
                            return;
                          }
                          if (totals.total >= 50) {
                            setShowCardInstallmentModal(true);
                          } else {
                            handleAction('CREDIT_CARD', 1);
                          }
                        }}
                        disabled={saving}
                        className="h-20 sm:h-24 rounded-2xl bg-gradient-to-b from-[#094226] to-[#042817] hover:from-[#0d5531] hover:to-[#063a22] text-white font-black flex flex-row items-center justify-center gap-3 sm:gap-4 shadow-xl hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)] active:scale-[0.98] transition-all border-2 border-amber-400 px-4 sm:px-5 py-3 cursor-pointer"
                      >
                        <div className="p-2.5 sm:p-3 bg-amber-400/15 rounded-2xl border border-amber-400/30 shrink-0 flex items-center justify-center">
                          {saving && activePaymentMethod === 'CREDIT_CARD' ? (
                            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-amber-400" />
                          ) : (
                            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
                          )}
                        </div>
                        <div className="text-left leading-tight min-w-0">
                          <span className="inline-block bg-amber-400 text-slate-950 font-black text-[9.5px] sm:text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1 shadow-2xs whitespace-nowrap">
                            💳 ATÉ 12X NO CARTÃO
                          </span>
                          <span className="block text-xs sm:text-base md:text-lg font-black uppercase tracking-wide text-white whitespace-nowrap">
                            CARTÃO DÉBITO E CRÉDITO
                          </span>
                        </div>
                      </Button>
                    </div>

                    {/* MODAL / DIALOG DE SELEÇÃO DE PARCELAS NO CARTÃO DE CRÉDITO */}
                    {showCardInstallmentModal && (
                      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-emerald-600 space-y-4 animate-in fade-in zoom-in-95">
                          <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-5 h-5 text-emerald-700" />
                              <h3 className="font-sans font-black text-base uppercase text-emerald-950">
                                Parcelamento no Cartão
                              </h3>
                            </div>
                            <button 
                              onClick={() => setShowCardInstallmentModal(false)}
                              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-1 text-center">
                            <span className="text-[11px] font-black uppercase text-emerald-800 tracking-wider block">
                              Valor Total da Reserva (com 10% OFF Online):
                            </span>
                            <span className="text-2xl font-black text-emerald-950 block">
                              {formatCurrency(totals.total)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-800 block">
                              Em quantas vezes deseja pagar no Cartão?
                            </label>
                            <select
                              value={selectedInstallments}
                              onChange={(e) => setSelectedInstallments(Number(e.target.value))}
                              className="w-full h-12 rounded-xl border-2 border-emerald-400 bg-white font-bold text-sm px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {Array.from({ length: Math.min(12, Math.max(1, Math.floor(totals.total / 30))) }).map((_, idx) => {
                                const times = idx + 1;
                                const valueEach = totals.total / times;
                                return (
                                  <option key={times} value={times}>
                                    {times}x de {formatCurrency(valueEach)} {times === 1 ? '(à vista com 10% OFF)' : '(sem juros adicionais)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="pt-2 flex flex-col gap-2">
                            <Button
                              onClick={() => {
                                setShowCardInstallmentModal(false);
                                handleAction('CREDIT_CARD', selectedInstallments);
                              }}
                              className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm uppercase tracking-wide shadow-lg border-b-4 border-emerald-950"
                            >
                              Prosseguir para Pagamento Seguro ({selectedInstallments}x de {formatCurrency(totals.total / selectedInstallments)})
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setShowCardInstallmentModal(false)}
                              className="font-bold text-xs text-slate-500"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
</div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] border-2 border-[#00bdae] p-6 space-y-4 shadow-lg w-full"
              >
                <div className="text-center space-y-2">
                   <h4 className="text-[#00bdae] font-black text-lg uppercase tracking-wider">PIX Copia e Cola Gerado!</h4>
                   <p className="text-xs text-muted-foreground font-medium">Escaneie o QR Code ou use o botão abaixo:</p>
                   
                   <div className="bg-amber-100/50 border border-amber-200 rounded-xl p-2.5">
                      <p className="text-[10px] text-amber-800 leading-tight font-bold">
                        ⚠️ Aviso Importante. Sua reserva SÓ SERÁ GARANTIDA após a confirmação do pagamento. O QR Code expira e a sua reserva pode ser ocupada por outro cliente se não for pago agora.
                      </p>
                   </div>
                </div>
                
                <div className="flex justify-center bg-white p-4 rounded-3xl border border-primary/5 shadow-inner">
                   <img 
                     src={`data:image/png;base64,${pixData.encodedImage}`} 
                     alt="QR Code PIX" 
                     className="w-48 h-48"
                   />
                </div>

                <div className="space-y-3">
                  <Button 
                    onClick={handleCopyPix}
                    className={cn(
                      "w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-md",
                      copied ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#00bdae] hover:bg-[#009b8f] text-white"
                    )}
                  >
                    {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    {copied ? 'Código PIX Copiado!' : 'Copiar Código PIX'}
                  </Button>

                  {/* Card de Orientação de Consulta */}
                  <div className="bg-emerald-50 border-2 border-emerald-300/80 rounded-2xl p-4 text-left space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-emerald-950 font-black text-xs uppercase tracking-tight">
                      <span className="text-base">💡</span>
                      <span>Como acompanhar seu agendamento:</span>
                    </div>
                    <ol className="text-[11px] text-emerald-950 font-medium space-y-1.5 list-decimal list-inside leading-relaxed pl-1">
                      <li>Copie o código acima e pague no app do seu banco via <strong>PIX Copia e Cola</strong>.</li>
                      <li>Ao retornar para esta página, ela <strong>confirma automaticamente</strong> em segundos.</li>
                      <li>Se a página fechar, consulte a qualquer momento no menu <strong className="text-emerald-800 underline">Consultar Reserva</strong> no topo do site usando seu <strong>WhatsApp</strong> ou <strong>CPF</strong> para ver seu Voucher com QR Code.</li>
                    </ol>
                  </div>

                  {/* Botão de Enviar Dados para o WhatsApp */}
                  {booking.entry.phone && (
                    <Button 
                      onClick={() => {
                        const cleanPhone = booking.entry.phone.replace(/\D/g, '');
                        const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                        const termsNote = hasSelectedChaleBooking
                          ? `\n*Comprovante de Aceite dos Termos de Hospedagem:*\nTermos aceitos eletronicamente por ${booking.entry.name || 'Hóspede'} em ${(chaleAcceptedAtDate || new Date()).toLocaleString('pt-BR')}. Os termos completos estão disponíveis no seu painel em https://reservas.balneariolessa.com.br/consultar\n`
                          : '';
                        const msg = `*Reserva Balneário Lessa*\n\nOlá, ${booking.entry.name || 'Cliente'}!\n\nSegue seu código PIX para pagamento da reserva:\n\n*PIX Copia e Cola:*\n${pixData.payload}\n${termsNote}\n*Acompanhar / Acessar Voucher e Termos:*\nConsulte a qualquer momento em: https://reservas.balneariolessa.com.br/consultar informando seu WhatsApp (${booking.entry.phone}).\n\n_Aguardamos você para um dia incrível de lazer na natureza!_`;
                        window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="w-full h-12 flex items-center justify-center gap-2 font-black text-xs sm:text-sm rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md transition-all active:scale-[0.98]"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Salvar / Enviar Dados e Comprovante dos Termos no WhatsApp
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setPaymentData({ open: true, orderId: persistedOrderId!, confirmationCode: persistedConfirmationCode || undefined });
                    }}
                    className="w-full text-xs font-bold text-muted-foreground uppercase"
                  >
                    Já paguei, ver meu voucher
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

      {paymentData && (
        <PaymentModal
          open={paymentData.open}
          onOpenChange={(op) => setPaymentData(prev => prev ? { ...prev, open: op } : null)}
          orderId={paymentData.orderId}
          name={`${booking.entry.name || ''} ${booking.entry.lastName || ''}`.trim()}
          email={booking.entry.email || ''} 
          phone={booking.entry.phone || ''}
          cpf={booking.entry.cpf || ''}
          totalAmount={totals.total}
          initialMethod={activePaymentMethod || undefined}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <ChaleTermsModal
        open={isTermsModalOpen}
        onOpenChange={setIsTermsModalOpen}
        onAccept={() => {
          setChaleTermsAccepted(true);
          setChaleTermsAcceptedAt(new Date());
          setTermsErrorHighlight(false);
        }}
        acceptanceRecord={
          isChaleTermsAccepted && chaleAcceptedAtDate
            ? buildChaleTermsAcceptanceRecord({
                guestName: booking.entry.name || 'Hóspede Titular',
                guestCpf: booking.entry.cpf,
                guestPhone: booking.entry.phone,
                reservationCode: persistedConfirmationCode || '',
                orderId: persistedOrderId || '',
                acceptedAt: chaleAcceptedAtDate,
              })
            : null
        }
      />
    </div>
  );
}
