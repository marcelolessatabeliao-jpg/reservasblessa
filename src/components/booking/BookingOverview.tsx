import { MessageCircle, CheckCircle, Loader2, ArrowRight, User, CreditCard, QrCode, Copy, Sparkles, Phone, X, ArrowLeft } from 'lucide-react';
import { isValidCPF } from '@/utils/cpf-validator';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { saveBooking } from '@/lib/booking-service';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { PaymentModal } from './PaymentModal';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPersonPrice, formatCurrency, KIOSK_INFO, QUAD_LABELS, getQuadDiscount, ADDITIONAL_INFO, WHATSAPP_NUMBER, type BookingState, type AdultInfo, type ChildInfo } from '@/lib/booking-types';
import { useState, useEffect } from 'react';
import { trackFBEvent } from '@/utils/pixel-events';

interface Props {
  booking: BookingState;
  totals: {
    entriesTotal: number;
    kiosksTotal: number;
    quadsTotal: number;
    additionalsTotal: number;
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
  onPrevStep
}: Props) {
  const [saving, setSaving] = useState(false);
  const [paymentData, setPaymentData] = useState<{ open: boolean; orderId: string; confirmationCode?: string } | null>(null);
  const [activePaymentMethod, setActivePaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | null>(null);
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const { getPrice } = useServices();
  const { toast } = useToast();

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

  const handleAction = async (method: 'PIX' | 'CREDIT_CARD' | 'LOCAL') => {
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

    if (method !== 'LOCAL' && (!booking.entry.cpf || !isValidCPF(booking.entry.cpf))) {
       toast({
         title: !booking.entry.cpf ? 'CPF Obrigatório' : 'CPF INVÁLIDO',
         description: 'Um CPF válido é necessário para pagamentos PIX ou Cartão.',
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

    const items: any[] = [];
    const isSunday = booking.entry.dayOfWeek === 'domingo';
    
    booking.entry.adults.forEach(a => {
      const price = getPersonPrice(a, a.age >= 60, isSunday, getPrice);
      const label = a.isPCD ? 'Lessa Inclusão' : 
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
      items.push({ product_id: 'Criança', quantity: c.quantity || 1, unit_price: price });
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
      const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const discount = getQuadDiscount(q.date);
      const basePrice = getPrice(`quad_${q.type}`, fallbackMap[q.type]);
      items.push({ 
        product_id: `Quad ${QUAD_LABELS[q.type]}`, 
        quantity: q.quantity, 
        unit_price: basePrice * (1 - discount),
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
    
    let orderIdToRollback: string | null = null;
    setSaving(true);
    try {
      let orderId = persistedOrderId;
      let confCode = persistedConfirmationCode;

      // Se não temos ordem ou os itens/valor mudaram drasticamente, o back-end cuida de atualizar se passarmos o ID
      const result = await saveBooking({
        ...booking,
        entry: { ...booking.entry, name: fullName }
      }, totals.total, null, items, method !== 'LOCAL' ? 'awaiting_payment' : 'pending', orderId);
      
      if (!result?.orderId) throw new Error("Erro ao salvar pedido.");
      orderId = result.orderId;
      confCode = result.confirmationCode;
      
      setPersistedOrderId(orderId);
      setPersistedConfirmationCode(confCode);

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
        
        const msg = buildWhatsAppMessage(booking, totals.total, false, confCode || undefined, getPrice);
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
      const msg = buildWhatsAppMessage(booking, totals.total, false, paymentData?.confirmationCode, getPrice);
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

  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center justify-center p-10 mt-10 text-center space-y-4 bg-white/30 backdrop-blur-md rounded-2xl border border-white/60">
        <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center text-2xl shadow-sm">\uD83D\uDED2</div>
        <p className="text-muted-foreground font-medium">Voc\u00EA ainda n\u00E3o selecionou nenhum item.<br />Comece adicionando pessoas no Day Use!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 text-primary shrink-0">
          <span className="text-base sm:text-lg">\uD83D\uDCDD</span>
        </div>
        <h3 className="font-sans font-bold text-lg sm:text-xl">Resumo da Experiência</h3>
      </div>

      <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-5 sm:p-6 shadow-xl space-y-5">

        {/* Entradas */}
        {/* Data selecionada */}
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex items-center justify-between">
          <span className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground">Data da Visita:</span>
          {booking.entry.visitDate ? (
            <span className="font-bold text-primary">{format(booking.entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
          ) : (
            <span className="font-medium text-destructive text-sm">Não selecionada</span>
          )}
        </div>

        {/* Entradas */}
        {(booking.entry.adults.length > 0 || booking.entry.children.length > 0) && (
          <div className="pb-5 border-b border-primary/10">
            <h4 className="font-bold text-primary mb-3 uppercase tracking-widest text-[10px] sm:text-xs">Day Use (Entradas)</h4>
            <div className="space-y-3 text-sm sm:text-base text-muted-foreground">
              {/* Gratuidades Primeiro */}
              {[...booking.entry.adults, ...booking.entry.children].filter(p => getPersonPrice(p, (p as any).age >= 60 || (p as any).age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice) === 0).map((p, i) => {
                const qty = p.quantity || 1;
                let label = (p as any).age >= 60 ? 'Lessa Vitalício (Idoso)' : (p as any).age <= 11 ? 'Lessa Kids (Criança)' : 'Acesso';
                let sublabel = 'Acesso Gratuito';

                if (p.isPCD) label = 'Lessa Inclusão (PCD/TEA)';
                else if (p.isBirthday) label = 'Aniversariante da Semana';
                else if (p.isMember) {
                  label = 'Assinante Lessa Club \uD83D\uDC51';
                  sublabel = 'S\u00F3cio Lessa Club Premium';
                }

                return (
                  <div key={`free-${i}`} className="relative flex justify-between items-start text-emerald-700 font-bold bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50 group/item">
                    <div>
                      <span className="text-sm">{qty}x {label}</span>
                      <span className="block text-[10px] uppercase tracking-wider opacity-60">{sublabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="whitespace-nowrap uppercase text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">Grátis</span>
                       {onRemoveAdult && !((p as any).age <= 11) && (
                         <button onClick={() => i < booking.entry.adults.length ? onRemoveAdult(i) : null} className="p-1 hover:bg-emerald-200 rounded-full transition-colors">
                           <X className="h-3 w-3" />
                         </button>
                       )}
                       {onRemoveChild && (p as any).age <= 11 && (
                         <button onClick={() => onRemoveChild(i - booking.entry.adults.length)} className="p-1 hover:bg-emerald-200 rounded-full transition-colors">
                           <X className="h-3 w-3" />
                         </button>
                       )}
                    </div>
                  </div>
                );
              })}

              {/* Pagantes */}
              {booking.entry.adults.filter(a => getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo', getPrice) > 0).map((a, i) => {
                const qty = a.quantity || 1;
                const price = getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo', getPrice);
                
                let label = 'Adulto Inteira';
                if (a.isTeacher) label = 'Lessa Professor Pass';
                else if (a.isServer) label = 'Lessa Servidor Pass';
                else if (a.isStudent) label = 'Lessa Estudante Pass';
                else if (a.takeDonation) label = 'Adulto Solid\u00E1rio';
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

              {booking.entry.children.filter(c => getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice) > 0).map((c, i) => {
                const qty = c.quantity || 1;
                const price = getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice);
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
              
              <div className="flex justify-between font-bold text-foreground pt-2 mt-2 border-t border-primary/5">
                <span>Subtotal Entradas</span>
                <span>{formatCurrency(totals.entriesTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quiosques */}
        {booking.kiosks.some(k => k.quantity > 0) && (
          <div className="pb-5 border-b border-primary/10">
            <h4 className="font-bold text-primary mb-3 uppercase tracking-widest text-[10px] sm:text-xs">Quiosques</h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.kiosks.filter(k => k.quantity > 0).map(k => {
                const basePrice = getPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price);
                return (
                <div key={k.type} className="flex justify-between group/item items-center">
                  <div>
                    <span>
                      {k.selectedIds && k.selectedIds.length > 0
                        ? k.selectedIds.sort((a,b)=>a-b).map(id => `Quiosque ${String(id).padStart(2,'0')}`).join(', ')
                        : `${k.quantity}x ${KIOSK_INFO[k.type].label}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatCurrency(k.quantity * basePrice)}</span>
                    {onUpdateKiosk && (
                      <button onClick={() => {
                        const idx = booking.kiosks.findIndex(x => x.type === k.type);
                        onUpdateKiosk(idx, { quantity: 0, selectedIds: [] });
                      }} className="p-1 hover:bg-primary/10 rounded-full transition-colors text-primary/40 hover:text-primary">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )})}
              <div className="flex justify-between font-bold text-foreground pt-1">
                <span>Subtotal Quiosques</span>
                <span>{formatCurrency(totals.kiosksTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Quadriciclos */}
        {booking.quads.some(q => q.quantity > 0) && (
          <div className="pb-5 border-b border-primary/10">
            <h4 className="font-bold text-primary mb-3 uppercase tracking-widest text-[10px] sm:text-xs">Quadriciclos</h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.quads.filter(q => q.quantity > 0).map(q => {
                const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
                const discount = getQuadDiscount(q.date);
                const basePrice = getPrice(`quad_${q.type}`, fallbackMap[q.type]);
                const final_ = basePrice * (1 - discount);
                return (
                  <div key={q.type} className="flex justify-between items-center group/item">
                    <div>
                      <span>{q.quantity}x Quad. {QUAD_LABELS[q.type]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{formatCurrency(q.quantity * final_)}</span>
                      {onUpdateQuad && (
                        <button onClick={() => {
                          const idx = booking.quads.findIndex(x => x.type === q.type);
                          onUpdateQuad(idx, { quantity: 0 });
                        }} className="p-1 hover:bg-primary/10 rounded-full transition-colors text-primary/40 hover:text-primary">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between font-bold text-foreground pt-1">
                <span>Subtotal Quadriciclos</span>
                <span>{formatCurrency(totals.quadsTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Adicionais */}
        {booking.additionals.some(a => a.quantity > 0) && (
          <div className="pb-5 border-b border-primary/10">
            <h4 className="font-bold text-primary mb-3 uppercase tracking-widest text-[10px] sm:text-xs">Diversão e Lazer</h4>
            <div className="space-y-2 text-sm sm:text-base text-muted-foreground">
              {booking.additionals.filter(a => a.quantity > 0).map(a => {
                const basePrice = getPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price);
                return (
                <div key={a.type} className="flex justify-between items-center group/item">
                  <div>
                    <span>{a.quantity}x {ADDITIONAL_INFO[a.type].label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatCurrency(a.quantity * basePrice)}</span>
                    {onUpdateAdditional && (
                      <button onClick={() => {
                        const idx = booking.additionals.findIndex(x => x.type === a.type);
                        onUpdateAdditional(idx, { quantity: 0 });
                      }} className="p-1 hover:bg-primary/10 rounded-full transition-colors text-primary/40 hover:text-primary">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )})}
              <div className="flex justify-between font-bold text-foreground pt-1">
                <span>Subtotal Diversão</span>
                <span>{formatCurrency(totals.additionalsTotal)}</span>
              </div>
            </div>
          </div>
        )}


        {/* Total Bruto e Descontos */}
        {(() => {
           // Calculate potential "savings"
           // For simplicity, let's just show a row summarizing the total and maybe the "Economia"
            const fullPriceBase = 50;
            const totalFullPrice = [...booking.entry.adults, ...booking.entry.children].reduce((acc, p) => acc + ((p.quantity || 1) * fullPriceBase), 0);
            const savings = totalFullPrice - totals.entriesTotal;
            
            return (
              <div className="pt-4 space-y-2">
                <div className="flex justify-between items-center bg-primary/5 rounded-2xl p-4 border border-primary/10 mb-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-black text-primary">Total: {formatCurrency(totals.total)}</span>
                    </div>
                    {savings > 0 && (
                      <span className="block text-[9px] sm:text-[10px] text-whatsapp font-black uppercase tracking-widest mt-0.5">
                        \u2728 VOC\u00CA EST\u00C1 ECONOMIZANDO {formatCurrency(savings)} NESTA RESERVA!
                      </span>
                    )}
                  </div>
                </div>

                {/* Membership Comparison Action Card */}
                {(() => {
                  const allAdults = booking.entry.adults;
                  const reservaHojeEntries = totals.entriesTotal;
                  // Contar apenas quem NÃO é assinante E NÃO tem gratuidade hoje (Idoso, PCD, etc) para a comparação
                  const nonMemberAdults = allAdults.filter(a => 
                    !a.isMember && !a.isPCD && !a.isTEA && !a.isBirthday && !(a.age >= 60)
                  );
                  const halfPriceCount = nonMemberAdults.filter(a => 
                    a.isTeacher || a.isServer || a.isStudent || (a as any).isBloodDonor || a.takeDonation
                  ).reduce((acc, a) => acc + (a.quantity || 1), 0);
                  const fullPriceCount = nonMemberAdults.reduce((acc, a) => acc + (a.quantity || 1), 0) - halfPriceCount;
                  const membershipPrice = (fullPriceCount * 49.9) + (halfPriceCount * 25);

                  if ((fullPriceCount + halfPriceCount) > 0) {
                    const isCheaper = membershipPrice <= reservaHojeEntries;
                    return (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-[#FFD700] via-[#FFB900] to-[#E5A500] border-4 border-white/40 rounded-3xl p-5 sm:p-6 relative overflow-hidden group shadow-2xl mb-6"
                      >
                        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/30 rounded-full blur-3xl group-hover:bg-white/50 transition-all duration-700 animate-pulse" />
                        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl" />

                          <div className="relative">
                            <div className="w-8 h-8 rounded-lg bg-emerald-950/10 flex items-center justify-center border-2 border-emerald-950/20 shadow-lg backdrop-blur-sm shrink-0">
                              <Sparkles className="w-4 h-4 text-emerald-950 drop-shadow-sm" />
                            </div>
                          </div>
                          
                          <h3 className="font-display font-black text-emerald-950 text-base sm:text-lg tracking-tighter leading-tight uppercase">
                            {isCheaper ? 'Vale mais a pena ser S\u00F3cio!' : 'Acesso Ilimitado o m\u00EAs inteiro!'}
                          </h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                          <p className="text-emerald-950/90 text-[10px] sm:text-xs font-bold leading-tight uppercase tracking-tight -mb-2 opacity-70">
                            Simulação para: {fullPriceCount > 0 ? `${fullPriceCount}x Adulto` : ''} 
                            {fullPriceCount > 0 && halfPriceCount > 0 ? ' + ' : ''} 
                            {halfPriceCount > 0 ? `${halfPriceCount}x Meia` : ''}
                            {allAdults.some(a => a.isMember) ? ' (Assinantes atuais não contam)' : ''}
                          </p>
                          <p className="text-emerald-950/90 text-xs sm:text-sm leading-snug font-black">
                            Sua reserva custa <span className="bg-emerald-950/20 text-emerald-950 px-1.5 py-0.5 rounded-lg">{formatCurrency(reservaHojeEntries)}</span>.
                            No <span className="text-emerald-950 font-black">Lessa Club</span>, voc\u00EA paga <span className="bg-white/40 text-emerald-950 px-1.5 py-0.5 rounded-lg">{formatCurrency(membershipPrice)}</span>/m\u00EAs e tem 
                            <span className="inline-flex items-center text-white font-black mx-1 uppercase text-[9px] bg-emerald-950 px-2 py-0.5 rounded-lg shadow tracking-tighter shrink-0 overflow-hidden">ENTRADAS ILIMITADAS</span>
                          </p>

                          <Button 
                            variant="default"
                            className="w-full min-h-[40px] h-auto py-2.5 bg-emerald-950 hover:bg-emerald-900 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 border-b-4 border-emerald-900/50 px-4"
                            onClick={() => {
                              const element = document.getElementById('especiais');
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                          >
                            <span className="flex-1 leading-tight">ATIVAR MEU PLANO DOURADO</span>
                            <ArrowRight className="h-4 w-4 shrink-0" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                })()}
             </div>
           );
        })()}

        {/* Seção de Dados do Pagador */}
        <div className="space-y-4 pt-4 border-t border-primary/10">
          <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
            <User className="h-4 w-4" /> Dados do Responsável
          </h4>
          <div className="space-y-1.5 flex-1">
            <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">Nome Completo</Label>
            <Input
              value={booking.entry.name}
              onChange={(e) => updateEntry?.({ name: e.target.value })}
              placeholder="Nome completo do responsável"
              className="rounded-xl border-primary/20 h-11 focus-visible:ring-primary font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">CPF (Obrigatório para Pix/Cartão)</Label>
            <Input
              value={booking.entry.cpf || ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                updateEntry?.({ cpf: val });
              }}
              placeholder="000.000.000-00"
              className="rounded-xl border-primary/20 h-11 focus-visible:ring-primary font-medium"
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
                  <Button 
                    onClick={() => {
                      const msg = `\uD83C\uDF3F *BALNE\u00C1RIO FAM\u00CDLIA LESSA*\n\nOl\u00E1! Minha reserva no Balne\u00E1rio Lessa foi confirmada! \u2705\n\n\uD83D\uDCCB *RESUMO DO PEDIDO*\n\uD83D\uDC64 *Titular:* ${booking.entry.name}\n\uD83D\uDCC5 *Data:* ${booking.entry.visitDate ? format(new Date(booking.entry.visitDate), "dd/MM/yyyy") : '\u2014'}\n\uD83D\uDD22 *Voucher:* ${persistedConfirmationCode}\n\n\uD83D\uDD17 *VOUCHER DIGITAL:*\nhttps://reservas.balneariolessa.com.br/voucher/${persistedConfirmationCode}\n\n\uD83D\uDCCD *COMO CHEGAR:*\nVia Araras, Setor 09 \u2013 Ariquemes/RO`;
                      const phone = booking.entry.phone?.replace(/\D/g, '') || '';
                      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="w-full h-16 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-black shadow-lg flex items-center justify-center gap-3 animate-pulse border-b-4 border-[#075E54]"
                  >
                     <Phone className="w-6 h-6 fill-current" /> RECEBER NO WHATSAPP
                  </Button>

                  <Link to={`/voucher/${persistedConfirmationCode}`} target="_blank" className="w-full">
                    <Button variant="outline" className="w-full h-14 rounded-2xl border-2 border-primary/10 text-primary font-black shadow-sm flex gap-2 hover:bg-primary/5">
                       VER MEU VOUCHER DIGITAL <QrCode className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button onClick={() => window.location.reload()} variant="ghost" className="w-full h-10 rounded-2xl font-bold text-muted-foreground">FECHAR E VOLTAR</Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center px-4">
                  Clique no botão verde acima para receber seu comprovante oficial no WhatsApp.
                </p>
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

                <Button
                  size="lg"
                  onClick={() => handleAction('PIX')}
                  disabled={saving}
                  className="w-full h-20 sm:h-24 rounded-[2rem] bg-[#00bdae] hover:bg-[#009b8f] text-white font-black text-lg sm:text-xl flex items-center justify-center gap-4 shadow-xl active:scale-[0.97] transition-all group overflow-hidden relative border-b-8 border-[#007a71]"
                >
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    {saving && activePaymentMethod === 'PIX' ? <Loader2 className="h-7 w-7 animate-spin" /> : <QrCode className="h-7 w-7 text-white" />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] text-white/80 font-bold uppercase tracking-widest mb-0.5">Pagar Agora Online</span>
                    Gerar PIX
                  </div>
                </Button>

                <Button
                  size="lg"
                  onClick={() => handleAction('CREDIT_CARD')}
                  disabled={saving}
                  className="w-full h-20 sm:h-24 rounded-[2rem] bg-primary hover:bg-primary-dark text-white font-bold text-lg sm:text-xl flex items-center justify-center gap-4 shadow-xl active:scale-[0.97] transition-all group overflow-hidden relative border-b-8 border-primary-dark"
                >
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    {saving && activePaymentMethod === 'CREDIT_CARD' ? <Loader2 className="h-7 w-7 animate-spin" /> : <CreditCard className="h-7 w-7 text-white" />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] text-white/80 font-bold uppercase tracking-widest mb-0.5">Pagar Agora Online</span>
                    Cartão de Crédito
                  </div>
                </Button>

                <Button
                  size="lg"
                  onClick={() => handleAction('LOCAL')}
                  disabled={saving}
                  className="w-full h-16 sm:h-20 rounded-2xl bg-[#006020] hover:bg-[#004d1a] border-b-4 border-[#004015] text-white font-black flex items-center justify-center gap-2 sm:gap-4 shadow-lg active:scale-[0.97] transition-all relative overflow-hidden group"
                >
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md shrink-0">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left leading-tight min-w-0">
                    <span className="block text-[9px] text-white/80 font-black uppercase tracking-widest mb-0.5 truncate uppercase">Pagar Presencialmente</span>
                    <span className="text-sm sm:text-lg uppercase tracking-tighter block whitespace-nowrap overflow-hidden text-ellipsis">Confirmar no WhatsApp</span>
                  </div>
                </Button>
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
                      "w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all",
                      copied ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#00bdae] hover:bg-[#009b8f] text-white"
                    )}
                  >
                    {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    {copied ? 'Código Copiado!' : 'Copiar Código PIX'}
                  </Button>
                  
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
    </div>
  );
}
