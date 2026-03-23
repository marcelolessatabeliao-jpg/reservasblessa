import { motion } from 'framer-motion';
import { Briefcase, GraduationCap, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const specialPlans = [
  {
    title: 'Lessa Parceiro',
    icon: Briefcase,
    description: 'Parcerias para empresas, igrejas e associações com benefícios exclusivos.',
    benefits: ['Plano institucional coletivo', 'Carteirinha oficial digital + física', '5% Cashback em serviços', 'Sem taxa de adesão'],
    cta: 'QUERO ME CADASTRAR',
    ctaLink: 'https://wa.me/5569992626140',
    price: "39,90",
    priceNote: '/mês ou (meia-entrada no Day Use)',
    color: 'bg-blue-600 text-white border-blue-400 shadow-blue-200/50',
  },
  {
    title: 'Lessa Professor Pass',
    icon: GraduationCap,
    description: 'Valorizando quem educa! Acesso ilimitado e lazer garantido.',
    benefits: ['Acesso livre em dias de funcionamento', '5% Cashback em serviços', 'Sem taxa de adesão', 'Carteira digital/física'],
    buttons: [{ label: 'Mensal', link: 'https://cartaobl.com.br/planos/?regPlano=1221212252632308' }, { label: 'Day Use', link: 'https://cartaobl.com.br/planos/?regPlano=1131212252541849' }],
    price: "25,00",
    priceNote: '/mês ou (meia-entrada no Day Use)',
    color: 'bg-green-600 text-white border-green-400 shadow-green-200/50',
  },
  {
    title: 'Lessa Student Pass',
    icon: GraduationCap,
    description: 'Estudantes têm lugar garantido com o melhor custo-benefício.',
    benefits: ['Acesso livre em dias de funcionamento', '5% Cashback em serviços', 'Sem taxa de adesão', 'Carteira digital/física'],
    buttons: [{ label: 'Mensal', link: 'https://cartaobl.com.br/planos/?regPlano=1211212252673382' }, { label: 'Day Use', link: 'https://cartaobl.com.br/planos/?regPlano=1121212252549492' }],
    price: "25,00",
    priceNote: '/mês ou (meia-entrada no Day Use)',
    color: 'bg-sun text-foreground border-sun-dark/20 shadow-sun/30',
  },
  {
    title: 'Lessa Servidor Pass',
    icon: Users,
    description: 'Reconhecimento àqueles que servem à sociedade.',
    benefits: ['Acesso livre em dias de funcionamento', '5% Cashback em serviços', 'Sem taxa de adesão', 'Carteira digital/física'],
    buttons: [{ label: 'Mensal', link: 'https://cartaobl.com.br/planos/?regPlano=1201212252611556' }, { label: 'Day Use', link: 'https://cartaobl.com.br/planos/?regPlano=1141212252587413' }],
    price: "25,00",
    priceNote: '/mês ou (meia-entrada no Day Use)',
    color: 'bg-primary text-white border-primary-light shadow-primary/20',
  },
];

export function SpecialPlansCards() {
  return (
    <section id="planos-especiais" className="py-12 sm:py-16 bg-transparent">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground mb-4 leading-tight">
            Planos Especiais & <br className="hidden sm:block" /> <span className="text-sun-dark">Parcerias Estratégicas</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Temos condições exclusivas para diferentes públicos e objetivos sociais. Encontre a que melhor se adapta a você.
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
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {specialPlans.map((plan, i) => (
            <motion.div
              key={plan.title}
              variants={{
                hidden: { opacity: 0, y: 30 },
                show: { opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 100 } }
              }}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-col p-6 rounded-2xl border ${plan.color} h-full group hover:shadow-2xl transition-all duration-500 relative overflow-hidden text-left`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
                <plan.icon className="h-24 w-24" />
              </div>
              
              <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6 backdrop-blur-sm group-hover:rotate-12 transition-transform">
                <plan.icon className="h-6 w-6 text-current" />
              </div>
              
              <h3 className="font-display font-bold text-xl mb-1 text-current">{plan.title}</h3>
              <div className="mb-4 text-left">
                <p className="text-current font-black text-3xl">R$ {plan.price}</p>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">{plan.priceNote}</p>
              </div>
              
              <p className="text-sm opacity-90 mb-6 flex-1 italic leading-relaxed font-medium">
                "{plan.description}"
              </p>
              
              <ul className="space-y-3 mb-8">
                {plan.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-bold opacity-95">
                    <CheckIcon className="h-4 w-4 shrink-0 mt-0.5 text-current" /> {b}
                  </li>
                ))}
              </ul>
              
              {plan.buttons ? (
                <div className="flex gap-2 w-full mt-auto">
                  {plan.buttons.map((btn, bidx) => (
                    <Button key={bidx} asChild className="flex-1 bg-white text-foreground hover:bg-sun hover:text-foreground border-none font-black text-[10px] uppercase tracking-widest py-6 rounded-xl shadow-lg transition-all">
                      <a href={btn.link} target="_blank" rel="noopener noreferrer">{btn.label}</a>
                    </Button>
                  ))}
                </div>
              ) : (
                <Button asChild className="w-full mt-auto bg-white text-foreground hover:bg-sun hover:text-foreground border-none font-black text-[10px] uppercase tracking-widest py-6 rounded-xl shadow-lg transition-all">
                  <a href={plan.ctaLink || '#'} target="_blank" rel="noopener noreferrer">{plan.cta}</a>
                </Button>
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 flex justify-center"
        >
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-8 py-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-primary/10 p-2 rounded-full">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <p className="text-foreground font-black text-sm sm:text-base uppercase tracking-tight">
              Sem fidelidade e sem taxa de adesão. <span className="text-muted-foreground font-medium lowercase ml-1">Consulte termos e condições.</span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}
