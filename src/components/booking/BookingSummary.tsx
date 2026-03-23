import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ChevronUp, MessageCircle, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { saveBooking } from '@/lib/booking-service';
import { toast } from '@/hooks/use-toast';
import {
  BookingState, KIOSK_INFO, QUAD_LABELS, QUAD_PRICES, ADDITIONAL_INFO, 
  getQuadDiscount, formatCurrency, WHATSAPP_NUMBER, getPersonPrice
} from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';

function calculateMembershipCost(payingCount: number): number {
  return payingCount * 49.9;
}

interface Props {
  booking: BookingState;
  totals: { entriesTotal: number; kiosksTotal: number; quadsTotal: number; additionalsTotal: number; total: number };
  hasItems: boolean;
}

import { buildWhatsAppMessage } from '@/lib/whatsapp';

import { useAuth } from '@/hooks/useAuth';

export function BookingSummary({ booking, totals, hasItems }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { userId } = useAuth();

  if (!hasItems) return null;

  const handleFinalize = async () => {
    if (!booking.entry.name?.trim()) {
      toast({ title: 'Informe seu nome', description: 'Preencha o campo de nome antes de finalizar.', variant: 'destructive' });
      return;
    }
    if (!booking.entry.visitDate) {
      toast({ title: 'Selecione uma data', description: 'Escolha a data da sua visita.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await saveBooking(booking, totals.total, userId);
      if (result) {
        setConfirmationCode(result.confirmationCode);
      } else {
        toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (confirmationCode) {
      await navigator.clipboard.writeText(confirmationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(booking, totals.total, false, confirmationCode || undefined))}`;
    window.open(whatsappUrl, '_blank');
    setConfirmationCode(null);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-card border-t shadow-elevated overflow-hidden"
            >
              <div className="container px-4 py-3 sm:py-4 max-h-[50vh] overflow-y-auto space-y-2 sm:space-y-3">
                <h4 className="font-display font-bold text-base sm:text-lg">Resumo da Reserva</h4>
                {booking.entry.name && <p className="text-xs sm:text-sm text-muted-foreground">👤 {booking.entry.name}</p>}
                {booking.entry.phone && <p className="text-xs sm:text-sm text-muted-foreground">📱 {booking.entry.phone}</p>}
                {booking.entry.visitDate && <p className="text-xs sm:text-sm text-muted-foreground">📅 {format(booking.entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</p>}

                {booking.entry.adults.map((a, i) => {
                  const qty = a.quantity || 1;
                  const price = getPersonPrice(a, a.age >= 60, booking.entry.dayOfWeek === 'domingo');
                  const label = a.isPCD ? 'Lessa Inclusão' : 
                               a.age >= 60 ? 'Lessa Vitalício' : 
                               a.isTeacher ? 'Lessa Professor Pass' :
                               a.isStudent ? 'Lessa Estudante Pass' :
                               a.isServer ? 'Lessa Servidor Pass' :
                               'Adulto';
                  return (
                    <div key={i} className="flex justify-between text-xs sm:text-sm">
                      <span>{qty > 1 ? `${qty}x ` : ''}{label}</span>
                      <span className="font-medium">{price === 0 ? 'Grátis' : formatCurrency(price * qty)}</span>
                    </div>
                  );
                })}

                {booking.entry.children.map((c, i) => {
                  const qty = c.quantity || 1;
                  const price = getPersonPrice(c, c.age <= 11, booking.entry.dayOfWeek === 'domingo');
                  return (
                    <div key={i} className="flex justify-between text-xs sm:text-sm">
                       <span>{qty > 1 ? `${qty}x ` : ''}Criança</span>
                      <span className="font-medium">{price === 0 ? 'Grátis' : formatCurrency(price * qty)}</span>
                    </div>
                  );
                })}

                {booking.kiosks.filter(k => k.quantity > 0).map(k => (
                  <div key={k.type} className="flex justify-between text-xs sm:text-sm">
                    <span>{k.quantity}x {KIOSK_INFO[k.type].label}</span>
                    <span className="font-medium">{formatCurrency(k.quantity * KIOSK_INFO[k.type].price)}</span>
                  </div>
                ))}

                {booking.quads.filter(q => q.quantity > 0).map(q => {
                  const discount = getQuadDiscount(q.date);
                  const final_ = QUAD_PRICES[q.type] * (1 - discount);
                  return (
                    <div key={q.type} className="text-xs sm:text-sm">
                      <div className="flex justify-between">
                        <span>{q.quantity}x Quad {QUAD_LABELS[q.type]}</span>
                        <span className="font-medium">{formatCurrency(q.quantity * final_)}</span>
                      </div>
                      {q.date && <p className="text-xs text-muted-foreground">{format(q.date, "dd/MM/yyyy", { locale: ptBR })} às {q.time || '—'}</p>}
                      {discount > 0 && <p className="text-xs text-sun font-medium">Desconto: {discount * 100}%</p>}
                    </div>
                  );
                })}

                {booking.additionals.filter(a => a.quantity > 0).map(a => (
                  <div key={a.type} className="flex justify-between text-xs sm:text-sm">
                    <span>{a.quantity}x {ADDITIONAL_INFO[a.type].label}</span>
                    <span className="font-medium">{formatCurrency(a.quantity * ADDITIONAL_INFO[a.type].price)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-card border-t shadow-elevated">
          <div className="container px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-black tracking-tighter">Total</p>
                  {(() => {
                    const payingPeople = booking.entry.adults.reduce((acc, a) => acc + (a.quantity || 1), 0);
                    const membershipPrice = calculateMembershipCost(payingPeople);
                    if (payingPeople > 0 && totals.entriesTotal >= membershipPrice * 0.8) {
                      return (
                        <div className="bg-sun text-foreground font-gliker font-black text-[7px] px-1.5 py-0.5 rounded-md animate-pulse whitespace-nowrap">
                          💡 SÓCIO É MELHOR
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <p className="font-display font-bold text-lg sm:text-xl text-primary">{formatCurrency(totals.total)}</p>
              </div>
              <ChevronUp className={`h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            <Button size="lg" onClick={handleFinalize} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-display font-bold shrink-0 px-4 sm:px-6 text-xs sm:text-sm h-10 sm:h-11">
              {saving ? <Loader2 className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <MessageCircle className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
              <span className="hidden sm:inline">Finalizar Reserva</span>
              <span className="sm:hidden">Finalizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmationCode} onOpenChange={(open) => !open && setConfirmationCode(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center">✅ Reserva Confirmada!</DialogTitle>
            <DialogDescription className="text-center">
              Guarde seu código de reserva. Apresente-o na chegada ao balneário.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-xs text-muted-foreground mb-2">Código da Reserva</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-primary bg-primary/10 px-6 py-3 rounded-xl">
                {confirmationCode}
              </span>
              <Button variant="ghost" size="icon" onClick={handleCopyCode} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-whatsapp" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              📱 Este código também será enviado na mensagem do WhatsApp
            </p>
          </div>
          <Button onClick={handleGoToWhatsApp} className="w-full bg-green-600 hover:bg-green-700 text-white font-display font-bold">
            <MessageCircle className="mr-2 h-5 w-5" />
            Enviar pelo WhatsApp
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
