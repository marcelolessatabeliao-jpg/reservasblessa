import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '@/hooks/useBooking';
import { EntrySelector } from '@/components/booking/EntrySelector';
import { KioskSelector } from '@/components/booking/KioskSelector';
import { QuadSelector } from '@/components/booking/QuadSelector';
import { AdditionalSelector } from '@/components/booking/AdditionalSelector';
import { BookingOverview } from '@/components/booking/BookingOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Ticket, Home, Bike, Fish, Trophy, ClipboardList, ArrowRight } from 'lucide-react';

export function BookingSection() {
  const { booking, updateEntry, addAdult, removeAdult, updateAdult, addChild, removeChild, updateChild, updateKiosk, updateQuad, updateAdditional, totals, hasItems } = useBooking();
  const [activeTab, setActiveTab] = useState('entrada');

  useEffect(() => {
    const handleTabChange = (event: CustomEvent<string>) => {
      setActiveTab(event.detail);
      const element = document.getElementById('reservas');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('changeBookingTab' as any, handleTabChange as any);
    return () => window.removeEventListener('changeBookingTab' as any, handleTabChange as any);
  }, []);

  const tabItemClass = "w-full flex flex-col lg:flex-row items-center lg:items-start justify-center lg:justify-start gap-1 sm:gap-2 lg:gap-5 rounded-2xl sm:rounded-3xl data-[state=active]:bg-white/80 data-[state=active]:backdrop-blur-md data-[state=active]:shadow-xl data-[state=active]:shadow-primary/10 py-3 sm:py-6 px-1 sm:px-7 transition-all hover:bg-black/5 border border-transparent data-[state=active]:border-primary/20 group relative shrink-0";
  const iconWrapperClass = "bg-primary/5 p-2 sm:p-4 rounded-xl sm:rounded-2xl group-data-[state=active]:bg-gradient-to-br group-data-[state=active]:from-primary group-data-[state=active]:to-primary/80 group-data-[state=active]:text-white group-data-[state=active]:shadow-md transition-all relative z-10 shrink-0";

  return (
    <section id="reservas" className="relative pt-24 pb-16 sm:pt-32 sm:pb-28 bg-transparent overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-40 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/30 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-sun/30 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />

      <div className="container px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-20"
        >
          <span className="inline-block bg-primary/10 text-primary font-black text-[11px] sm:text-xs px-5 py-2 rounded-full mb-6 uppercase tracking-[0.2em] shadow-sm border border-primary/20">
            🎫 Reserve Seu Dia
          </span>
          <h2 className="font-display font-black text-4xl sm:text-5xl md:text-6xl mb-6 text-primary drop-shadow-sm leading-tight">
            Monte sua Experiência
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg font-medium leading-relaxed">
            Selecione as categorias ao lado e monte o roteiro perfeito para a sua visita ao Balneário Lessa. Nós finalizamos com você rapidamente via WhatsApp!
          </p>
        </motion.div>

        <div className="max-w-[1200px] mx-auto pb-28 sm:pb-32">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-6 sm:gap-10">
            <TabsList className="grid grid-cols-3 sm:flex sm:flex-wrap lg:flex-col lg:w-80 h-auto bg-white/40 backdrop-blur-xl p-2 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] lg:sticky lg:top-28 border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] gap-2 sm:gap-4 items-stretch overflow-hidden">
              <TabsTrigger value="entrada" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className={iconWrapperClass}>
                    <Ticket className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Etapa 1</p>
                    <p className="text-base sm:text-lg font-bold text-foreground">Day Use</p>
                  </div>
                  <span className="lg:hidden text-[11px] font-bold uppercase relative z-10 shrink-0">Entrada</span>
                </motion.button>
              </TabsTrigger>

              <TabsTrigger value="quiosques" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className="absolute -top-1 -right-2 z-20">
                    <div className="bg-sun text-foreground font-black text-[7px] sm:text-[7.5px] px-2 py-0.5 rounded-lg shadow-md transform rotate-3 border border-white/30 whitespace-nowrap uppercase tracking-tighter">
                      SOB RESERVA
                    </div>
                  </div>
                  <div className={iconWrapperClass}>
                    <Home className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Conforto</p>
                    <p className="text-base sm:text-lg font-bold text-foreground">Quiosques</p>
                  </div>
                  <span className="lg:hidden text-[11px] font-bold uppercase relative z-10 shrink-0">Quiosque</span>
                </motion.button>
              </TabsTrigger>

              <TabsTrigger value="quads" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className="absolute -top-1 -right-2 z-20">
                    <div className="bg-sun text-foreground font-black text-[7px] sm:text-[7.5px] px-2 py-0.5 rounded-lg shadow-md transform rotate-3 border border-white/30 whitespace-nowrap uppercase tracking-tighter">
                      GANHE DESCONTO
                    </div>
                  </div>
                  <div className={iconWrapperClass}>
                    <Bike className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Aventura</p>
                    <p className="text-base sm:text-lg font-bold text-foreground">Quadriciclo</p>
                  </div>
                  <span className="lg:hidden text-[11px] font-bold uppercase relative z-10 shrink-0">Quad</span>
                </motion.button>
              </TabsTrigger>

              <TabsTrigger value="futebol" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className={iconWrapperClass}>
                    <Trophy className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Diversão</p>
                    <p className="text-base sm:text-lg font-bold text-foreground truncate">Fut. Sabão</p>
                  </div>
                  <span className="lg:hidden text-[11px] font-bold uppercase relative z-10 shrink-0">Futebol</span>
                </motion.button>
              </TabsTrigger>

              <TabsTrigger value="pesca" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className={iconWrapperClass}>
                    <Fish className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Lazer</p>
                    <p className="text-base sm:text-lg font-bold text-foreground truncate">Pesca Esp.</p>
                  </div>
                  <span className="lg:hidden text-[11px] font-bold uppercase relative z-10 shrink-0">Pesca</span>
                </motion.button>
              </TabsTrigger>

              <TabsTrigger value="resumo" asChild className={tabItemClass}>
                <motion.button whileTap={{ scale: 0.98 }}>
                  <div className={iconWrapperClass}>
                    <ClipboardList className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <div className="text-left hidden lg:block relative z-10 min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-data-[state=active]:text-primary/70">Finalizar</p>
                    <p className="text-base sm:text-lg font-bold text-foreground">Resumo</p>
          {/* Replaced Tabs with a stepper-like structure */}
          <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            {/* Step 1: Entry */}
            <div className={cn("bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-4 transition-all", activeTab !== 'entrada' && "opacity-50 grayscale-[0.5] max-h-[100px] overflow-hidden cursor-pointer")} onClick={() => activeTab !== 'entrada' && setActiveTab('entrada')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">1</div>
                  <h3 className="font-gliker text-xl text-primary">Data e Participantes</h3>
                </div>
                {activeTab !== 'entrada' && <Button variant="ghost" size="sm" className="font-bold">Alterar</Button>}
              </div>
              
              {activeTab === 'entrada' && (
                <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <EntrySelector
                    entry={booking.entry}
                    onUpdateEntry={updateEntry}
                    onRemoveAdult={removeAdult}
                    onUpdateAdult={updateAdult}
                    onRemoveChild={removeChild}
                    onUpdateChild={updateChild}
                  />
                  <div className="mt-8 flex justify-end">
                    <Button 
                      disabled={!booking.entry.visitDate || (booking.entry.adults.length === 0 && booking.entry.children.length === 0)}
                      onClick={(e) => { e.stopPropagation(); setActiveTab('quiosques'); }}
                      className="bg-primary text-white font-black h-12 px-8 rounded-xl shadow-lg"
                    >
                      Próximo Passo: Quiosques <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Kiosks */}
            <div className={cn("bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-4 transition-all", activeTab !== 'quiosques' && "opacity-50 grayscale-[0.5] max-h-[100px] overflow-hidden cursor-pointer")} onClick={() => activeTab !== 'quiosques' && setActiveTab('quiosques')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">2</div>
                  <h3 className="font-gliker text-xl text-primary">Quiosques</h3>
                </div>
                {activeTab !== 'quiosques' && <Button variant="ghost" size="sm" className="font-bold">Alterar</Button>}
              </div>

              {activeTab === 'quiosques' && (
                <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />
                  <div className="mt-8 flex justify-between">
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setActiveTab('entrada'); }}>Voltar</Button>
                    <Button 
                      onClick={(e) => { e.stopPropagation(); setActiveTab('quads'); }}
                      className="bg-primary text-white font-black h-12 px-8 rounded-xl shadow-lg"
                    >
                      Próximo Passo: Quadriciclos <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Quads */}
            <div className={cn("bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-4 transition-all", activeTab !== 'quads' && "opacity-50 grayscale-[0.5] max-h-[100px] overflow-hidden cursor-pointer")} onClick={() => activeTab !== 'quads' && setActiveTab('quads')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">3</div>
                  <h3 className="font-gliker text-xl text-primary">Quadriciclos</h3>
                </div>
                {activeTab !== 'quads' && <Button variant="ghost" size="sm" className="font-bold">Alterar</Button>}
              </div>

              {activeTab === 'quads' && (
                <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <QuadSelector quads={booking.quads} onUpdate={updateQuad} />
                  <div className="mt-8 flex justify-between">
                    <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setActiveTab('quiosques'); }}>Voltar</Button>
                    <Button 
                      onClick={(e) => { e.stopPropagation(); setActiveTab('futebol'); }}
                      className="bg-primary text-white font-black h-12 px-8 rounded-xl shadow-lg"
                    >
                      Próximo Passo: Futebol <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Futebol & Adicionais */}
            <div className={cn("bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-4 transition-all", activeTab !== 'futebol' && activeTab !== 'pesca' && activeTab !== 'resumo' && "opacity-50 grayscale-[0.5] max-h-[100px] overflow-hidden")} onClick={() => activeTab === 'futebol' || activeTab === 'pesca' ? null : setActiveTab('futebol')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">4</div>
                  <h3 className="font-gliker text-xl text-primary">Serviços Adicionais</h3>
                </div>
              </div>

              {(activeTab === 'futebol' || activeTab === 'pesca') && (
                <div className="pt-4 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-widest pl-2">Diversão e Pesca</h4>
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

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setActiveTab('quads')}>Voltar</Button>
                    <Button 
                      onClick={() => setActiveTab('resumo')}
                      className="bg-primary text-white font-black h-14 px-10 rounded-2xl shadow-xl text-lg"
                    >
                      Ver Resumo Final <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 5: Summary */}
            <div className={cn("bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-4 transition-all", activeTab !== 'resumo' && "opacity-50 grayscale-[0.5] max-h-[100px] overflow-hidden")} onClick={() => activeTab === 'resumo' && setActiveTab('resumo')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">5</div>
                  <h3 className="font-gliker text-xl text-primary">Resumo da Reserva</h3>
                </div>
              </div>

              {activeTab === 'resumo' && (
                <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <BookingOverview booking={booking} totals={totals} />
                  <div className="mt-8">
                    <Button variant="ghost" onClick={() => setActiveTab('futebol')}>← Voltar para Opções</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```
