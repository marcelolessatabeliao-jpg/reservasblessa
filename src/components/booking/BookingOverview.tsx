import { MessageCircle, CheckCircle, Loader2, ArrowRight, User, CreditCard, QrCode, Copy, Sparkles } from 'lucide-react';
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
}

export function BookingOverview({ booking, totals, updateEntry }: Props) {
  const [saving, setSaving] = useState(false);
  const [paymentData, setPaymentData] = useState<{ open: boolean; orderId: string; confirmationCode?: string } | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentConfirmationCode, setCurrentConfirmationCode] = useState<string | null>(null);
  const [activePaymentMethod, setActivePaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | null>(null);
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const { getPrice } = useServices();
  const { toast } = useToast();

  useEffect(() => {
    if (!currentOrderId || paymentConfirmed) return;

    const channel = supabase
      .channel(`order-overview-${currentOrderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${currentOrderId}` },
        (payload) => {
          if (payload.new.status === 'paid' || payload.new.status === 'confirmed') {
            setCurrentConfirmationCode(payload.new.confirmation_code);
            setPaymentConfirmed(true);
            toast({ title: 'Pagamento Confirmado!', description: 'Sua reserva está garantida!' });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentOrderId, paymentConfirmed, toast]);

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

    if (method !== 'LOCAL' && (!booking.entry.cpf || booking.entry.cpf.replace(/\D/g, '').length < 11)) {
       toast({
         title: 'CPF Obrigatório',
         description: 'O CPF é necessário para pagamentos PIX ou Cartão.',
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
      items.push({ 
        product_id: KIOSK_INFO[k.type].label, 
        quantity: k.quantity, 
        unit_price: getPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price) 
      });
    });

    booking.quads.filter(q => q.quantity > 0).forEach(q => {
      const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const discount = getQuadDiscount(q.date);
      const basePrice = getPrice(`quad_${q.type}`, fallbackMap[q.type]);
      items.push({ 
        product_id: `Quad ${QUAD_LABELS[q.type]}`, 
        quantity: q.quantity, 
        unit_price: basePrice * (1 - discount) 
      });
    });

    booking.additionals.filter(a => a.quantity > 0).forEach(a => {
      items.push({ 
        product_id: ADDITIONAL_INFO[a.type].label, 
        quantity: a.quantity, 
        unit_price: getPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price) 
      });
    });
    
    setSaving(true);
    try {
      let orderId = currentOrderId;
      let confCode = currentConfirmationCode;

      if (!orderId) {
        const result = await saveBooking({
          ...booking,
          entry: { ...booking.entry, name: fullName }
        }, totals.total, null, items);
        
        if (!result?.orderId) throw new Error("Erro ao salvar pedido.");
        orderId = result.orderId;
        confCode = result.confirmationCode;
        setCurrentOrderId(orderId);
        setCurrentConfirmationCode(confCode);
      }

      if (method === 'PIX') {
        setPaymentData(null);
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
        <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center text-2xl shadow-sm">🛒</div>
        <p className="text-muted-foreground font-medium">Você ainda não selecionou nenhum item.<br />Comece adicionando pessoas no Day Use!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <span className="text-base sm:text-lg">📝</span>
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl">Resumo da Experiência (v3)</h3>
      </div>

      <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-5 sm:p-6 shadow-xl space-y-5">

        {/* Entradas */}
        {/* Data selecionada */}
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex items-center justify-between">
          <span className="text-[11px] uppercase font-black tracking-widest text-muted-foreground">Data da Visita:</span>
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
                let label = (p as any).age >= 60 ? 'Idoso' : (p as any).age <= 11 ? 'Criança' : 'Entrada';
                if (p.isPCD) label = 'PCD/TEA';
                if (p.isBirthday) label = 'Aniversariante';

                return (
                  <div key={`free-${i}`} className="flex justify-between items-start text-green-800 font-bold bg-green-50/50 p-2 rounded-lg border border-green-100/50">
                    <div>
                      <span>{qty}x {label}</span>
                      <span className="block text-[10px] uppercase tracking-tighter opacity-70">Acesso Gratuito</span>
                    </div>
                    <span className="whitespace-nowrap uppercase text-xs">Grátis</span>
                  </div>
                );
              })}

              {/* Pagantes */}
              {booking.entry.adults.filter(a => getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo', getPrice) > 0).map((a, i) => {
                const qty = a.quantity || 1;
                const price = getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo', getPrice);
                let details = [];
                if (a.isTeacher) details.push('Professor');
                if (a.isServer) details.push('Servidor');
                if (a.isStudent) details.push('Estudante');
                if (a.takeDonation && booking.entry.dayOfWeek !== 'domingo') details.push('Adulto Solidário');
                if ((a as any).isBloodDonor) details.push('Doador');
                
                const mainLabel = details.length > 0 ? `${qty}x ${details.join(', ')}` : `${qty}x Adulto`;

                return (
                  <div key={`adult-pay-${i}`} className="flex justify-between items-start">
                    <div>
                      <span>{mainLabel}</span>
                      {details.length > 0 && <span className="block text-[11px] font-medium text-primary/70">(Meia-Entrada)</span>}
                    </div>
                    <span className="font-medium whitespace-nowrap">{formatCurrency(price * qty)}</span>
                  </div>
                );
              })}

              {booking.entry.children.filter(c => getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice) > 0).map((c, i) => {
                const qty = c.quantity || 1;
                const price = getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice);
                return (
                  <div key={`child-pay-${i}`} className="flex justify-between items-start mt-2">
                    <div>
                      <span>{qty}x Criança</span>
                    </div>
                    <span className="font-medium whitespace-nowrap">{formatCurrency(price * qty)}</span>
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
                <div key={k.type} className="flex justify-between">
                  <div>
                    <span>{k.quantity}x {KIOSK_INFO[k.type].label}</span>
                    {booking.entry.visitDate && (
                      <span className="block text-[10px] text-muted-foreground/80">📅 {format(booking.entry.visitDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                    )}
                  </div>
                  <span>{formatCurrency(k.quantity * basePrice)}</span>
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
                  <div key={q.type} className="flex justify-between items-start">
                    <div>
                      <span>{q.quantity}x Quad. {QUAD_LABELS[q.type]}</span>
                      <span className="block text-[10px] text-muted-foreground/80">📅 {q.date ? format(q.date, "dd/MM/yyyy", { locale: ptBR }) : booking.entry.visitDate ? format(booking.entry.visitDate, "dd/MM/yyyy", { locale: ptBR }) : '—'} às {q.time || '—'}</span>
                      {discount > 0 && (
                        <span className="block text-[10px] text-green-700 font-bold uppercase tracking-tight">Economia de {formatCurrency((basePrice - final_) * q.quantity)} (Desconto {discount * 100}%)</span>
                      )}
                    </div>
                    <span>{formatCurrency(q.quantity * final_)}</span>
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
                <div key={a.type} className="flex justify-between items-start">
                  <div>
                    <span>{a.quantity}x {ADDITIONAL_INFO[a.type].label}</span>
                    {booking.entry.visitDate && (
                      <span className="block text-[10px] text-muted-foreground/80">📅 {format(booking.entry.visitDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                    )}
                  </div>
                  <span>{formatCurrency(a.quantity * basePrice)}</span>
                </div>
              )})}
              <div className="flex justify-between font-bold text-foreground pt-1">
                <span>Subtotal Diversão</span>
                <span>{formatCurrency(totals.additionalsTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Membership Comparison Action Card */}
        {(() => {
          const allAdults = booking.entry.adults;
          // Membros que pagam R$ 25 no plano (Estudante, Professor, Servidor)
          const restrictedHalfPriceMembers = allAdults.filter(a => a.isTeacher || a.isServer || a.isStudent).reduce((acc, a) => acc + (a.quantity || 1), 0);
          // O resto (Inteira, Solidário/Social, Doador) paga R$ 49,90 no plano
          const fullPriceMembers = allAdults.reduce((acc, a) => acc + (a.quantity || 1), 0) - restrictedHalfPriceMembers;

          const membershipPrice = calculateMembershipCost({ adultsCount: fullPriceMembers, halfPriceCount: restrictedHalfPriceMembers });
          const entriesTotal = totals.entriesTotal;

          if ((fullPriceMembers + restrictedHalfPriceMembers) > 0) {
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950 border-2 border-sun/30 rounded-3xl p-5 sm:p-6 relative overflow-hidden group shadow-2xl"
              >
                {/* Decoration */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-sun/10 rounded-full blur-3xl group-hover:bg-sun/20 transition-all duration-500" />
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />

                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-sun/20 flex items-center justify-center border border-sun/30 shadow-inner">
                    <Sparkles className="w-6 h-6 text-sun animate-pulse" />
                  </div>
                  <h3 className="font-display font-black text-white text-lg sm:text-xl tracking-tight">
                    Vale mais a pena ser Sócio!
                  </h3>
                </div>

                <div className="space-y-4 relative z-10">
                  <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed font-medium">
                    Suas entradas hoje custam <span className="bg-sun/20 text-sun font-black px-2 py-0.5 rounded-lg border border-sun/20">{formatCurrency(entriesTotal)}</span>.
                    Por apenas <span className="bg-green-500/20 text-green-400 font-black px-2 py-0.5 rounded-lg border border-green-500/20">{formatCurrency(membershipPrice)} mensais</span>, você garante o <span className="text-sun font-black underline decoration-sun/30 underline-offset-4">Lessa Club</span> com
                    <span className="text-white font-black mx-1 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md">Entradas Ilimitadas</span> todos os dias!
                  </p>

                  <Button 
                    variant="default"
                    className="w-full h-14 bg-white hover:bg-slate-50 text-slate-950 font-black text-base uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group"
                    onClick={() => {
                      const element = document.getElementById('especiais');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    Ativar Plano Dourado <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            );
          }
          return null;
        })()}

        {/* Total Bruto e Descontos */}
        {(() => {
           // Calculate potential "savings"
           // For simplicity, let's just show a row summarizing the total and maybe the "Economia"
           const totalFullPrice = [...booking.entry.adults, ...booking.entry.children].reduce((acc, p) => acc + ((p.quantity || 1) * 50), 0);
           const savings = totalFullPrice - totals.entriesTotal;
           
           return (
             <div className="pt-4 space-y-2">
               <div className="flex justify-between items-center bg-primary/5 rounded-2xl p-4 border border-primary/10">
                 <div>
                   <span className="text-xl sm:text-2xl font-black text-primary">Total: {formatCurrency(totals.total)}</span>
                   {savings > 0 && (
                     <span className="block text-[10px] sm:text-xs text-whatsapp font-bold uppercase tracking-widest mt-0.5">
                       ✨ VOCÊ ESTÁ ECONOMIZANDO {formatCurrency(savings)} NESTA RESERVA!
                     </span>
                   )}
                 </div>
               </div>
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
                    <p className="text-4xl font-mono font-black text-primary tracking-[0.2em]">{currentConfirmationCode}</p>
                  </div>
                  
                  <div className="flex justify-center bg-white p-4 rounded-2xl border shadow-sm max-w-[180px] mx-auto">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentConfirmationCode}`} 
                      alt="QR Code" 
                      className="w-32 h-32"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <Link to={`/voucher/${currentConfirmationCode}`} target="_blank" className="w-full">
                    <Button className="w-full h-14 rounded-2xl bg-sun hover:bg-sun/90 text-primary-dark font-black shadow-lg flex gap-2">
                       VER MEU VOUCHER DIGITAL <QrCode className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Button onClick={() => window.location.reload()} variant="outline" className="w-full h-12 rounded-2xl font-bold">FECHAR E VOLTAR</Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center px-4">
                  Clique no botão acima para abrir seu voucher oficial. Enviamos os detalhes também para o seu WhatsApp/E-mail.
                </p>
              </motion.div>
            ) : !pixData ? (
              <div className="flex flex-col gap-4 w-full">
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
                    <span className="block text-[10px] text-white/80 font-black uppercase tracking-widest mb-0.5">Pagar Agora Online</span>
                    Gerar PIX
                  </div>
                </Button>

                <Button
                  size="lg"
                  onClick={() => handleAction('CREDIT_CARD')}
                  disabled={saving}
                  className="w-full h-20 sm:h-24 rounded-[2rem] bg-primary hover:bg-primary-dark text-white font-black text-lg sm:text-xl flex items-center justify-center gap-4 shadow-xl active:scale-[0.97] transition-all group overflow-hidden relative border-b-8 border-primary-dark"
                >
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                    {saving && activePaymentMethod === 'CREDIT_CARD' ? <Loader2 className="h-7 w-7 animate-spin" /> : <CreditCard className="h-7 w-7 text-white" />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block text-[10px] text-white/80 font-black uppercase tracking-widest mb-0.5">Pagar Agora Online</span>
                    Cartão de Crédito
                  </div>
                </Button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] border-2 border-[#00bdae] p-6 space-y-4 shadow-lg w-full"
              >
                <div className="text-center">
                   <h4 className="text-[#00bdae] font-black text-lg uppercase tracking-wider">PIX Copia e Cola Gerado!</h4>
                   <p className="text-xs text-muted-foreground font-medium">Escaneie o QR Code ou use o botão abaixo:</p>
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
                        setPaymentData({ open: true, orderId: currentOrderId!, confirmationCode: currentConfirmationCode || undefined });
                    }}
                    className="w-full text-xs font-bold text-muted-foreground uppercase"
                  >
                    Já paguei, ver meu voucher
                  </Button>
                </div>
              </motion.div>
            )}

            <Button
              size="lg"
              onClick={() => handleAction('LOCAL')}
              disabled={saving}
              className="w-full h-20 sm:h-24 rounded-[2rem] bg-[#006020] hover:bg-[#004d1a] border-b-8 border-[#004015] text-white font-black flex items-center justify-center gap-2 sm:gap-4 shadow-lg active:scale-[0.97] transition-all relative overflow-hidden group"
            >
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shrink-0">
                <MessageCircle className="h-7 w-7 text-white" />
              </div>
              <div className="text-left leading-tight min-w-0">
                <span className="block text-[10px] sm:text-[11px] text-white/80 font-black uppercase tracking-widest mb-0.5 truncate uppercase">Pagar Presencialmente</span>
                <span className="text-lg sm:text-2xl uppercase tracking-tighter block whitespace-nowrap overflow-hidden text-ellipsis">Confirmar no WhatsApp</span>
              </div>
            </Button>
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
