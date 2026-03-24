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
  };

  const prevStep = (step: Step) => {
    setCurrentStep(step);
  };

  const isStepDone = (step: Step) => completedSteps.includes(step);

  return (
    <section id="reservas" className="relative pt-24 pb-16 sm:pt-32 sm:pb-28 bg-[#f8fafc] overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-sun/10 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-10">
          <h2 className="font-display font-black text-4xl sm:text-5xl md:text-6xl mb-6 text-primary drop-shadow-sm leading-tight">
            Monte sua Experiência
          </h2>
            <p className="text-muted-foreground font-medium">Siga os passos abaixo para garantir seu dia no paraíso.</p>
          </div>

          {/* Checkout Steps Indicator */}
          <div className="flex justify-between items-center mb-12 px-2 sm:px-10 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2 z-0 hidden sm:block" />
            
            {[
              { id: 'dados', icon: User, label: 'Dados' },
              { id: 'entradas', icon: Ticket, label: 'Entradas' },
              { id: 'extras', icon: Fish, label: 'Extras' },
              { id: 'pagamento', icon: ClipboardList, label: 'Checkout' }
            ].map((s, idx) => {
              const Icon = s.icon;
              const active = currentStep === s.id;
              const done = isStepDone(s.id as Step);
              
              return (
                <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-4",
                    active ? "bg-primary text-white border-primary shadow-lg scale-110" : 
                    done ? "bg-white text-primary border-primary" : "bg-white text-muted-foreground border-muted"
                  )}>
                    {done ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={cn(
                    "text-[10px] sm:text-xs font-black uppercase tracking-widest",
                    active ? "text-primary" : "text-muted-foreground"
                  )}>{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 p-6 sm:p-10 min-h-[500px]">
            <AnimatePresence mode="wait">
              {currentStep === 'dados' && (
                <motion.div
                  key="dados"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary/10 rounded-lg text-primary"><User className="h-5 w-5" /></div>
                      <h3 className="font-gliker text-2xl text-primary">Identificação</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Nome Completo</Label>
                        <Input 
                          placeholder="Como podemos te chamar?" 
                          className="h-14 rounded-xl border-2 focus:border-primary text-lg font-medium"
                          value={booking.entry.name}
                          onChange={(e) => updateEntry({ name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">WhatsApp / Celular</Label>
                        <Input 
                          placeholder="(00) 00000-0000" 
                          className="h-14 rounded-xl border-2 focus:border-primary text-lg font-medium"
                          value={booking.entry.phone}
                          onChange={(e) => updateEntry({ phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end">
                    <Button 
                      size="lg"
                      disabled={!booking.entry.name || !booking.entry.phone}
                      onClick={() => nextStep('entradas')}
                      className="bg-primary hover:bg-primary-dark text-white font-black h-16 px-12 rounded-2xl shadow-xl shadow-primary/20 text-lg group"
                    >
                      Continuar <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 'entradas' && (
                <motion.div
                  key="entradas"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Ticket className="h-5 w-5" /></div>
                    <h3 className="font-gliker text-2xl text-primary">Para quando e quem vai?</h3>
                  </div>

                  <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-5 sm:p-6 shadow-xl mb-6">
                    <div className="space-y-2">
                        <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Selecione a Data da Visita</Label>
                        <p className="text-[10px] text-muted-foreground mb-2 font-medium italic">* Funcionamento: Sexta a Segunda</p>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full h-14 justify-start text-left font-medium text-lg rounded-xl border-2",
                                        !booking.entry.visitDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-5 w-5 text-primary" />
                                    {booking.entry.visitDate ? format(booking.entry.visitDate, "PPP", { locale: ptBR }) : <span>Clique aqui e selecione o dia</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={booking.entry.visitDate}
                                    onSelect={(date) => updateEntry({ visitDate: date })}
                                    disabled={(date) => date < new Date() || !isOperatingDay(date)} 
                                    initialFocus
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
                    hideMainInfo={true} // Vamos esconder os campos que já pedimos no passo 1
                  />

                  <div className="pt-6 flex justify-between items-center bg-muted/30 p-4 rounded-2xl border border-muted">
                    <Button variant="ghost" onClick={() => prevStep('dados')} className="font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    <Button 
                      size="lg"
                      disabled={booking.entry.adults.length === 0 && booking.entry.children.length === 0}
                      onClick={() => nextStep('extras')}
                      className="bg-primary hover:bg-primary-dark text-white font-black h-14 px-10 rounded-2xl shadow-lg"
                    >
                      Próximo: Extras <ArrowRight className="ml-2 h-5 w-5" />
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

                  <div className="pt-6 flex justify-between items-center bg-muted/30 p-4 rounded-2xl border border-muted">
                    <Button variant="ghost" onClick={() => prevStep('entradas')} className="font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => nextStep('pagamento')} className="font-bold h-14 px-8 rounded-2xl border-2">Pular Extras</Button>
                        <Button 
                          size="lg"
                          onClick={() => nextStep('pagamento')}
                          className="bg-primary hover:bg-primary-dark text-white font-black h-14 px-10 rounded-2xl shadow-lg"
                        >
                          Próximo: Resumo <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
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

                  <div className="bg-primary/5 rounded-[2rem] p-4 sm:p-8 border border-primary/10 shadow-inner">
                    <BookingOverview booking={booking} totals={totals} />
                  </div>

                  <div className="pt-4 flex justify-start">
                    <Button variant="ghost" onClick={() => prevStep('extras')} className="font-bold text-muted-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Alterar Pedido</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <p className="text-center mt-8 text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
             <CheckCircle2 className="h-3 w-3 text-primary" /> Checkout Seguro & Processamento Garantido
          </p>
        </div>
      </div>
    </section>
  );
}
