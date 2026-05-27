import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Star, ArrowRight } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="sobre" className="py-12 sm:py-24 bg-transparent relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />
      
      <div className="container px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-stretch max-w-6xl mx-auto">
          {/* Left Side: Image container matching full right-side height */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="hidden lg:block h-full"
          >
            <div className="sticky top-24 h-full">
              <img
                src="/images/about-aerial.jpg"
                alt="Vista aérea do Balneário Lessa"
                className="rounded-[32px] shadow-2xl w-full object-cover h-[calc(100%-1rem)] border-2 border-primary/10"
                loading="lazy"
              />
            </div>
          </motion.div>

          {/* Mobile Image (Visible only on small screens) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:hidden mb-8"
          >
            <img
              src="/images/about-aerial.jpg"
              alt="Vista aérea do Balneário Lessa"
              className="rounded-2xl shadow-lg w-full object-cover h-64 sm:h-80"
              loading="lazy"
            />
          </motion.div>

          {/* Right Side: Content Column */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col space-y-6 sm:space-y-8"
          >
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 bg-primary/10 text-primary font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full">
                <Star className="h-3 w-3 fill-primary" /> Conheça o Balneário
              </span>
              <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-foreground leading-[1.1]">
                Sobre o <span className="text-primary-dark italic">Balneário Lessa</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed font-medium">
                Um balneário cristão, familiar e cheio de vida em Ariquemes–RO.
                Descubra um lugar para descansar o corpo, renovar a fé e criar memórias inesquecíveis com quem você ama.
              </p>
              <div className="bg-muted/30 p-5 rounded-2xl border-l-4 border-primary/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-primary/5" />
                <p className="text-muted-foreground text-sm sm:text-base leading-relaxed italic relative z-10">
                  No Balneário Lessa, cada canto é pensado para acolher. Aqui, a natureza encontra a fé, a diversão encontra o descanso e as famílias se reconectam em meio às águas, árvores, trilhas e encontros.
                </p>
              </div>
            </div>

            {/* Harmonized Feature Grid - Perfectly Balanced Heights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 items-stretch">
              <div className="bg-primary/5 border border-primary/20 rounded-[28px] p-6 sm:p-7 shadow-sm flex flex-col h-full hover:shadow-md transition-all group border-b-4 border-b-primary/20">
                <h4 className="font-black text-primary flex items-center gap-2 text-xs sm:text-sm uppercase tracking-widest mb-6 group-hover:translate-x-1 transition-transform">
                  <span className="bg-primary text-white p-1.5 rounded-lg shadow-sm">✨</span> Inclusos no Day Use
                </h4>
                <motion.ul 
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08
                      }
                    }
                  }}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="space-y-3.5 flex-1"
                >
                  {[
                    { emoji: '💦', text: 'Piscinas Adulto e Infantil' },
                    { emoji: '🌊', text: 'Cachoeiras com bio-piscinas' },
                    { emoji: '⛪', text: 'Batistério' },
                    { emoji: '🎢', text: 'Tirolesa (acima de 12 anos)' },
                    { emoji: '⚽', text: 'Campo de Futebol e Vôlei' },
                    { emoji: '🛖', text: 'Cabanas com Redes' },
                    { emoji: '👶', text: 'Área Kids (até 5 anos)' },
                  ].map((item, idx) => (
                    <motion.li 
                      key={idx} 
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        show: { opacity: 1, x: 0 }
                      }}
                      className="flex items-start gap-3 text-sm font-bold text-primary-dark/80 group/item"
                    >
                      <span className="text-lg shrink-0 leading-none transition-all">{item.emoji}</span>
                      <span className="leading-tight pt-0.5">{item.text}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>

              <div className="bg-sun/10 border border-sun/20 rounded-[28px] p-6 sm:p-7 shadow-sm flex flex-col h-full hover:shadow-md transition-all group border-b-4 border-b-sun/20">
                <h4 className="font-black text-sun-dark flex items-center gap-2 text-xs sm:text-sm uppercase tracking-widest mb-6 group-hover:translate-x-1 transition-transform">
                   <span className="bg-sun text-sun-dark p-1.5 rounded-lg shadow-sm">✨</span> Pagos à Parte
                </h4>
                <motion.ul 
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08
                      }
                    }
                  }}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="space-y-3.5 flex-1"
                >
                  {[
                    { emoji: '🚜', text: 'Quadriciclo (1h30)' },
                    { emoji: '🛖', text: 'Reserva de Quiosques' },
                    { emoji: '🍽️', text: 'Restaurante Completo' },
                    { emoji: '🫧', text: 'Futebol de Sabão' },
                    { emoji: '🏸', text: 'Beach Tênis' },
                    { emoji: '🎣', text: 'Pesca Esportiva' },
                  ].map((item, idx) => (
                    <motion.li 
                      key={idx} 
                      variants={{
                        hidden: { opacity: 0, x: 10 },
                        show: { opacity: 1, x: 0 }
                      }}
                      className="flex items-start gap-3 text-sm font-bold text-sun-dark/80 group/item"
                    >
                      <span className="text-lg shrink-0 leading-none transition-all">{item.emoji}</span>
                      <span className="leading-tight pt-0.5">{item.text}</span>
                    </motion.li>
                  ))}
                  {/* Invisible spacer to match height of the left card if needed */}
                  <li className="opacity-0 select-none h-4 sm:h-auto" aria-hidden="true">Spacer</li>
                </motion.ul>
              </div>
            </div>

            <div className="pt-2">
              <Button asChild size="lg" className="bg-primary hover:bg-primary-dark text-white font-display font-black text-lg h-15 rounded-2xl shadow-xl hover:shadow-2xl transition-all w-full sm:w-auto px-12 group py-4">
                <motion.a 
                  href="#reservas" 
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2"
                >
                   QUERO FAZER MINHA RESERVA <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                </motion.a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
