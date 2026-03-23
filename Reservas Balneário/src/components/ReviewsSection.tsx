import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const reviews = [
  {
    name: 'Maria Silva',
    rating: 5,
    text: 'Lugar maravilhoso! Levei toda a família e as crianças amaram as piscinas naturais. Com certeza voltaremos!',
    date: 'Março 2026',
  },
  {
    name: 'Carlos Oliveira',
    rating: 5,
    text: 'Melhor balneário da região! Estrutura excelente, cachoeiras lindas e o passeio de quadriciclo é imperdível.',
    date: 'Fevereiro 2026',
  },
  {
    name: 'Ana Costa',
    rating: 4,
    text: 'Adoramos o dia no balneário. Os quiosques são bem equipados e a comida do restaurante é deliciosa.',
    date: 'Janeiro 2026',
  },
  {
    name: 'Pedro Santos',
    rating: 5,
    text: 'Experiência incrível! O batistério é lindo e o contato com a natureza é revigorante. Recomendo muito!',
    date: 'Dezembro 2025',
  },
  {
    name: 'Juliana Ferreira',
    rating: 5,
    text: 'Fiz meu aniversário no quiosque maior e foi perfeito. Equipe super atenciosa e lugar paradisíaco.',
    date: 'Novembro 2025',
  },
  {
    name: 'Roberto Almeida',
    rating: 4,
    text: 'Ótimo lugar para passar o dia. A tirolesa é muito divertida e as bio-piscinas são únicas.',
    date: 'Outubro 2025',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'text-sun fill-sun' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );
}

export function ReviewsSection() {
  return (
    <section id="avaliacoes" className="py-20 bg-gradient-to-b from-primary/5 to-background">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-sun/20 text-foreground font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            ⭐ Avaliações
          </span>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
            O que dizem nossos visitantes
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <StarRating rating={5} />
            <span className="text-lg font-bold text-foreground">4.8/5</span>
            <span className="text-muted-foreground text-sm">({reviews.length} avaliações)</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {reviews.map((review, i) => (
            <motion.div
              key={review.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-xl border p-6 shadow-card relative"
            >
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />
              <StarRating rating={review.rating} />
              <p className="text-sm text-muted-foreground mt-3 mb-4 leading-relaxed">{review.text}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">{review.name}</p>
                  <p className="text-xs text-muted-foreground">{review.date}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
