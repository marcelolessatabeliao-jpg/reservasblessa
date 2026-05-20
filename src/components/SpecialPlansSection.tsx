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

    // Case: 1 Lessa Club + 1 Dependent (Student, Teacher or Server)
    if (quantities.adult === 1 && payingPeople === 2) {
      if (quantities.student === 1 || quantities.teacher === 1 || quantities.server === 1) {
        return 'https://cartaobl.com.br/planos/?regPlano=1241212252690163';
      }
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
    if (quantities.adult > 0) choices.push(`- ${quantities.adult} Lessa Club`);
    if (quantities.student > 0) choices.push(`- ${quantities.student} Estudante${quantities.student > 1 ? 's' : ''}`);
    if (quantities.teacher > 0) choices.push(`- ${quantities.teacher} Professor${quantities.teacher > 1 ? 'es' : ''}`);
    if (quantities.server > 0) choices.push(`- ${quantities.server} Servidor${quantities.server > 1 ? 'es' : ''}`);
    if (quantities.child > 0) choices.push(`- ${quantities.child} Criança${quantities.child > 1 ? 's' : ''} (Acesso Livre)`);
    if (quantities.senior > 0) choices.push(`- ${quantities.senior} Idoso${quantities.senior > 1 ? 's' : ''} (Acesso Livre)`);
    if (quantities.pcd > 0) choices.push(`- ${quantities.pcd} PCD/TEA (Acesso Livre)`);

    const choicesText = choices.length > 0 ? choices.join('\n') : '- Nenhuma opção selecionada';

    const message = `Olá! Gostaria de finalizar minha adesão ao Lessa Club baseada na minha simulação:\n\n*Resumo da Adesão:*\n- Total de Pessoas: ${totalPeople}\n- Valor Total: ${formatCurrency(totalMonthly)}\n\n*Escolhas Detalhadas:*\n${choicesText}\n\n*Plano Recomendado:* ${planName}`;
    return `https://wa.me/5569992626140?text=${encodeURIComponent(message)}`;
  };

  const handleJoinClick = () => {
    if (totalPeople === 0) return;
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
      if (quantities.adult === 1) {
        setSelectedPlanInfo({
          type: 'Individual',
          monthlyLink: 'https://cartaobl.com.br/planos/?regPlano=1212252516762',
          annualLink: 'https://cartaobl.com.br/planos/?regPlano=1291212252694389',
          monthlyPrice: 49.90,
          annualInstallment: 44.91,
          annualTotal: 538.92
        });
        setIsOptionsOpen(true);
        return;
      }
    }

    // Case: 1 Lessa Club + 1 Dependent (Student, Teacher or Server)
    if (quantities.adult === 1 && payingPeople === 2) {
      if (quantities.student === 1 || quantities.teacher === 1 || quantities.server === 1) {
        window.open('https://cartaobl.com.br/planos/?regPlano=1241212252690163', '_blank');
        return;
      }
    }

    // Modal logic for Lessa Club 2-5 adults (only adults)
    if (quantities.adult === payingPeople && payingPeople >= 2 && payingPeople <= 5) {
      const plans = {
        2: { monthly: 99.80, installment: 89.82, total: 1077.84, mLink: 'https://cartaobl.com.br/planos/?regPlano=1051212252525908', aLink: 'https://cartaobl.com.br/planos/?regPlano=130121225265226' },
        3: { monthly: 149.70, installment: 134.73, total: 1616.76, mLink: 'https://cartaobl.com.br/planos/?regPlano=1061212252544284', aLink: 'https://cartaobl.com.br/planos/?regPlano=1311212252636769' },
        4: { monthly: 199.60, installment: 179.64, total: 2155.68, mLink: 'https://cartaobl.com.br/planos/?regPlano=1151212252593723', aLink: 'https://cartaobl.com.br/planos/?regPlano=1321212252666626' },
        5: { monthly: 249.50, installment: 224.55, total: 2694.60, mLink: 'https://cartaobl.com.br/planos/?regPlano=1231212252657405', aLink: 'https://cartaobl.com.br/planos/?regPlano=1331212252649609' }
      };
      const plan = plans[payingPeople as keyof typeof plans];
      setSelectedPlanInfo({
        type: `${payingPeople} Pessoas`,
        monthlyLink: plan.mLink,
        annualLink: plan.aLink,
        monthlyPrice: plan.monthly,
        annualInstallment: plan.installment,
        annualTotal: plan.total
      });
      setIsOptionsOpen(true);
      return;
    }
    
    // For other cases (6+ or mixed), use the direct link or WhatsApp
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
            <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Plano {selectedPlanInfo?.type}</p>
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
                   12x de R$ {selectedPlanInfo?.annualInstallment?.toFixed(2).replace('.', ',')}
                 </p>
                 <p className="text-[10px] text-[#5c3c00] font-bold opacity-70">
                   (ou R$ {selectedPlanInfo?.annualTotal?.toFixed(2).replace('.', ',')} à vista)
                 </p>
               </div>
               <Button asChild className="w-full bg-gradient-to-r from-[#bf953f] to-[#aa771c] hover:from-[#aa771c] hover:to-[#bf953f] text-[#332200] font-black rounded-2xl h-12 shadow-lg shadow-gold/20 uppercase text-xs tracking-wider border border-white/20">
                 <a href={selectedPlanInfo?.annualLink} target="_blank" rel="noopener noreferrer">ADERIR ANUAL</a>
               </Button>
            </div>

            {/* Mensal */}
            <div 
              className="bg-emerald-50/50 border-2 border-emerald-500/20 p-6 rounded-3xl shadow-sm"
            >
               <h4 className="text-emerald-900 font-black text-xs uppercase mb-3 flex items-center gap-2">
                 * PLANO MENSAL
               </h4>
               <div className="mb-5">
                 <p className="text-emerald-700 font-black text-3xl mb-1">
                   R$ {selectedPlanInfo?.monthlyPrice?.toFixed(2).replace('.', ',')} / mês
                 </p>
                 <p className="text-[10px] text-emerald-600 font-bold opacity-70">
                   Assinatura recorrente mensal
                 </p>
               </div>
               <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-12 uppercase text-xs tracking-wider shadow-md">
                 <a href={selectedPlanInfo?.monthlyLink} target="_blank" rel="noopener noreferrer">ADERIR MENSAL</a>
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
