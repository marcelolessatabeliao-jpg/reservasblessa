import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, ArrowRight, Ticket, Star, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/booking-types';
import { QuantityStepper } from '@/components/QuantityStepper';

export function LessaClubSimulator() {
  const [quantities, setQuantities] = useState({
    adult: 1,
    student: 0,
    teacher: 0,
    server: 0,
    child: 0,
    senior: 0,
    pcd: 0,
  });

  const payingPeople = quantities.adult + quantities.student + quantities.teacher + quantities.server;
  let planName = 'Lessa Club personalizado';
  if (payingPeople === 1) planName = 'Lessa Club (individual)';
  else if (payingPeople >= 2 && payingPeople <= 5) planName = `Lessa Club (${payingPeople} pessoas)`;
  else if (payingPeople === 0) planName = 'Lessa Club';

  const getPlanLink = () => {
    if (payingPeople === 1) {
      if (quantities.student === 1) return 'https://cartaobl.com.br/planos/?regPlano=1211212252673382';
      if (quantities.teacher === 1) return 'https://cartaobl.com.br/planos/?regPlano=1221212252632308';
      if (quantities.server === 1) return 'https://cartaobl.com.br/planos/?regPlano=1201212252611556';
      if (quantities.adult === 1) return 'https://cartaobl.com.br/planos/?regPlano=1212252516762';
    }

    if (quantities.adult === payingPeople) {
      if (payingPeople === 2) return 'https://cartaobl.com.br/planos/?regPlano=1051212252525908';
      if (payingPeople === 3) return 'https://cartaobl.com.br/planos/?regPlano=1061212252544284';
      if (payingPeople === 4) return 'https://cartaobl.com.br/planos/?regPlano=1151212252593723';
      if (payingPeople === 5) return 'https://cartaobl.com.br/planos/?regPlano=1231212252657405';
    }

    const message = `Olá! Realizei uma simulação no Lessa Club para ${payingPeople} pessoas e gostaria de finalizar minha adesão.`;
    return `https://wa.me/5569992626140?text=${encodeURIComponent(message)}`;
  };

  const totalMonthly = 
    quantities.adult * 49.9 + 
    quantities.student * 25 + 
    quantities.teacher * 25 + 
    quantities.server * 25;

  return (
    <section id="especiais" className="py-12 bg-muted/20">
      <div className="container px-4">
        {/* Full-width Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display font-black text-3xl sm:text-4xl text-foreground mb-4 leading-tight">
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
            <div className="grid grid-cols-1 gap-3">
              {[
                { key: 'adult', label: 'Lessa Club', price: 49.9, emoji: '🎟️', badge: null, color: 'bg-gradient-to-br from-sun/10 to-sun/30 border-sun/40 shadow-sun/5' },
                { key: 'student', label: 'Estudante', price: 25, emoji: '🎓', badge: '50% OFF', color: 'bg-sun/5 border-sun/10' },
                { key: 'teacher', label: 'Professor', price: 25, emoji: '📚', badge: '50% OFF', color: 'bg-green-600/5 border-green-600/10' },
                { key: 'server', label: 'Servidor', price: 25, emoji: '🏛️', badge: '50% OFF', color: 'bg-primary/5 border-primary/10' },
              ].map((item) => (
                <div key={item.key} className={`flex items-center p-3 sm:p-4 rounded-2xl border shadow-sm transition-colors gap-3 ${item.color}`}>
                  {/* Icon */}
                  <span className="text-xl sm:text-2xl shrink-0">{item.emoji}</span>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-foreground text-sm italic leading-tight">{item.label}</h4>
                      {item.badge && <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                    </div>
                    <p className="text-primary font-black text-[11px] mt-0.5">
                      {formatCurrency(item.price)} <span className="text-[9px] text-muted-foreground font-medium opacity-70">/mês</span>
                    </p>
                  </div>
                  {/* Stepper — always has room, no overflow */}
                  <div className="shrink-0 ml-auto">
                    <QuantityStepper
                      value={quantities[item.key as keyof typeof quantities]}
                      onChange={(val) => setQuantities(prev => ({ ...prev, [item.key]: val }))}
                      min={0}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-5 text-center lg:text-left">
              <h4 className="font-black uppercase tracking-widest text-[10px] text-muted-foreground mb-3 px-2">Gratuidades (Acesso Livre)</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'child', label: 'Crianças', emoji: '👶', color: 'bg-blue-50/50 border-blue-100/50' },
                  { key: 'senior', label: 'Idosos', emoji: '🧓', color: 'bg-purple-50/50 border-purple-100/50' },
                  { key: 'pcd', label: 'PCD & TEA', emoji: '♿', color: 'bg-teal-50/50 border-teal-100/50' },
                ].map((item) => (
                  <div key={item.key} className={`flex flex-col items-center gap-2 p-2 rounded-xl border text-center ${item.color}`}>
                    <span className="text-xl">{item.emoji}</span>
                    <span className="font-bold text-[10px] text-foreground/80 leading-tight">{item.label}</span>
                    <QuantityStepper
                      value={quantities[item.key as keyof typeof quantities]}
                      onChange={(val) => setQuantities(prev => ({ ...prev, [item.key]: val }))}
                      min={0}
                      size="sm"
                    />
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
            <div className="bg-primary rounded-[32px] p-5 sm:p-8 border border-primary-light shadow-xl shadow-primary/20 relative overflow-hidden text-white flex-1 flex flex-col justify-center items-center">
              {/* Highlighted Simulador Badge */}
              <motion.div 
                animate={{ 
                  y: [0, -6, 0],
                  rotate: [2, 4, 2]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-sun px-4 sm:px-5 py-1.5 sm:py-2 rounded-2xl sm:rounded-[20px] shadow-lg z-20 flex items-center justify-center border border-sun/50"
              >
                <span className="text-sm sm:text-lg tracking-tight font-black text-slate-900 drop-shadow-sm">Simulador 💸</span>
              </motion.div>
              
              <div className="relative z-10 w-full text-center mt-4">
                <p className="text-sun font-bold uppercase tracking-widest text-[10px] sm:text-xs mb-1 drop-shadow-sm">
                  Total do {planName}
                </p>
                <div className="flex items-center justify-center mb-6">
                  <h3 className="font-display font-black text-5xl sm:text-6xl drop-shadow-md">
                    {formatCurrency(totalMonthly)}
                  </h3>
                </div>
                
                <Button asChild size="lg" className="bg-white text-primary hover:bg-sun hover:text-foreground font-display font-black text-base sm:text-lg h-12 rounded-xl shadow-lg w-full mb-5 transition-all duration-300">
                  <motion.a 
                    whileTap={{ scale: 0.96 }}
                    href={getPlanLink()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                     QUERO ME ASSOCIAR <ArrowRight className="ml-2 h-4 w-4" />
                  </motion.a>
                </Button>

                {/* Updated Benefit Box */}
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
                        Pessoas pagantes (12 a 59 anos)
                      </p>
                      <p className="text-primary font-black text-xl flex items-center gap-2">
                        {payingPeople} {payingPeople === 1 ? 'Pessoa' : 'Pessoas'}
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
    </section>
  );
}
