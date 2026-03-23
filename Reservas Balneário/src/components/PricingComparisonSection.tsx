import { motion } from 'framer-motion';
import { useState } from 'react';
import { Check, ArrowRight, Calculator, TrendingDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency, ENTRY_PRICE, ENTRY_HALF_PRICE } from '@/lib/booking-types';

export function PricingComparisonSection() {
  const [visitsPerMonth, setVisitsPerMonth] = useState(2);
  const [familySize, setFamilySize] = useState(3);

  const visitorCost = familySize * 50 * visitsPerMonth;
  const associateCost = familySize * 49.90; // Fixed monthly fee per person
  const savings = visitorCost - associateCost;

  return (
    <section id="comparativo" className="relative py-12 sm:py-16 bg-transparent overflow-hidden">
      <div className="container px-4">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground leading-tight">
                Por que ser um <span className="text-primary italic">Sócio Lessa?</span>
              </h2>
              <p className="text-muted-foreground text-lg mt-4 max-w-xl">
                Mais do que lazer, um investimento na qualidade de vida da sua família. Veja a economia real no seu bolso.
              </p>
            </motion.div>

            <motion.div 
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.1
                  }
                }
              }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="space-y-4 pt-4"
            >
              {[
                'Entradas ilimitadas durante o mês inteiro',
                'Descontos exclusivos em consumos e participações de sorteios',
                'Acesso prioritário em eventos e feriados',
                'Seu convidado paga apenas meia-entrada',
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0 }
                  }}
                  className="flex items-center gap-3"
                >
                  <div className="bg-primary/10 p-1 rounded-full">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-bold text-foreground/80">{benefit}</span>
                </motion.div>
              ))}
            </motion.div>

            <div className="bg-whatsapp/5 border border-whatsapp/20 p-5 rounded-2xl">
              <p className="text-green-700 font-black text-sm uppercase tracking-tighter mb-1 select-none">💡 Economia Inteligente</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Nos planos Lessa Club, você paga apenas <span className="text-green-700 font-bold">R$ 49,90</span> por pessoa/mês e tem acesso <span className="text-green-700 font-bold uppercase tracking-tight">Ilimitado</span>. <br/>
                Como visitante, 1 única visita custa <span className="font-bold text-foreground">R$ 50,00</span> por pessoa.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                asChild
                size="lg" 
                className="bg-primary hover:bg-sun hover:text-foreground text-white font-display font-bold px-8 py-6 rounded-xl shadow-lg group transition-all duration-300"
              >
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Quero ser Sócio <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Button>
              
              <Button 
                asChild
                variant="outline" 
                size="lg" 
                className="border-primary text-primary hover:bg-primary hover:text-white transition-colors font-display font-bold px-8 py-6 rounded-xl"
              >
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => document.getElementById('especiais')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Simule seu plano <Calculator className="ml-2 h-5 w-5" />
                </motion.button>
              </Button>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex-1 w-full max-w-2xl"
          >
            <div className="bg-muted/40 rounded-3xl p-6 sm:p-10 border shadow-2xl relative">
              <motion.div 
                animate={{ 
                  y: [0, -6, 0],
                  rotate: [3, 5, 3]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -top-4 -right-4 bg-sun text-foreground font-bold px-4 py-2 rounded-xl shadow-lg"
              >
                Simulador 💸
              </motion.div>
              
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" /> Tamanho da Família
                    </label>
                    <input 
                      type="range" min="1" max="10" value={familySize} 
                      onChange={(e) => setFamilySize(parseInt(e.target.value))}
                      className="w-full h-2 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary" 
                    />
                    <div className="text-center font-bold text-xl">{familySize} pessoas</div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-4 w-4" /> Visitas por Mês
                    </label>
                    <input 
                      type="range" min="1" max="8" value={visitsPerMonth} 
                      onChange={(e) => setVisitsPerMonth(parseInt(e.target.value))}
                      className="w-full h-2 bg-sun/40 rounded-lg appearance-none cursor-pointer accent-sun" 
                    />
                    <div className="text-center font-bold text-xl">{visitsPerMonth} vezes</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-destructive/10 shadow-sm">
                    <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">Como Visitante</p>
                    <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(visitorCost)}</p>
                    <p className="text-[10px] text-muted-foreground">Custo total no Day Use (para um único dia)</p>
                  </div>
                  <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-tight">Vantagem</div>
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Como Sócio (Lessa Club)</p>
                    <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(associateCost)}</p>
                    <p className="text-[10px] text-[#006020] font-black uppercase tracking-tight drop-shadow-sm">Valor Único Mensal</p>
                    <p className="text-[9px] text-muted-foreground italic font-medium">(Entrada ilimitada ao Balneário nos dias de funcionamento)</p>
                  </div>
                </div>

                <div className="bg-whatsapp/10 border-2 border-whatsapp/20 p-6 rounded-2xl text-center">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <TrendingDown className="h-6 w-6 text-green-700 animate-bounce" />
                    <p className="text-green-700 font-black text-lg">Economia de {formatCurrency(Math.abs(savings))}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    👉 Vale mais pagar entrada toda vez ou aproveitar o mês inteiro?
                    <br/><br/>
                    <span className="font-black text-primary uppercase tracking-tighter">💳 SEJA UM ASSOCIADO E APROVEITE TODOS OS BENEFÍCIOS</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
