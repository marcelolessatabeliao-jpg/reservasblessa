import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBooking } from '@/hooks/useBooking';
import { EntrySelector } from '@/components/booking/EntrySelector';
import { KioskSelector } from '@/components/booking/KioskSelector';
import { QuadSelector } from '@/components/booking/QuadSelector';
import { AdditionalSelector } from '@/components/booking/AdditionalSelector';
import { BookingOverview } from '@/components/booking/BookingOverview';
import { formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  User, 
  Ticket, 
  Home, 
  Bike, 
  Fish, 
  ClipboardList, 
  ArrowRight, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { formatPhone, unformatPhone } from '@/lib/utils/format';

type Step = 'dados' | 'quiosques' | 'quads' | 'servicos' | 'pagamento';

export function BookingSection() {
  const { 
    booking, 
    updateEntry, 
    removeAdult, 
    updateAdult, 
    removeChild, 
    updateChild, 
    updateKiosk, 
    updateQuad, 
    updateAdditional, 
    totals 
  } = useBooking();

  const [currentStep, setCurrentStep] = useState<Step>('dados');
  const [completedSteps, setCompletedSteps] = useState<Step[]>([]);
  const isFirstMount = useRef(true);

  // Smooth scroll to top of section on step change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const element = document.getElementById('reservas');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentStep]);

  const nextStep = (step: Step) => {
    setCompletedSteps(prev => prev.includes(currentStep) ? prev : [...prev, currentStep]);
    setCurrentStep(step);
    // Scroll to top of the booking area
    const element = document.getElementById('reservas-content');
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const prevStep = (step: Step) => {
    setCurrentStep(step);
  };

  // Sync dates for kiosks and quads whenever main visit date changes
  useEffect(() => {
    if (!booking.entry.visitDate) return;

    const mainDate = booking.entry.visitDate.getTime();
    
    // Use a flag to check if any update is actually needed to avoid loops
    let needsKioskUpdate = false;
    booking.kiosks.forEach((k) => {
      if (k.quantity > 0 && (!k.date || k.date.getTime() !== mainDate)) {
        needsKioskUpdate = true;
      }
    });

    let needsQuadUpdate = false;
    booking.quads.forEach((q) => {
      if (q.quantity > 0 && (!q.date || q.date.getTime() !== mainDate)) {
        needsQuadUpdate = true;
      }
    });

    if (needsKioskUpdate) {
      booking.kiosks.forEach((k, i) => {
        if (k.quantity > 0 && (!k.date || k.date.getTime() !== mainDate)) {
          updateKiosk(i, { date: booking.entry.visitDate });
        }
      });
    }

    if (needsQuadUpdate) {
      booking.quads.forEach((q, i) => {
        if (q.quantity > 0 && (!q.date || q.date.getTime() !== mainDate)) {
          updateQuad(i, { date: booking.entry.visitDate });
        }
      });
    }
  }, [booking.entry.visitDate, updateKiosk, updateQuad]); // Removed booking.kiosks/quads from deps to prevent loop

  // Handle external "Reservar" button clicks
  useEffect(() => {
    const handleTabChange = () => {
      const element = document.getElementById('reservas');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('changeBookingTab', handleTabChange);
    return () => window.removeEventListener('changeBookingTab', handleTabChange);
  }, []);

  const isStepDone = (step: Step) => completedSteps.includes(step);

  return (
    <section id="reservas" className="relative pt-6 pb-12 sm:pt-32 sm:pb-28 bg-transparent min-h-screen">
      {/* Background decoration - only desktop */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40 hidden sm:block">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-sun/10 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-10 px-2">
            <h2 className="font-sans font-black text-3xl sm:text-5xl md:text-6xl mb-4 text-emerald-950 drop-shadow-xl leading-tight text-balance italic">
              Agende sua Experiência
            </h2>
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border border-emerald-200/50 shadow-md">
              <Sparkles className="h-3 w-3 animate-pulse text-sun" /> Reservas em menos de 1 minuto
            </div>
          </div>

          {/* Step Indicator - Simplificado para Mobile */}
          <div className="mb-8 px-4">
             <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] font-bold uppercase text-primary/60 tracking-widest">
                   Etapa {currentStep === 'dados' ? 1 : currentStep === 'quiosques' ? 2 : currentStep === 'quads' ? 3 : currentStep === 'servicos' ? 4 : 5} de 5
                </span>
                <h2 className="font-sans font-semibold text-2xl text-primary text-center">
                  {currentStep === 'dados' ? 'Quem vai e Quando?' : 
                   currentStep === 'quiosques' ? 'Escolha seu Quiosque' :
                   currentStep === 'quads' ? 'Aventura de Quadriciclo' :
                   currentStep === 'servicos' ? 'Diversão e Pesca' : 
                   'Resumo e Pagamento'}
                </h2>
             </div>
             <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden max-w-[200px] mx-auto">
                <div 
                   className="h-full bg-primary transition-all duration-500" 
                   style={{ width: currentStep === 'dados' ? '20%' : currentStep === 'quiosques' ? '40%' : currentStep === 'quads' ? '60%' : currentStep === 'servicos' ? '80%' : '100%' }}
                />
             </div>
          </div>

          <div className="w-full bg-muted h-1 rounded-full mb-12 relative overflow-hidden hidden sm:block">
            <motion.div 
               className="absolute top-0 left-0 h-full bg-primary"
               initial={{ width: "0%" }}
               animate={{ width: currentStep === 'dados' ? '10%' : currentStep === 'quiosques' ? '30%' : currentStep === 'quads' ? '50%' : currentStep === 'servicos' ? '70%' : '100%' }}
               transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>

          {/* Step Content */}
          <div id="reservas-content" className="bg-transparent sm:bg-white rounded-none sm:rounded-[2.5rem] p-0 sm:p-10 min-h-[400px]">
            <AnimatePresence mode="wait">
              {currentStep === 'dados' && (
                <motion.div
                  key="dados"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <EntrySelector
                    entry={booking.entry}
                    onUpdateEntry={updateEntry}
                    onRemoveAdult={removeAdult}
                    onUpdateAdult={updateAdult}
                    onRemoveChild={removeChild}
                    onUpdateChild={updateChild}
                    hideMainInfo={false}
                    hideTitle={true}
                  />

                  <div className="pt-6 flex justify-center px-4">
                    <Button 
                      size="lg"
                      disabled={!booking.entry.name || !booking.entry.phone || !booking.entry.visitDate || (booking.entry.adults.length === 0 && booking.entry.children.length === 0)}
                      onClick={() => nextStep('quiosques')}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-bold h-16 px-12 rounded-2xl shadow-xl shadow-primary/20 text-lg group"
                    >
                      Continuar Agendamento <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 'quiosques' && (
                <motion.div
                  key="quiosques"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                           <button
                             onClick={() => prevStep('dados')}
                             className="p-2 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
                             title="Voltar"
                           >
                             <ArrowLeft className="h-4 w-4" />
                           </button>
                           <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm shadow-secondary/10"><Home className="h-6 w-6" /></div>
                           <div>
                              <h3 className="font-gliker text-2xl text-emerald-950">Quiosques para seu conforto</h3>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Garanta um espaço exclusivo para sua família</p>
                           </div>
                        </div>
                        <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />
                     </div>
                  </div>

                  <div className="pt-8 flex flex-col gap-4 items-center px-4">
                    <Button 
                      size="lg"
                      onClick={() => nextStep('quads')}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-16 px-10 rounded-2xl shadow-lg order-1"
                    >
                      Continuar Agendamento <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-2">
                        <Button variant="outline" onClick={() => nextStep('quads')} className="w-full sm:w-auto font-bold h-12 px-8 rounded-2xl border-2">Pular Quiosques</Button>
                        <Button variant="ghost" onClick={() => prevStep('dados')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"> <ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 'quads' && (
                <motion.div
                  key="quads"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                           <button
                             onClick={() => prevStep('quiosques')}
                             className="p-2 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
                             title="Voltar"
                           >
                             <ArrowLeft className="h-4 w-4" />
                           </button>
                           <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm shadow-primary/10"><Bike className="h-6 w-6" /></div>
                           <div>
                              <h3 className="font-gliker text-2xl text-emerald-950">Aventura e Diversão</h3>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Passeios incríveis com quadriciclo</p>
                           </div>
                        </div>
                        <QuadSelector quads={booking.quads} onUpdate={updateQuad} />
                     </div>
                  </div>

                  <div className="pt-8 flex flex-col gap-4 items-center px-4">
                    <Button 
                      size="lg"
                      onClick={() => nextStep('servicos')}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-16 px-10 rounded-2xl shadow-lg order-1"
                    >
                      Continuar Agendamento <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-2">
                        <Button variant="outline" onClick={() => nextStep('servicos')} className="w-full sm:w-auto font-bold h-12 px-8 rounded-2xl border-2">Pular Quadriciclo</Button>
                        <Button variant="ghost" onClick={() => prevStep('quiosques')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"> <ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 'servicos' && (
                <motion.div
                  key="servicos"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="space-y-8">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-6">
                           <button
                             onClick={() => prevStep('quads')}
                             className="p-2 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
                             title="Voltar"
                           >
                             <ArrowLeft className="h-4 w-4" />
                           </button>
                           <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm shadow-secondary/10"><Fish className="h-6 w-6" /></div>
                           <div>
                              <h3 className="font-gliker text-2xl text-emerald-950">Outros Serviços</h3>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pesca esportiva e futebol de sabão</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <AdditionalSelector
                            additionals={booking.additionals.filter(a => a.type === 'futebol-sabao')}
                            onUpdate={(idx, updates) => {
                              const originalIndex = booking.additionals.findIndex(a => a.type === 'futebol-sabao');
                              updateAdditional(originalIndex, updates);
                            }}
                          />
                          <AdditionalSelector
                            additionals={booking.additionals.filter(a => a.type === 'pesca')}
                            onUpdate={(idx, updates) => {
                              const originalIndex = booking.additionals.findIndex(a => a.type === 'pesca');
                              updateAdditional(originalIndex, updates);
                            }}
                          />
                        </div>
                     </div>
                  </div>

                  <div className="pt-8 flex flex-col gap-4 items-center px-4">
                    <Button 
                      size="lg"
                      onClick={() => nextStep('pagamento')}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-16 px-10 rounded-2xl shadow-lg order-1"
                    >
                      Finalizar Agendamento <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-2">
                        <Button variant="outline" onClick={() => nextStep('pagamento')} className="w-full sm:w-auto font-bold h-12 px-8 rounded-2xl border-2">Pular Extras</Button>
                        <Button variant="ghost" onClick={() => prevStep('quads')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"> <ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 'pagamento' && (
                <motion.div
                  key="pagamento"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => prevStep('servicos')}
                      className="p-2 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shrink-0"
                      title="Voltar"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><ClipboardList className="h-5 w-5" /></div>
                    <h3 className="font-gliker text-2xl text-primary">Resumo da Experiência</h3>
                  </div>

                  <div className="bg-primary/5 rounded-3xl p-3 sm:p-8 border border-primary/10">
                    <BookingOverview booking={booking} totals={totals} updateEntry={updateEntry} />
                  </div>

                  <div className="pt-6 flex justify-center px-4">
                    <Button variant="ghost" onClick={() => prevStep('servicos')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"><ArrowLeft className="mr-2 h-4 w-4" /> Alterar Pedido</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <p className="text-center mt-8 text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
             <CheckCircle2 className="h-3 w-3 text-primary" /> Agendamento Seguro & Processamento Garantido
          </p>
        </div>
      </div>
    </section>
  );
}
