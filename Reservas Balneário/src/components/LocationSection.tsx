import { motion } from 'framer-motion';
import { MapPin, Clock, Phone, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WHATSAPP_NUMBER, OPERATING_HOURS, OPERATING_DAYS } from '@/lib/booking-types';

export function LocationSection() {
  return (
    <section id="localizacao" className="py-12 sm:py-16 bg-transparent">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <span className="inline-block bg-secondary/10 text-secondary font-bold text-sm px-4 py-1.5 rounded-full mb-4">
            📍 Como Chegar
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-foreground mb-4">
            Localização
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl overflow-hidden border shadow-card h-[300px] sm:h-[400px]"
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3925.0!2d-63.0373169!3d-9.9505272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93cc906a204a0bd7%3A0xdfe1fe188886eaeb!2sVia%20Arar%C3%A1s%2C%203290%2C%20Ariquemes%20-%20RO%2C%20Brasil!5e0!3m2!1spt-BR!2sbr!4v1710000000000"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localização do Balneário Lessa"
            />
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col justify-center gap-4 sm:gap-6"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary shrink-0">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base mb-1">Endereço</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Via Ararás, 3290<br />
                  Ariquemes – RO, Brasil
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base mb-1">Horário de Funcionamento</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {OPERATING_HOURS}<br />
                  {OPERATING_DAYS}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary shrink-0">
                <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base mb-1">Contato</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  WhatsApp: (69) 9262-6140
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-2 items-center">
              <Button asChild size="lg" className="h-11 w-full max-w-[240px] sm:max-w-none bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold text-sm rounded-lg sm:flex-1">
                <a
                  href="https://www.google.com/maps/place/Via+Arar%C3%A1s,+3290,+Ariquemes+-+RO,+Brasil/@-9.950527,-63.037317,14z"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Abrir no Google Maps
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 w-full max-w-[240px] sm:max-w-none font-display font-bold text-sm border-primary text-primary hover:bg-primary hover:text-white transition-colors rounded-lg sm:flex-1">
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                  <Phone className="h-4 w-4 mr-2" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
