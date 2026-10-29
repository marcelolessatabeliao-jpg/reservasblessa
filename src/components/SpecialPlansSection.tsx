import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calculator, Ticket, Star, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/booking-types';
import { QuantityStepper } from '@/components/QuantityStepper';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';

import { CustomFamilyCheckoutModal } from '@/components/club/CustomFamilyCheckoutModal';
import type { BillingCycle } from '@/lib/club-types';

export function SpecialPlansSection() {
  const [quantities, setQuantities] = useState({
    adult: 0,
    student: 0,
    teacher: 0,
    server: 0,
    child: 0,
    senior: 0,
    pcd: 0,
  });

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('ANNUAL');

  const payingPeople = quantities.adult + quantities.student + quantities.teacher + quantities.server;
  const totalPeople = payingPeople + quantities.child + quantities.senior + quantities.pcd;
  let planName = 'Lessa Club personalizado';
  if (payingPeople === 1 && totalPeople === 1) planName = 'Lessa Club (individual)';
  else if (totalPeople >= 2) planName = `Lessa Club Familiar (${totalPeople} pessoas)`;
  else if (payingPeople === 0) planName = 'Lessa Club';

  const totalMonthly = 
    quantities.adult * 44.91 + 
    quantities.student * 22.50 + 
    quantities.teacher * 22.50 + 
    quantities.server * 22.50;

  const totalRegularMonthly =
    quantities.adult * 49.90 +
    quantities.student * 25.00 +
    quantities.teacher * 25.00 +
    quantities.server * 25.00;

  const handleJoinClick = () => {
    if (totalPeople === 0) return;
    setIsOptionsOpen(true);
  };

  const openUnifiedCheckout = (cycle: BillingCycle) => {
    setSelectedCycle(cycle);
    setIsOptionsOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <section id="especiais" className="py-12 sm:py-24 bg-transparent">
      <div className="container px-4">
        {/* Full-width Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-foreground mb-4 leading-tight">
            Simule a mensalidade <span className="text-primary-dark">da sua Família</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-medium">
            Adicione as pessoas abaixo e descubra quanto custa ter acesso ilimitado ao Balneário Lessa durante todo o mês.
          </p>
          <div className="mt-4 inline-flex items-center gap-2.5 bg-amber-500/10 border-2 border-amber-300 text-amber-950 rounded-2xl px-5 py-3 max-w-2xl mx-auto text-xs sm:text-sm font-bold shadow-sm">
            <span className="text-base shrink-0">⚠️</span>
            <span className="leading-snug text-left sm:text-center">
              Garanta o preço atual assinando o valor referente ao Plano Anual parcelado em até 12x no cartão por mais um ano. Novos valores entrarão em vigência a partir de 2027.
            </span>
          </div>
        </motion.div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch max-w-6xl mx-auto">
          {/* Left Side: Categories */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {[
                { key: 'adult', label: 'Lessa Club', price: 44.91, prefix: 'a partir de', emoji: '🎟️', color: 'bg-gradient-to-br from-sun/10 to-sun/30 border-sun/40', badge: null },
                { key: 'student', label: 'Estudante', price: 22.50, prefix: 'a partir de', emoji: '🎓', color: 'bg-sun/5 border-sun/20', badge: '50% OFF' },
                { key: 'teacher', label: 'Professor', price: 22.50, prefix: 'a partir de', emoji: '📚', color: 'bg-green-600/5 border-green-600/20', badge: '50% OFF' },
                { key: 'server', label: 'Servidor', price: 22.50, prefix: 'a partir de', emoji: '🏛️', color: 'bg-primary/5 border-primary/20', badge: '50% OFF' },
              ].map((item) => (
                <div key={item.key} className={`flex items-center justify-between p-3 sm:p-5 rounded-2xl border shadow-sm transition-colors text-left ${item.color}`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                     <span className="text-2xl sm:text-3xl drop-shadow-sm shrink-0">{item.emoji}</span>
                     <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-nowrap overflow-visible">
                          <h4 className="font-bold text-foreground text-sm sm:text-lg leading-tight italic whitespace-nowrap pr-1">
                            {item.label}
                          </h4>
                          {item.badge && (
                            <span className="bg-emerald-600 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase not-italic tracking-wider shadow-sm shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                       <p className="text-primary font-black text-xs sm:text-sm uppercase tracking-widest">
                         {item.prefix && <span className="text-[10px] lowercase font-medium text-muted-foreground mr-1 tracking-normal">{item.prefix}</span>}
                         {formatCurrency(item.price)}
                       </p>
                     </div>
                  </div>
                  <div className="scale-90 sm:scale-100 shrink-0">
                    <QuantityStepper 
                      value={quantities[item.key as keyof typeof quantities]} 
                      onChange={(val) => setQuantities(prev => ({ ...prev, [item.key]: val }))} 
                      min={0}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 lg:mt-6 text-center lg:text-left">
              <h4 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-3 px-2">Gratuidades (Acesso Livre)</h4>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { key: 'child', label: 'Crianças\n(até 11 anos)', emoji: '👶', color: 'bg-blue-50/60 border-blue-200/60' },
                  { key: 'senior', label: 'Idosos\n(60+ anos)', emoji: '🧓', color: 'bg-fuchsia-50/60 border-fuchsia-200/60' },
                  { key: 'pcd', label: 'PCD & TEA', emoji: '♿', color: 'bg-emerald-50/60 border-emerald-200/60' },
                ].map((item) => (
                   <div key={item.key} className={`flex flex-col items-center justify-between p-2 sm:p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md text-center ${item.color}`}>
                     <div className="mb-2 sm:mb-3">
                       <span className="text-xl sm:text-3xl block mb-1 drop-shadow-sm">{item.emoji}</span>
                       <span className="font-bold text-[9px] sm:text-base text-slate-800 block leading-tight px-1 flex items-center justify-center min-h-[32px] sm:min-h-[48px] whitespace-pre-line mt-1">
                         {item.label}
                       </span>
                     </div>
                     <div className="w-full flex justify-center mt-auto scale-75 sm:scale-100">
                       <QuantityStepper 
                         value={quantities[item.key as keyof typeof quantities]} 
                         onChange={(val) => setQuantities(prev => ({ ...prev, [item.key]: val }))} 
                         min={0}
                       />
                     </div>
                   </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Side: Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-3.5 h-full"
          >
            {/* Gold Total Card */}
            <div className="bg-gradient-to-br from-[#bf953f] via-[#fcf6ba] to-[#aa771c] rounded-[32px] p-5 sm:p-8 border border-sun/50 shadow-2xl relative overflow-hidden flex-1 flex flex-col justify-center items-center group">
              {/* VANTAGEM PREMIUM Badge */}
              <div className="absolute top-0 right-0 bg-[#332200] text-[#fcf6ba] text-[11px] font-black px-5 py-2 rounded-bl-3xl shadow-xl uppercase tracking-widest z-10 border-l border-b border-white/20">
                VANTAGEM PREMIUM
              </div>

              {/* Decorative Blur */}
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
              
              <div className="relative z-10 w-full text-center mt-6">
                <p className="text-[#5c3c00] font-black uppercase tracking-widest text-[11px] sm:text-xs mb-2 opacity-80">
                  Total do {planName}
                </p>
                <div className="flex flex-col items-center justify-center mb-6">
                  <h3 className="font-display font-black text-6xl sm:text-7xl text-black tracking-tighter drop-shadow-sm">
                    {formatCurrency(totalMonthly)}
                  </h3>
                  <div className="inline-flex items-center gap-1.5 bg-black/10 px-4 py-1 rounded-full mt-2 border border-black/5">
                    <CheckCircle2 className="h-4 w-4 text-[#332200]" />
                    <span className="text-[10px] text-[#332200] font-black uppercase tracking-tight">Valor Único Mensal</span>
                  </div>
                </div>
                
                <Button 
                  size="lg" 
                  className={`bg-[#332200] text-[#fcf6ba] hover:bg-black hover:text-white font-display font-black text-base sm:text-lg h-14 rounded-2xl shadow-2xl w-full mb-6 transition-all duration-300 border border-white/10 ${totalPeople === 0 ? 'opacity-50 cursor-not-allowed hover:bg-[#332200] hover:text-[#fcf6ba]' : ''}`}
                  onClick={handleJoinClick}
                  disabled={totalPeople === 0}
                >
                   {totalPeople === 0 ? 'SELECIONE OS VISITANTES' : 'QUERO ME ASSOCIAR'} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                {/* Box de Benefício Premium */}
                <div className="bg-black/10 backdrop-blur-sm border border-black/10 rounded-2xl p-5 text-center shadow-inner">
                  <p className="text-[10px] sm:text-[11px] font-black leading-snug flex flex-col gap-2 items-center">
                    <span className="text-[#332200] flex items-center gap-2 uppercase text-[12px] tracking-tight">
                      <Star className="h-4 w-4 fill-[#332200] animate-pulse" /> O MAIOR BENEFÍCIO:
                    </span> 
                    <span className="text-[#332200] leading-relaxed font-black border-t border-black/10 pt-2 px-3 italic opacity-90">
                       Pague apenas uma vez e tenha entradas ilimitadas ao balneário o mês inteiro nos dias de funcionamento
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={payingPeople}
              className="h-auto"
            >
              <div className="bg-white p-6 rounded-[24px] border border-border shadow-xl text-left h-full relative overflow-hidden border-l-8 border-l-primary">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                
                <h4 className="font-display font-black text-primary uppercase tracking-tighter text-sm mb-4 flex items-center gap-2">
                  <Ticket className="h-5 w-5" /> RESUMO DA SIMULAÇÃO
                </h4>
                
                <div className="flex items-start gap-4 mb-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                   <div className="bg-primary/10 p-2.5 rounded-xl">
                      <Users className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                      <p className="text-xs sm:text-sm text-foreground font-bold leading-tight mb-1">
                        Total de Pessoas (Com Gratuidades)
                      </p>
                      <p className="text-primary font-black text-xl flex items-center gap-2">
                        {totalPeople} {totalPeople === 1 ? 'Pessoa' : 'Pessoas'}
                        <CheckCircle2 className="h-5 w-5 text-whatsapp" />
                      </p>
                   </div>
                </div>
                
                {(quantities.child > 0 || quantities.senior > 0 || quantities.pcd > 0) && (
                  <div className="mb-4 p-4 bg-sun/5 rounded-2xl border border-dashed border-sun/30">
                    <p className="text-[11px] sm:text-xs text-sun-dark font-bold flex items-start gap-2 leading-relaxed">
                       <span className="text-lg leading-none mt-[-2px]">🛡️</span>
                       <span>
                         Pessoas com <strong>Acesso Livre (Grátis)</strong> já estão contempladas na sua simulação e não precisam entrar no plano mensal.
                       </span>
                    </p>
                  </div>
                )}
                
                <p className="text-[10px] text-muted-foreground font-medium italic opacity-80 leading-snug">
                  * Importante: Contabilizar apenas pessoas entre 12 e 59 anos para o cálculo do plano Lessa Club.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <Dialog open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-md rounded-[2.5rem] p-6 border-sun/20 shadow-2xl bg-white outline-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary text-center mb-2 uppercase tracking-tighter">
              Escolha sua modalidade
            </DialogTitle>
            <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
              {planName} ({totalPeople} {totalPeople === 1 ? 'integrante' : 'integrantes'})
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Anual */}
            <div 
              className="bg-gradient-to-br from-[#bf953f]/10 via-[#fcf6ba]/20 to-[#aa771c]/10 border-2 border-[#bf953f]/30 p-6 rounded-3xl relative overflow-hidden shadow-sm"
            >
               <div className="absolute top-0 right-0 bg-[#bf953f] text-[#332200] text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-md">
                 10% OFF
               </div>
               <h4 className="text-[#5c3c00] font-black text-xs uppercase mb-3 flex items-center gap-2">
                 👑 PLANO ANUAL PREMIUM
               </h4>
               <div className="mb-5">
                 <p className="text-[#332200] font-black text-3xl mb-1">
                   12x de R$ {totalMonthly.toFixed(2).replace('.', ',')}
                 </p>
                 <p className="text-[10px] text-[#5c3c00] font-bold opacity-70">
                   (ou R$ {(totalMonthly * 12).toFixed(2).replace('.', ',')} à vista • Preço Congelado até 2027)
                 </p>
               </div>
               <Button
                 type="button"
                 onClick={() => openUnifiedCheckout('ANNUAL')}
                 className="w-full bg-gradient-to-r from-[#bf953f] to-[#aa771c] hover:from-[#aa771c] hover:to-[#bf953f] text-[#332200] font-black rounded-2xl h-12 shadow-lg shadow-gold/20 uppercase text-xs tracking-wider border border-white/20"
               >
                 ADERIR ANUAL (EMITIR CARTEIRINHAS)
               </Button>
            </div>

            {/* Mensal */}
            <div 
              className="bg-emerald-50/50 border-2 border-emerald-500/20 p-6 rounded-3xl shadow-sm"
            >
               <h4 className="text-emerald-900 font-black text-xs uppercase mb-3 flex items-center gap-2">
                 📅 PLANO MENSAL
               </h4>
               <div className="mb-5">
                 <p className="text-emerald-700 font-black text-3xl mb-1">
                   R$ {totalRegularMonthly.toFixed(2).replace('.', ',')} / mês
                 </p>
                 <p className="text-[10px] text-emerald-600 font-bold opacity-70">
                   Assinatura recorrente mensal sem fidelidade
                 </p>
               </div>
               <Button
                 type="button"
                 onClick={() => openUnifiedCheckout('MONTHLY')}
                 className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 uppercase text-xs tracking-wider shadow-md"
               >
                 ADERIR MENSAL (EMITIR CARTEIRINHAS)
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CustomFamilyCheckoutModal
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        initialQuantities={quantities}
        initialCycle={selectedCycle}
      />
    </section>
  );
}

