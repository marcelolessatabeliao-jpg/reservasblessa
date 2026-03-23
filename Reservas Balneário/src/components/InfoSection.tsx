import { Clock, MapPin, Car, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { OPERATING_HOURS, OPERATING_DAYS } from '@/lib/booking-types';

const infos = [
  { icon: Clock, title: 'Horário', desc: `${OPERATING_HOURS}\n${OPERATING_DAYS}` },
  { icon: MapPin, title: 'Localização', desc: 'Acesso fácil com estacionamento gratuito' },
  { icon: Car, title: 'Como Chegar', desc: 'Siga as placas a partir da rodovia principal' },
  { icon: Shield, title: 'Segurança', desc: 'Equipe treinada e salva-vidas de plantão' },
];

export function InfoSection() {
  return (
    <section id="informacoes" className="py-20 bg-card">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-secondary/10 text-secondary font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            ℹ️ Informações
          </span>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground">
            Informações Gerais
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {infos.map((info, i) => (
            <motion.div
              key={info.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center bg-background rounded-xl p-6 border shadow-card"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/10 text-secondary mb-3">
                <info.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display font-bold mb-2">{info.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{info.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
