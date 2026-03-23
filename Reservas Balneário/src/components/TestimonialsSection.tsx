import { motion } from 'framer-motion';
import { Star, Quote, User } from 'lucide-react';

const testimonials = [
  {
    name: 'Ana Paula Santos',
    role: 'Passeio em Família',
    content: 'Experiência maravilhosa! O lugar é lindo, super bem cuidado e as crianças se divertiram muito nas piscinas e na tirolesa. Com certeza voltaremos mais vezes!',
    rating: 5,
    avatar: <img src="/images/ana-paula.jpg" alt="Ana Paula Santos" className="w-full h-full object-cover rounded-full" />,
  },
  {
    name: 'Carlos Eduardo',
    role: 'Sócio Lessa Gold',
    content: 'Ser sócio foi a melhor decisão. Economizamos muito nas visitas semanais e o atendimento prioritário nos quiosques faz toda a diferença nos domingos.',
    rating: 5,
    avatar: <img src="/images/carlos-eduardo.jpg" alt="Carlos Eduardo" className="w-full h-full object-cover rounded-full" />,
  },
  {
    name: 'Mariana Lima',
    role: 'Day Use de Domingo',
    content: 'O balneário é perfeito para quem busca contato com a natureza sem abrir mão de estrutura. A comida do restaurante é deliciosa e o ambiente é muito familiar.',
    rating: 4,
    avatar: <img src="/images/mariana-lima.jpg" alt="Mariana Lima" className="w-full h-full object-cover rounded-full" />,
  },
  {
    name: 'Ricardo Oliveira',
    role: 'Aventura de Quadriciclo',
    content: 'O passeio de quadriciclo foi incrível! A trilha é emocionante e as paisagens são de tirar o fôlego. Valeu cada centavo!',
    rating: 5,
    avatar: <img src="/images/ricardo-oliveira.jpg" alt="Ricardo Oliveira" className="w-full h-full object-cover rounded-full" />,
  },
];

export function TestimonialsSection() {
  return (
    <section id="feedbacks" className="py-12 sm:py-16 bg-transparent overflow-hidden">
      <div className="container px-4">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-block bg-sun/20 text-foreground font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            💬 Histórias Reais
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-4 leading-tight">
            O que nossos visitantes <br className="hidden sm:block" /> têm a dizer
          </h2>
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
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 30 },
                show: { opacity: 1, y: 0 }
              }}
              whileTap={{ scale: 0.98 }}
              className="bg-muted/30 p-8 rounded-3xl border border-muted-foreground/10 hover:border-primary/30 transition-all duration-300 relative group text-left"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/10 group-hover:text-primary/20 transition-colors" />
              
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, idx) => (
                  <Star 
                    key={idx} 
                    className={`h-4 w-4 ${idx < t.rating ? 'fill-sun text-sun' : 'text-muted-foreground'}`} 
                  />
                ))}
              </div>

              <p className="text-foreground/80 text-sm leading-relaxed italic mb-8">
                "{t.content}"
              </p>

              <div className="flex items-center gap-4 mt-auto">
                <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center border-2 border-primary/20 shadow-sm text-primary">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-display font-bold text-base leading-none mb-1">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
