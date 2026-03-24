import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookingState, formatCurrency, KIOSK_INFO, QUAD_PRICES, QUAD_LABELS, ADDITIONAL_INFO, getQuadDiscount, getPersonPrice, WHATSAPP_NUMBER } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { MessageCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { saveBooking } from '@/lib/booking-service';
import { buildWhatsAppMessage } from '@/lib/whatsapp';
import { PaymentModal } from './PaymentModal';
import { useServices } from '@/hooks/useServices';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  booking: BookingState;
  totals: {
    entriesTotal: number;
    kiosksTotal: number;
    quadsTotal: number;
    additionalsTotal: number;
    total: number;
  };
}

export function BookingOverview({ booking, totals }: Props) {
  const [saving, setSaving] = useState(false);
  const [paymentData, setPaymentData] = useState<{ open: boolean; orderId: string; confirmationCode?: string } | null>(null);
  const { getPrice } = useServices();

  function calculateMembershipCost(people: { adultsCount: number; halfPriceCount: number }): number {
    const memberHalf = getPrice('entry_half', 25.0);
    const memberFull = getPrice('entry_full', 49.9);
    return (people.adultsCount * memberFull) + (people.halfPriceCount * memberHalf);
  }

  const hasAnything = totals.total > 0 || booking.entry.adults.length > 0 || booking.entry.children.length > 0;

  const handleAction = async (isPrepay: boolean) => {
    // Validation Rule: Name, WhatsApp, Day of Week, and Date are mandatory
    if (!booking.entry.name?.trim() || !booking.entry.phone?.trim() || booking.entry.phone.length < 10) {
      toast({
        title: 'Informe seu nome e WhatsApp',
        description: 'Preencha o campo de Nome e WhatsApp no topo do "Day Use" antes de finalizar para enviar.',
        variant: 'destructive'
      });
      return;
    }

    if (!booking.entry.dayOfWeek) {
      toast({
        title: 'Escolha o dia da semana',
        description: 'Selecione o dia da semana na Etapa 1.',
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
    console.log("[Booking] handleAction started. isPrepay:", isPrepay);
    setSaving(true);
    try {
      const result = await saveBooking(booking, totals.total, null, items);
      console.log("[Booking] saveBooking result:", result);
      
      if (!result?.orderId) {
        throw new Error("Não foi possível gerar o ID do pedido.");
      }

      if (isPrepay === true) {
        console.log("[Booking] Entering Virtual Payment Flow");
        // ABSOLUTE BLINDAGE: Stop here and open modal
        setPaymentData({ 
          open: true, 
          orderId: result.orderId, 
          confirmationCode: result.confirmationCode 
        });
        
        toast({
          title: 'Iniciando Pagamento',
          description: 'Aguarde enquanto preparamos seu link de pagamento seguro.',
        });
        return; // EXIT FUNCTION HERE
      } 
      
      // WhatsApp / Local branch (ONLY if isPrepay is false)
      console.log("[Booking] Entering WhatsApp Flow");
      await (supabase as any).from('orders').update({ 
        status: 'waiting_local',
        updated_at: new Date().toISOString()
      }).eq('id', result.orderId);
      
      const msg = buildWhatsAppMessage(booking, totals.total, false, result.confirmationCode, getPrice);
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: 'Reserva via WhatsApp',
        description: 'Sua reserva foi enviada. Confirme os detalhes com nossa equipe.',
      });
      
    } catch (err: any) {
      console.error("[Booking] CRITICAL ERROR:", err);
      toast({ 
        title: 'Erro ao salvar', 
        description: err.message || 'Houve um problema ao salvar seu pedido.', 
        variant: 'destructive' 
      });
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
        <h3 className="font-display font-bold text-lg sm:text-xl">Resumo da Experiência</h3>
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
              {booking.entry.adults.map((a, i) => {
                const qty = a.quantity || 1;
                const price = getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo', getPrice);
                let details = [];
                if (a.isTeacher) details.push('Professor');
                if (a.isServer) details.push('Servidor');
                if (a.isStudent) details.push('Estudante');
                if (a.isPCD) details.push('PCD/TEA');
                if (a.isBirthday) details.push('Aniversariante');
                if (a.takeDonation && booking.entry.dayOfWeek !== 'domingo') details.push('Solidária');
                if (a.age >= 60) details.push('Idoso');

                return (
                  <div key={`adult-${i}`} className="flex justify-between items-start">
                    <div>
                      <span>{qty}x Adulto</span>
                      {details.length > 0 && <span className="block text-[11px] font-medium text-primary/70">{details.join(', ')}</span>}
                    </div>
                    <span className="font-medium whitespace-nowrap">{price === 0 ? 'Grátis' : formatCurrency(price * qty)}</span>
                  </div>
                );
              })}

              {booking.entry.children.map((c, i) => {
                const qty = c.quantity || 1;
                const price = getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo', getPrice);
                let details = [];
                if (c.isPCD) details.push('PCD/TEA');
                if (c.isBirthday) details.push('Aniversariante');

                return (
                  <div key={`child-${i}`} className="flex justify-between items-start mt-2">
                    <div>
                      <span>{qty}x Criança</span>
                      {details.length > 0 && <span className="block text-[11px] font-medium text-primary/70">{details.join(', ')}</span>}
                    </div>
                    <span className="font-medium whitespace-nowrap">{price === 0 ? 'Grátis' : formatCurrency(price * qty)}</span>
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
          const halfPriceAdults = allAdults.filter(a => a.isTeacher || a.isServer || a.isStudent).reduce((acc, a) => acc + (a.quantity || 1), 0);
          const fullPriceAdults = allAdults.reduce((acc, a) => acc + (a.quantity || 1), 0) - halfPriceAdults;

          // Children that pay in day use (though they are usually free < 11, the user's logic focuses more on adults)
          // For now let's assume membership pricing follows the user's explicit example with adults
          const membershipPrice = calculateMembershipCost({ adultsCount: fullPriceAdults, halfPriceCount: halfPriceAdults });
          const entriesTotal = totals.entriesTotal;

          if ((fullPriceAdults + halfPriceAdults) > 0 && entriesTotal >= membershipPrice * 0.8) {
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-sun/20 via-sun/10 to-transparent border-2 border-sun/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="text-4xl text-sun-dark font-black">⭐</span>
                </div>

                <div className="relative z-10">
                  <h4 className="font-gliker font-normal text-primary text-sm sm:text-base mb-2 flex items-center gap-2">
                    💡 Dica: Vale mais a pena ser Sócio!
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground font-medium mb-4 leading-relaxed">
                    Sua reserva de hoje custa <span className="font-bold text-primary">{formatCurrency(entriesTotal)}</span>.
                    No <span className="font-bold">Lessa Club</span>, você paga apenas <span className="font-bold text-primary-dark">{formatCurrency(membershipPrice)}/mês</span> e tem <span className="underline decoration-sun font-bold">entradas ilimitadas</span> o mês inteiro!
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-white/80 hover:bg-sun hover:text-foreground border-sun/50 font-display font-black text-[10px] sm:text-xs uppercase tracking-widest h-10 shadow-sm transition-all"
                    onClick={() => {
                      const element = document.getElementById('especiais');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    Quero ver os Planos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          }
          return null;
        })()}

        {/* Total Gigante */}
        <div className="pt-2">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                Total da Reserva
              </p>
              <h2 className="font-display font-black text-4xl sm:text-5xl text-primary leading-none">
                {formatCurrency(totals.total)}
              </h2>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleAction(false)}
              disabled={saving}
              className="flex-1 h-16 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 font-bold text-base flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5 text-green-600" />
              Confirmar no WhatsApp
            </Button>

            <Button
              size="lg"
              onClick={() => handleAction(true)}
              disabled={saving}
              className="flex-1 h-16 rounded-2xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              Já quero deixar pago
            </Button>
          </div>
        </div>

      </div>

      {paymentData && (
        <PaymentModal
          open={paymentData.open}
          onOpenChange={(op) => setPaymentData(prev => prev ? { ...prev, open: op } : null)}
          orderId={paymentData.orderId}
          name={booking.entry.name || ''}
          email={''} // Adicionado suporte de e-mail opcional no Asaas Edge function
          totalAmount={totals.total}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
