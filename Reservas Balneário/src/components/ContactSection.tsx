import { motion } from 'framer-motion';
import { MessageCircle, Phone, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WHATSAPP_NUMBER } from '@/lib/booking-types';

export function ContactSection() {
  return (
    <section id="contato" className="py-16 sm:py-24 bg-transparent relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(239,184,16,0.05),transparent_70%)] pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-sun/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary-light/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-foreground mb-6 tracking-tight">
            Entre em Contato
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-10 sm:mb-12 text-base sm:text-lg font-medium leading-relaxed">
            Tire suas dúvidas ou faça sua reserva diretamente pelo canal de sua preferência.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center items-center max-w-3xl mx-auto">
            <Button asChild size="lg" className="h-11 w-full max-w-[240px] sm:max-w-none bg-[#25D366] hover:bg-[#25D366]/90 text-white font-display font-black px-8 rounded-lg transition-all sm:flex-1">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                <MessageCircle className="h-5 w-5" /> <span className="uppercase tracking-wider text-xs">WhatsApp</span>
              </a>
            </Button>
            
            <Button asChild size="lg" className="h-11 w-full max-w-[240px] sm:max-w-none bg-sun hover:bg-sun-dark text-foreground font-display font-black px-8 rounded-lg transition-all sm:flex-1">
              <a href={`tel:+${WHATSAPP_NUMBER}`} className="flex items-center justify-center gap-2">
                <Phone className="h-5 w-5" /> <span className="uppercase tracking-wider text-xs">Ligar Agora</span>
              </a>
            </Button>
            
            <Button asChild size="lg" className="h-11 w-full max-w-[240px] sm:max-w-none bg-[#E1306C] hover:bg-[#E1306C]/90 text-white font-display font-black px-8 rounded-lg transition-all sm:flex-1">
              <a href="https://instagram.com/balneariolessa" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                <Instagram className="h-5 w-5" /> <span className="uppercase tracking-wider text-xs">Instagram</span>
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
