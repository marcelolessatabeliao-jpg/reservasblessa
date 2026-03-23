import { motion } from 'framer-motion';
import { Check, Star, Shield, Zap, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Lessa Club (individual)',
    price: '49,90',
    description: 'Acesso individual completo ao balneário com todos os benefícios de sócio.',
    features: ['Sem taxa de adesão', 'Acesso ilimitado Sex a Seg', 'Carteira Digital e Física', '5% Cashback em consumação'],
    color: 'border-primary/40 bg-primary/5',
    icon: Shield,
    popular: false,
    link: 'https://cartaobl.com.br/planos/?regPlano=1212252516762',
  },
  {
    name: 'Lessa Club (2 pessoas)',
    price: '99,80',
    description: 'O plano perfeito para casais ou duplas de amigos.',
    features: ['Sem taxa de adesão', 'Tudo do plano individual', 'Benefícios para 2 pessoas', 'Descontos exclusivos'],
    color: 'border-sun bg-sun/5 shadow-xl scale-105 z-10',
    icon: Star,
    popular: true,
    link: 'https://cartaobl.com.br/planos/?regPlano=1051212252525908',
  },
  {
    name: 'Lessa Club (3 pessoas)',
    price: '149,70',
    description: 'Ideal para pequenas famílias ou grupos.',
    features: ['Sem taxa de adesão', 'Tudo do plano individual', 'Benefícios para 3 pessoas', 'Acesso VIP em eventos'],
    color: 'border-primary bg-primary/5 shadow-lg',
    icon: Zap,
    popular: false,
    link: 'https://cartaobl.com.br/planos/?regPlano=1061212252544284',
  },
];

const extraPlans = [
  { name: 'Lessa Duo Club', price: '74,90', desc: '1 Meia + 1 Inteira', link: 'https://cartaobl.com.br/planos/?regPlano=1212252516762', color: 'border-primary/20 bg-primary/5' },
  { name: 'Lessa Club (4 pessoas)', price: '199,60', desc: 'Ideal para famílias', link: 'https://cartaobl.com.br/planos/?regPlano=1151212252593723', color: 'border-primary/20 bg-primary/5' },
  { name: 'Lessa Club (5 pessoas)', price: '249,50', desc: 'Grupo completo', link: 'https://cartaobl.com.br/planos/?regPlano=1231212252657405', color: 'border-primary/20 bg-primary/5' },
  { name: 'Lessa Parceiro', price: '39,90', desc: 'Empresas e Igrejas', link: 'https://wa.me/5569992626140', color: 'border-primary/20 bg-primary/5' },
];

export function LessaClubPlanCards() {
  return (
    <section id="planos" className="py-12 sm:py-24 bg-transparent">
      <div className="container px-4">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            💎 Escolha seu Plano
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-4 leading-tight">
            Club Lessa: Onde sua <br className="hidden sm:block" /> felicidade acontece
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Planos pensados para todos os perfis, com benefícios exclusivos que fazem cada visita ser única.
          </p>
        </motion.div>

        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15
              }
            }
          }}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={{
                hidden: { opacity: 0, y: 30 },
                show: { opacity: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 100 } }
              }}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.96 }}
              className={`bg-card rounded-3xl border-4 p-8 flex flex-col relative transition-all duration-300 hover:shadow-2xl ${plan.color}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-sun text-foreground font-bold text-xs px-6 py-1.5 rounded-full shadow-lg whitespace-nowrap z-20 border-2 border-sun-dark/20 uppercase tracking-tighter">
                  MAIS ESCOLHIDO ⭐
                </div>
              )}
              
              <div className="mb-6">
                <div className="bg-primary/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                  <plan.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  <span className="text-5xl font-display font-black text-primary">{plan.price}</span>
                  <span className="text-muted-foreground text-sm font-bold">/mês</span>
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="bg-whatsapp/10 p-1 rounded-full mt-0.5 border border-whatsapp/20">
                       <Check className="h-3 w-3 text-whatsapp shrink-0" />
                    </div>
                    <span className="text-sm text-foreground/80 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <Button asChild className={`w-full py-7 rounded-xl font-display font-black text-base transition-all shadow-lg group ${plan.popular ? 'bg-sun hover:bg-sun-dark text-foreground' : 'bg-primary hover:bg-primary-dark text-white'}`}>
                <a href={plan.link} target="_blank" rel="noopener noreferrer">
                   ASSINAR AGORA <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-16 bg-white/30 backdrop-blur-sm p-8 sm:p-12 rounded-[40px] border-2 border-primary/10 shadow-sm">
          <h3 className="text-center font-display font-bold text-3xl mb-12">Outras Opções de Planos</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {extraPlans.map((plan, i) => (
              <motion.div 
                key={plan.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5, scale: 1.02, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`w-full sm:w-[240px] rounded-2xl border-2 p-6 flex flex-col items-center text-center transition-all duration-300 hover:border-primary/50 shadow-sm ${plan.color}`}
              >
                <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-primary/10">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-bold text-lg mb-1">{plan.name}</h4>
                <div className="text-primary font-black text-2xl mb-2">
                   R$ {plan.price}
                   <span className="text-xs text-muted-foreground font-bold ml-1">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mb-6 min-h-[32px] flex items-center justify-center italic font-medium">{plan.desc}</p>
                <Button asChild variant="outline" size="lg" className="w-full rounded-xl font-black border-primary text-primary hover:bg-primary hover:text-white transition-all uppercase text-xs tracking-tight shadow-sm">
                  <a href={plan.link} target="_blank" rel="noopener noreferrer">Assinar</a>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
