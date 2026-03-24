import { useState, useEffect } from 'react';
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

type Step = 'dados' | 'entradas' | 'extras' | 'pagamento';

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

  // Smooth scroll to top of section on step change
  useEffect(() => {
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

  const isStepDone = (step: Step) => completedSteps.includes(step);

  return (
    <section id="reservas" className="relative pt-6 pb-12 sm:pt-32 sm:pb-28 bg-[#f8fafc] min-h-screen">
      {/* Background decoration - only desktop */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40 hidden sm:block">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-sun/10 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-8 px-2">
          <h2 className="font-display font-black text-3xl sm:text-5xl md:text-6xl mb-4 text-primary drop-shadow-sm leading-tight text-balance">
            Agende sua Experiência
          </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Fácil, rápido e seguro.</p>
          </div>

          {/* Step Indicator - Simplificado para Mobile */}
          <div className="mb-8 px-4">
             <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] font-black uppercase text-primary/60 tracking-widest">
                   Etapa {currentStep === 'dados' ? 1 : currentStep === 'extras' ? 2 : 3} de 3
                </span>
                <h2 className="font-gliker text-2xl text-primary text-center">
                  {currentStep === 'dados' ? 'Quem vai e Quando?' : 
                   currentStep === 'extras' ? 'Adicionar Extras?' : 'Resumo e Pagamento'}
                </h2>
             </div>
             <div className="w-full bg-muted h-1.5 rounded-full mt-4 overflow-hidden max-w-[200px] mx-auto">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: currentStep === 'dados' ? '33%' : currentStep === 'extras' ? '66%' : '100%' }}
                />
             </div>
          </div>

          <div className="w-full bg-muted h-1 rounded-full mb-12 relative overflow-hidden hidden sm:block">
            <motion.div 
               className="absolute top-0 left-0 h-full bg-primary"
               initial={{ width: "0%" }}
               animate={{ width: currentStep === 'dados' ? '12.5%' : currentStep === 'entradas' ? '37.5%' : currentStep === 'extras' ? '62.5%' : '87.5%' }}
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
                  <div className="bg-white p-5 rounded-3xl border border-primary/5 shadow-sm space-y-4">
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <Label className="font-bold text-[10px] uppercase text-primary/60 pl-1">Nome Completo</Label>
                           <Input 
                             placeholder="Nome do responsável" 
                             className="h-16 rounded-2xl border-2 focus:border-primary text-base font-medium"
                             value={booking.entry.name}
                             onChange={(e) => updateEntry({ name: e.target.value })}
                           />
                        </div>
                        <div className="space-y-1.5">
                           <Label className="font-bold text-[10px] uppercase text-primary/60 pl-1">WhatsApp</Label>
                           <Input 
                             placeholder="(00) 00000-0000" 
                             className="h-16 rounded-2xl border-2 focus:border-primary text-base font-medium"
                             value={booking.entry.phone}
                             onChange={(e) => updateEntry({ phone: e.target.value })}
                           />
                        </div>
                     </div>

                     <div className="pt-2 border-t border-dashed border-muted mt-4">
                        <Label className="font-bold text-[10px] uppercase text-primary/60 pl-1 mb-2 block">Data da Visita</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full h-16 justify-start text-left font-medium text-base rounded-2xl border-2 bg-muted/20",
                                        !booking.entry.visitDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                                    {booking.entry.visitDate ? format(booking.entry.visitDate, "PPP", { locale: ptBR }) : <span>Clique para escolher o dia</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <Calendar
                                    mode="single"
                                    selected={booking.entry.visitDate}
                                    onSelect={(date) => updateEntry({ visitDate: date })}
                                    disabled={(date) => date < new Date() || !isOperatingDay(date)} 
                                    initialFocus
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                     </div>
                  </div>

                  <EntrySelector
                    entry={booking.entry}
                    onUpdateEntry={updateEntry}
                    onRemoveAdult={removeAdult}
                    onUpdateAdult={updateAdult}
                    onRemoveChild={removeChild}
                    onUpdateChild={updateChild}
                    hideMainInfo={true}
                    hideTitle={true}
                  />

                  <div className="pt-6 flex justify-center px-4">
                    <Button 
                      size="lg"
                      disabled={!booking.entry.name || !booking.entry.phone || !booking.entry.visitDate || (booking.entry.adults.length === 0 && booking.entry.children.length === 0)}
                      onClick={() => nextStep('extras')}
                      className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-16 px-12 rounded-2xl shadow-xl shadow-primary/20 text-lg group"
                    >
                      Continuar Agendamento <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              )}



              {currentStep === 'extras' && (
                <motion.div
                  key="extras"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Sparkles className="h-5 w-5" /></div>
                    <h3 className="font-gliker text-2xl text-primary">Deseja adicionar mais algo?</h3>
                  </div>

                  <div className="space-y-12">
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 pl-2 border-l-4 border-sun">
                           <Home className="h-5 w-5 text-secondary" />
                           <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Quiosques para seu conforto</h4>
                        </div>
                        <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center gap-2 pl-2 border-l-4 border-primary">
                           <Bike className="h-5 w-5 text-primary" />
                           <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Aventura com Quadriciclo</h4>
                        </div>
                        <QuadSelector quads={booking.quads} onUpdate={updateQuad} />
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center gap-2 pl-2 border-l-4 border-secondary">
                           <Fish className="h-5 w-5 text-secondary" />
                           <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Diversão e Pesca</h4>
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
                        <Button variant="ghost" onClick={() => prevStep('entradas')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
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
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><ClipboardList className="h-5 w-5" /></div>
                    <h3 className="font-gliker text-2xl text-primary">Resumo da Experiência</h3>
                  </div>

                  <div className="bg-primary/5 rounded-3xl p-3 sm:p-8 border border-primary/10">
                    <BookingOverview booking={booking} totals={totals} />
                  </div>

                  <div className="pt-6 flex justify-center px-4">
                    <Button variant="ghost" onClick={() => prevStep('extras')} className="w-full sm:w-auto font-bold text-muted-foreground h-12"><ArrowLeft className="mr-2 h-4 w-4" /> Alterar Pedido</Button>
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
