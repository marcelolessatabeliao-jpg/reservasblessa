import logo from '@/assets/logo.png';
import { WHATSAPP_NUMBER, OPERATING_HOURS, OPERATING_DAYS } from '@/lib/booking-types';
import { MessageCircle, Instagram, MapPin, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground py-8 sm:py-12">
      <div className="container px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div>
            <img src={logo} alt="Balneário Lessa" className="h-10 sm:h-12 mb-3 sm:mb-4" />
            <p className="text-primary-foreground/70 text-xs sm:text-sm">
              Natureza, lazer e aventura para toda a família.
            </p>
          </div>
          <div>
            <h4 className="font-display font-bold mb-2 sm:mb-3 text-sm sm:text-base">Horário</h4>
            <div className="flex items-start gap-2 text-xs sm:text-sm text-primary-foreground/70">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>{OPERATING_HOURS}</p>
                <p>{OPERATING_DAYS}</p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-display font-bold mb-2 sm:mb-3 text-sm sm:text-base">Contato</h4>
            <div className="space-y-2">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs sm:text-sm text-primary-foreground/70 hover:text-sun transition-colors">
                <MessageCircle className="h-4 w-4 shrink-0" /> WhatsApp
              </a>
              <a href="https://instagram.com/balneariolessa" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs sm:text-sm text-primary-foreground/70 hover:text-sun transition-colors">
                <Instagram className="h-4 w-4 shrink-0" /> @balneariolessa
              </a>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-primary-foreground/70">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> Localização com fácil acesso
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-primary-foreground/20 pt-4 sm:pt-6 text-center">
          <p className="text-xs sm:text-sm text-primary-foreground/50">
            © {new Date().getFullYear()} Balneário Lessa. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
