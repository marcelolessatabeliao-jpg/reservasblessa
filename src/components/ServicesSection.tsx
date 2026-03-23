import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const services = [
  {
    title: 'Quiosques',
    description: 'Churrasqueira, pia, grelha, mesas e cadeiras. Perfeito para confraternizações.',
    price: 'A partir de R$ 75,00',
    image: '/images/quiosque-novo.jpg',
    badge: 'SOB RESERVA',
  },
  {
    title: 'Quadriciclo',
    description: 'Passeios de 1h30 por trilhas na natureza. Individual, dupla ou adulto + criança.',
    price: 'A partir de R$ 150,00',
    image: '/images/quadriciclo.jpg',
    badge: 'GANHE DESCONTO',
  },
  {
    title: 'Piscinas',
    description: 'Piscinas para adultos e crianças em ambiente seguro e refrescante.',
    price: 'Incluso no Day Use',
    image: '/images/service-3.webp',
    noButton: true,
  },
  {
    title: 'Cachoeiras',
    description: 'Cachoeiras com bio-piscinas naturais para um contato direto com a natureza.',
    price: 'Incluso no Day Use',
    image: '/images/cachoeira-nova-larga.jpg',
    noButton: true,
  },
  {
    title: 'Futebol de Sabão',
    description: 'Diversão garantida para grupos por 30 minutos! Mínimo de 6 pessoas por partida.',
    price: 'R$ 10/pessoa (30 min)',
    image: '/images/futebol-sabao-novo.jpg',
  },
  {
    title: 'Campo de Futebol e Vôlei',
    description: 'Área gramada para prática de esportes com amigos e família.',
    price: 'Incluso no Day Use',
    image: '/images/campo-novo.jpg',
    noButton: true,
  },
  {
    title: 'Pesca Esportiva',
    description: 'Pesca no lago do balneário. Diversão para todas as idades.',
    price: 'R$ 20,00 por pessoa',
    image: '/images/pesca.jpg',
  },
  {
    title: 'Batismos',
    description: 'Batistério natural em ambiente sagrado. Disponível gratuitamente para igrejas.',
    price: 'Gratuito para igrejas',
    image: '/images/batismo.jpg',
  },
  {
    title: 'Área Kids',
    description: 'Parquinho seguro e divertido para os pequenos gastarem energia. (Para crianças até 5 anos)',
    price: 'Gratuito',
    image: '/images/area-kids-nova.jpg',
    noButton: true,
  },
  {
    title: 'Tirolesa',
    description: 'Aventura radical sobre as águas! Disponível para maiores de 12 anos.',
    price: 'Incluso no Day Use',
    image: '/images/tirolesa.jpg',
    noButton: true,
  },
  {
    title: 'Restaurante',
    description: 'Pratos caseiros e lanches para toda a família. Sabor da roça com qualidade.',
    price: 'Consumo à parte',
    image: '/images/restaurante.jpg',
    noButton: true,
  },
  {
    title: 'Chalés',
    description: 'Em breve! Hospedagem em chalés cercados pela natureza. Pré-reserve já!',
    price: 'Disponível em breve',
    image: '/images/chale-novo.jpg',
    link: 'https://forms.gle/murE6ZpRjWzJCmto8',
  },
];

export function ServicesSection() {
  return (
    <section id="servicos" className="py-12 sm:py-16 bg-transparent">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <span className="inline-block bg-secondary/10 text-secondary font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            🌟 Nossos Serviços
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-foreground mb-4">
            Experiências para toda a família
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto"
        >
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 100 } }
              }}
              whileTap={{ scale: 0.97 }}
              className="bg-card rounded-xl border shadow-card hover:shadow-elevated transition-shadow group overflow-hidden"
            >
              <div className="h-40 sm:h-48 overflow-hidden relative">
                {service.badge && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className="bg-sun text-foreground font-black text-[9px] px-2.5 py-1 rounded-lg shadow-lg transform rotate-2 border border-white/40 whitespace-nowrap uppercase tracking-tight">
                      {service.badge}
                    </div>
                  </div>
                )}
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="font-display font-bold text-base sm:text-lg mb-1.5 sm:mb-2">{service.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed">{service.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-primary font-bold text-xs sm:text-sm">{service.price}</span>
                  {!(service as any).noButton && (
                    <Button 
                      asChild={(service as any).link ? true : false}
                      size="sm" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold text-xs sm:text-sm shrink-0"
                      onClick={() => {
                        if (!(service as any).link) {
                          let tab = 'entrada';
                          if (service.title === 'Quiosques') tab = 'quiosques';
                          if (service.title === 'Quadriciclo') tab = 'quads';
                          if (service.title === 'Futebol de Sabão') tab = 'futebol';
                          if (service.title === 'Pesca Esportiva') tab = 'pesca';
                          
                          window.dispatchEvent(new CustomEvent('changeBookingTab', { detail: tab }));
                        }
                      }}
                    >
                      {(service as any).link ? (
                        <a href={(service as any).link} target="_blank" rel="noopener noreferrer">
                          Pré-reservar
                        </a>
                      ) : (
                        <span>Reservar</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
