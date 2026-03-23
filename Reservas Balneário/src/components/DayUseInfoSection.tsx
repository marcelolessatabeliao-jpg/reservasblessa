import { motion } from 'framer-motion';
import { Check, X, Info, Ticket, Calendar, Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DayUsePricing() {
  return (
    <section id="day-use-pricing" className="py-12 sm:py-16 bg-transparent">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <span className="inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            🏞️ Informações de Acesso
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-4">
            Day Use Balneário Lessa
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o melhor dia para sua visita e aproveite toda a nossa estrutura de lazer.
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
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Card 1: Weekdays & Sat */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -20 },
              show: { opacity: 1, x: 0, transition: { type: "spring", damping: 20, stiffness: 100 } }
            }}
            whileTap={{ scale: 0.98 }}
            className="bg-card rounded-2xl border shadow-lg overflow-hidden flex flex-col"
          >
            <div className="bg-primary p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-6 w-6" />
                <h3 className="font-display font-bold text-xl">Sexta, Sábado, Segunda e Feriados Solidários</h3>
              </div>
              <p className="text-white/80 text-sm">Escolha sua forma de acesso</p>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-2">
                  <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-primary/20">Opção 1</span>
                  <span className="text-primary font-display font-black text-5xl drop-shadow-sm">R$ 50,00</span>
                  <span className="text-muted-foreground font-bold text-sm">por pessoa <span className="opacity-70 font-medium whitespace-nowrap">- sem donativos</span></span>
                </div>
                
                <div className="bg-sun/5 p-4 sm:p-5 rounded-2xl border border-sun/20 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-1">
                    <span className="bg-sun text-sun-dark text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-sun-dark/20">Opção 2</span>
                    <span className="bg-[#e63946] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow-sm">50% OFF</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-1">
                    <span className="text-sun-dark font-display font-black text-4xl drop-shadow-sm">R$ 25,00</span>
                    <h4 className="font-bold text-sm text-sun-dark flex items-center gap-1.5 uppercase tracking-tight">
                      <Ticket className="h-4 w-4" /> Meia-Entrada
                    </h4>
                  </div>
                  <div className="pt-2 border-t border-sun/10">
                    <p className="text-xs font-black text-sun-dark/90 mb-3 tracking-wide">USE UMA DESSAS OPÇÕES E GARANTA O BENEFÍCIO:</p>
                    <ul className="text-xs space-y-3 text-muted-foreground font-medium">
                    <li className="flex gap-2">🎁 <strong>Opção Solidária:</strong> Doe 1kg de alimento, livros, brinquedos ou roupas em bom estado.</li>
                    <li className="flex gap-2">🩸 <strong>Doadores:</strong> Sangue ou medula óssea (comprovado).</li>
                    <li className="flex items-start gap-2">
                      <span className="text-lg leading-none">🎓</span>
                      <span><strong>Benefício válido para Estudantes, Professores e Servidores:</strong> Mediante comprovação.</span>
                    </li>
                  </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Sunday */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: 20 },
              show: { opacity: 1, x: 0, transition: { type: "spring", damping: 20, stiffness: 100 } }
            }}
            whileTap={{ scale: 0.98 }}
            className="bg-card rounded-2xl border-2 border-sun shadow-xl overflow-hidden flex flex-col"
          >
            <div className="bg-sun p-6 text-foreground">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-6 w-6" />
                <h3 className="font-display font-bold text-xl">Domingos</h3>
              </div>
              <p className="text-foreground/70 text-sm">O dia mais animado do balneário</p>
            </div>
            <div className="p-6 space-y-6 flex-1 bg-sun/5">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="text-sun-dark font-display font-black text-5xl drop-shadow-sm">R$ 50,00</span>
                <span className="text-muted-foreground font-bold text-sm">por pessoa</span>
                <div className="bg-sun text-foreground font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse shadow-sm border border-sun-dark/20">
                  🔥 ALTA PROCURA
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
                <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                  <Shield className="h-4 w-4" /> MEIA-ENTRADA (R$ 25,00)
                </h4>
                <div className="bg-primary/10 p-3 rounded-lg border border-primary/20 space-y-3">
                  <p className="text-xs font-bold text-primary-dark/90 leading-relaxed">
                    Válido para <strong>Estudantes, Professores e Servidores</strong> cadastrados nos planos <strong>Lessa Pass</strong> ou mediante comprovação.
                  </p>
                  <p className="text-xs font-bold text-primary/80 leading-relaxed uppercase tracking-tight">
                    Faça seu cadastro no plano Lessa Pass de acordo com a sua categoria
                  </p>
                  <Button asChild size="sm" className="w-full bg-primary hover:bg-primary-dark text-white font-bold shadow-md uppercase tracking-wider text-[10px]">
                    <a href="#planos-especiais">Quero ativar meu benefício</a>
                  </Button>
                </div>
                <div className="pt-2 border-t border-primary/10">
                  <p className="text-[10px] text-destructive font-bold flex items-center gap-1">
                    ⚠️ Atenção: Aos domingos não são aceitos donativos como meia-entrada.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export function DayUseRules() {
  return (
    <section id="day-use-rules" className="py-12 bg-transparent">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-2xl border shadow-md overflow-hidden"
        >
          <div className="bg-muted p-4 border-b">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> O que saber antes de vir
            </h3>
          </div>
          
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-display font-bold text-primary flex items-center gap-2 uppercase tracking-tight text-sm">
                  <Ticket className="h-4 w-4" /> Entradas Gratuitas
                </h4>
                <div className="space-y-3">
                  {[
                    { icon: '♿', icon2: '🧩', title: 'PCD & TEA', desc: 'Acesso livre com direito a 1 acompanhante grátis', link: 'https://cartaobl.com.br/planos/?regPlano=1081212252542802' },
                    { icon: '👶', title: 'Crianças até 11 anos', desc: 'Acesso livre e gratuito', link: 'https://cartaobl.com.br/planos/?regPlano=1101212252572821' },
                    { icon: '👵', title: 'Idosos (60+)', desc: 'Gratuidade melhor idade', link: 'https://cartaobl.com.br/planos/?regPlano=1071212252592719' },
                    { icon: '🎂', title: 'Aniversariante', desc: 'Da semana (Apenas RG)', noButton: true },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-card shadow-sm p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex -space-x-1 shrink-0 bg-primary/5 p-2 rounded-full">
                          <span className="text-2xl sm:text-3xl leading-none">{item.icon}</span>
                          {item.icon2 && <span className="text-2xl sm:text-3xl leading-none">{item.icon2}</span>}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-display font-bold text-sm sm:text-base text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.desc}</p>
                        </div>
                      </div>
                      {!item.noButton && (
                        <Button asChild className="h-10 px-6 font-black bg-primary text-white hover:bg-primary-dark uppercase shrink-0 w-full sm:w-auto shadow-md">
                          <a href={item.link} target="_blank" rel="noopener noreferrer">Cadastrar</a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col h-full gap-4">
                <h4 className="font-display font-bold text-destructive flex items-center gap-2 uppercase tracking-tight text-sm shrink-0">
                  <X className="h-4 w-4" /> Não é PERMITIDO 
                </h4>
                <div className="flex-1 flex flex-col gap-2.5">
                  {[
                    'Bebidas alcoólicas (entrada não permitida e não vendemos)',
                    'Demais bebidas (sucos, refrigerantes, água, etc) apenas consumo local',
                    'Garrafas ou recipientes de vidro',
                    'Som automotivo ou caixas potentes',
                    'Entrada de animais',
                    'Proibido fumar',
                  ].map((r, idx) => (
                    <div key={idx} className="flex-1 text-[12px] sm:text-sm text-foreground font-medium flex items-center gap-3 bg-destructive/5 px-4 py-3 sm:py-0 rounded-xl border border-destructive/10">
                      <div className="w-2 h-2 rounded-full bg-destructive shrink-0" /> {r}
                    </div>
                  ))}
                </div>

                <div className="p-4 sm:p-5 bg-sun/5 rounded-xl border border-sun/20 mt-auto shrink-0">
                  <h5 className="font-bold text-xs uppercase tracking-widest text-sun-dark mb-1.5 flex items-center gap-1.5">💡 Dica do Lessa</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    No Domingo o movimento é intenso! Chegue cedo ou reserve antecipadamente para garantir a diversão!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
