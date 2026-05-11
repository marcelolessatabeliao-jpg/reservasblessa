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
  const [selectedPlanInfo, setSelectedPlanInfo] = useState<any>(null);

  const payingPeople = quantities.adult + quantities.student + quantities.teacher + quantities.server;
  const totalPeople = payingPeople + quantities.child + quantities.senior + quantities.pcd;
  let planName = 'Lessa Club personalizado';
  if (payingPeople === 1) planName = 'Lessa Club (individual)';
  else if (payingPeople >= 2 && payingPeople <= 5) planName = `Lessa Club (${payingPeople} pessoas)`;
  else if (payingPeople === 0) planName = 'Lessa Club';

  const getPlanLink = () => {
    // Casos especiais (1 única pessoa de categoria com desconto)
    if (payingPeople === 1) {
      if (quantities.student === 1) return 'https://cartaobl.com.br/planos/?regPlano=1211212252673382';
      if (quantities.teacher === 1) return 'https://cartaobl.com.br/planos/?regPlano=1221212252632308';
      if (quantities.server === 1) return 'https://cartaobl.com.br/planos/?regPlano=1201212252611556';
      if (quantities.adult === 1) return 'https://cartaobl.com.br/planos/?regPlano=1212252516762';
    }

    // Casos de planos por quantidade de pessoas (Adultos)
    if (quantities.adult === payingPeople) {
      if (payingPeople === 2) return 'https://cartaobl.com.br/planos/?regPlano=1051212252525908';
      if (payingPeople === 3) return 'https://cartaobl.com.br/planos/?regPlano=1061212252544284';
      if (payingPeople === 4) return 'https://cartaobl.com.br/planos/?regPlano=1151212252593723';
      if (payingPeople === 5) return 'https://cartaobl.com.br/planos/?regPlano=1231212252657405';
    }

    // Build Detailed Message
    const choices = [];
    if (quantities.adult > 0) choices.push(`${quantities.adult} Lessa Club`);
    if (quantities.student > 0) choices.push(`${quantities.student} Estudante${quantities.student > 1 ? 's' : ''}`);
    if (quantities.teacher > 0) choices.push(`${quantities.teacher} Professor${quantities.teacher > 1 ? 'es' : ''}`);
    if (quantities.server > 0) choices.push(`${quantities.server} Servidor${quantities.server > 1 ? 'es' : ''}`);
    if (quantities.child > 0) choices.push(`${quantities.child} Criança${quantities.child > 1 ? 's' : ''}`);
    if (quantities.senior > 0) choices.push(`${quantities.senior} Idoso${quantities.senior > 1 ? 's' : ''}`);
    if (quantities.pcd > 0) choices.push(`${quantities.pcd} PCD/TEA`);

    const message = `Olá! Gostaria de finalizar minha adesão ao Lessa Club baseada na minha simulação:\n\n*Resumo:*\n- Total: ${totalPeople} pessoas\n- Escolhas: ${choices.join(', ')}\n- Valor Total: ${formatCurrency(totalMonthly)}`;
    return `https://wa.me/5569992626140?text=${encodeURIComponent(message)}`;
  };

  const handleJoinClick = () => {
    if (payingPeople === 1) {
      if (quantities.student === 1) {
        setSelectedPlanInfo({
          type: 'Estudante',
          monthlyLink: 'https://cartaobl.com.br/planos/?regPlano=1211212252673382',
          annualLink: 'https://cartaobl.com.br/planos/?regPlano=1281212252613283',
          monthlyPrice: 25,
          annualInstallment: 22.50,
          annualTotal: 270
        });
        setIsOptionsOpen(true);
        return;
      }
      if (quantities.teacher === 1) {
        setSelectedPlanInfo({
          type: 'Professor',
          monthlyLink: 'https://cartaobl.com.br/planos/?regPlano=1221212252632308',
          annualLink: 'https://cartaobl.com.br/planos/?regPlano=127121225261720',
          monthlyPrice: 25,
          annualInstallment: 22.50,
          annualTotal: 270
        });
        setIsOptionsOpen(true);
        return;
      }
      if (quantities.server === 1) {
        setSelectedPlanInfo({
          type: 'Servidor',
          monthlyLink: 'https://cartaobl.com.br/planos/?regPlano=1201212252611556',
          annualLink: 'https://cartaobl.com.br/planos/?regPlano=1261212252611074',
          monthlyPrice: 25,
          annualInstallment: 22.50,
          annualTotal: 270
        });
        setIsOptionsOpen(true);
        return;
      }
    }
    
    // For other cases, use the direct link
    window.open(getPlanLink(), '_blank');
  };

  const totalMonthly = 
    quantities.adult * 49.9 + 
    quantities.student * 25 + 
    quantities.teacher * 25 + 
    quantities.server * 25;

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
                { key: 'adult', label: 'Lessa Club', price: 49.9, emoji: '🎟️', color: 'bg-gradient-to-br from-sun/10 to-sun/30 border-sun/40', badge: null },
                { key: 'student', label: 'Estudante', price: 25, emoji: '🎓', color: 'bg-sun/5 border-sun/20', badge: '50% OFF' },
                { key: 'teacher', label: 'Professor', price: 25, emoji: '📚', color: 'bg-green-600/5 border-green-600/20', badge: '50% OFF' },
                { key: 'server', label: 'Servidor', price: 25, emoji: '🏛️', color: 'bg-primary/5 border-primary/20', badge: '50% OFF' },
              ].map((item) => (
                <div key={item.key} className={`flex items-center justify-between p-3 sm:p-5 rounded-2xl border shadow-sm transition-colors text-left ${item.color}`}>
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                     <span className="text-2xl sm:text-3xl drop-shadow-sm shrink-0">{item.emoji}</span>
                     <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-nowrap">
                          <h4 className="font-bold text-foreground text-sm sm:text-lg leading-tight italic whitespace-nowrap">
                            {item.label}
                          </h4>
                          {item.badge && (
                            <span className="bg-emerald-600 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase not-italic tracking-wider shadow-sm shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                       <p className="text-primary font-black text-xs sm:text-sm uppercase tracking-widest">{formatCurrency(item.price)}</p>
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
                  { key: 'child', label: 'Crianças', emoji: '👶', color: 'bg-blue-50/60 border-blue-200/60' },
                  { key: 'senior', label: 'Idosos', emoji: '🧓', color: 'bg-fuchsia-50/60 border-fuchsia-200/60' },
                  { key: 'pcd', label: 'PCD & TEA', emoji: '♿', color: 'bg-emerald-50/60 border-emerald-200/60' },
                ].map((item) => (
                   <div key={item.key} className={`flex flex-col items-center justify-between p-2 sm:p-4 rounded-2xl border shadow-sm transition-all hover:shadow-md text-center ${item.color}`}>
                     <div className="mb-2 sm:mb-3">
                       <span className="text-xl sm:text-3xl block mb-1 drop-shadow-sm">{item.emoji}</span>
                       <span className="font-bold text-[9px] sm:text-base text-slate-800 block leading-tight px-1 flex items-center justify-center h-6 sm:h-8">
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
            {/* Green Total Card */}
            <div className="bg-primary rounded-[32px] p-5 sm:p-8 border border-primary-light shadow-xl shadow-primary/20 relative overflow-visible text-white flex-1 flex flex-col justify-center items-center mt-4 lg:mt-0">
              {/* Highlighted Simulador Badge */}
              <motion.div 
                animate={{ 
                  y: [0, -8, 0],
                  rotate: [4, 6, 4]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -top-4 -right-1 sm:-top-5 sm:-right-4 bg-sun px-5 py-1.5 sm:py-2 rounded-[20px] shadow-xl z-20 flex items-center justify-center border border-white/30"
              >
                <span className="text-sm sm:text-base tracking-tight font-black text-slate-900 drop-shadow-sm">Simulador 💸</span>
              </motion.div>
              
              <div className="relative z-10 w-full text-center mt-2 sm:mt-4">
                <p className="text-sun font-bold uppercase tracking-widest text-[10px] sm:text-xs mb-1 drop-shadow-sm">
                  Total do {planName}
                </p>
                <div className="flex items-center justify-center mb-6">
                  <h3 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl drop-shadow-md">
                    {formatCurrency(totalMonthly)}
                  </h3>
                </div>
                
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-sun hover:text-foreground font-display font-black text-base sm:text-lg h-14 rounded-xl shadow-lg w-full mb-5 transition-all duration-300"
                  onClick={handleJoinClick}
                >
                   QUERO ME ASSOCIAR <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                {/* Benefit Box */}
                <div className="bg-white/10 backdrop-blur-md border border-white/30 rounded-xl p-4 text-center shadow-inner group">
                  <p className="text-[10px] sm:text-[11px] font-black leading-tight flex flex-col gap-1.5 items-center">
                    <span className="text-sun flex items-center gap-1.5 uppercase text-[11px] tracking-tight">
                      <Star className="h-4 w-4 fill-sun animate-spin-slow" /> O MAIOR BENEFÍCIO:
                    </span> 
                    <span className="text-white leading-relaxed font-bold border-t border-white/10 pt-1.5 px-2">
                       Pague apenas uma vêz e tenha entradas ilimitadas ao balneário o mês inteiro nos dias de funcionamento
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
            <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Plano {selectedPlanInfo?.type}</p>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Anual */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-500/30 p-6 rounded-3xl relative overflow-hidden shadow-sm"
            >
               <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest shadow-md">
                 10% OFF
               </div>
               <h4 className="text-emerald-900 font-black text-xs uppercase mb-3 flex items-center gap-2">
                 💰 PLANO ANUAL COM DESCONTO
               </h4>
               <div className="mb-5">
                 <p className="text-emerald-700 font-black text-3xl mb-1">
                   12x de R$ {selectedPlanInfo?.annualInstallment?.toFixed(2).replace('.', ',')}
                 </p>
                 <p className="text-[10px] text-emerald-600 font-bold opacity-70">
                   (ou R$ {selectedPlanInfo?.annualTotal?.toFixed(2).replace('.', ',')} à vista)
                 </p>
               </div>
               <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 shadow-lg shadow-emerald-500/20 uppercase text-xs tracking-wider">
                 <a href={selectedPlanInfo?.annualLink} target="_blank" rel="noopener noreferrer">ADERIR ANUAL</a>
               </Button>
            </motion.div>

            {/* Mensal */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-slate-50 border-2 border-slate-200 p-6 rounded-3xl shadow-sm"
            >
               <h4 className="text-slate-900 font-black text-xs uppercase mb-3 flex items-center gap-2">
                 💳 PLANO MENSAL SEM DESCONTO
               </h4>
               <div className="mb-5">
                 <p className="text-slate-700 font-black text-3xl mb-1">
                   R$ {selectedPlanInfo?.monthlyPrice?.toFixed(2).replace('.', ',')} / mês
                 </p>
                 <p className="text-[10px] text-slate-500 font-bold opacity-70">
                   Assinatura recorrente mensal
                 </p>
               </div>
               <Button asChild variant="outline" className="w-full border-2 border-slate-300 text-slate-800 hover:bg-slate-100 font-black rounded-2xl h-12 uppercase text-xs tracking-wider">
                 <a href={selectedPlanInfo?.monthlyLink} target="_blank" rel="noopener noreferrer">ADERIR MENSAL</a>
               </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
