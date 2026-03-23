import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '@/hooks/useBooking';
import { EntrySelector } from '@/components/booking/EntrySelector';
import { KioskSelector } from '@/components/booking/KioskSelector';
import { QuadSelector } from '@/components/booking/QuadSelector';
import { AdditionalSelector } from '@/components/booking/AdditionalSelector';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { BookingOverview } from '@/components/booking/BookingOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ticket, Home, Bike, Fish, Trophy, ClipboardList } from 'lucide-react';

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
                  </div>
                  <span className="lg:hidden text-[9px] sm:text-[11px] font-black uppercase relative z-10 shrink-0 text-center w-full leading-tight">Resumo</span>
                </motion.button>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 animate-in fade-in-50 duration-700 min-h-[500px] bg-white/40 backdrop-blur-xl border border-white/60 p-2 sm:p-8 rounded-[2rem] lg:rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10">
              <TabsContent value="entrada" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <EntrySelector
                  entry={booking.entry}
                  onUpdateEntry={updateEntry}
                  onRemoveAdult={removeAdult}
                  onUpdateAdult={updateAdult}
                  onRemoveChild={removeChild}
                  onUpdateChild={updateChild}
                />
              </TabsContent>
              <TabsContent value="quiosques" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />
              </TabsContent>
              <TabsContent value="quads" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <QuadSelector quads={booking.quads} onUpdate={updateQuad} />
              </TabsContent>
              <TabsContent value="futebol" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <AdditionalSelector
                  additionals={booking.additionals.filter(a => a.type === 'futebol-sabao')}
                  onUpdate={(idx, updates) => {
                    const originalIndex = booking.additionals.findIndex(a => a.type === 'futebol-sabao');
                    updateAdditional(originalIndex, updates);
                  }}
                />
              </TabsContent>
              <TabsContent value="pesca" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <AdditionalSelector
                  additionals={booking.additionals.filter(a => a.type === 'pesca')}
                  onUpdate={(idx, updates) => {
                    const originalIndex = booking.additionals.findIndex(a => a.type === 'pesca');
                    updateAdditional(originalIndex, updates);
                  }}
                />
              </TabsContent>
              <TabsContent value="resumo" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <BookingOverview booking={booking} totals={totals} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <BookingSummary booking={booking} totals={totals} hasItems={hasItems} />
    </section>
  );
}
