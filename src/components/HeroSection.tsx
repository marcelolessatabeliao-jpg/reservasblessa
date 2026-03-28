import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section id="inicio" className="relative min-h-[50vh] sm:min-h-[65vh] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-[center_35%]"
        style={{ backgroundImage: `url(/images/cachoeira-nova-larga.jpg)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-primary/80" />

      <div className="relative z-10 container text-center px-4 py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ 
            opacity: 1, 
            y: [0, -5, 0],
          }}
          transition={{ 
            opacity: { duration: 0.7 },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className="inline-block bg-sun text-foreground font-display font-black text-[10px] sm:text-xs px-4 sm:px-6 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6 shadow-xl uppercase tracking-widest"
        >
          🌿 O Jardim do Éden em Ariquemes
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-display font-extrabold text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl lg:text-8xl text-white mb-4 sm:mb-6 drop-shadow-2xl px-2 break-words"
        >
          Balneário Lessa
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-white/90 font-bold text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto mb-8 sm:mb-10 font-body px-4 drop-shadow-md leading-relaxed"
        >
          Natureza, lazer, fé e aventura para toda a família
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
        >
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/20 shadow-lg scale-[0.9] sm:scale-100">
            <div className="flex text-sun drop-shadow-sm">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white font-black text-base sm:text-lg">Nota 4.8/5</span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/20 shadow-lg scale-[0.9] sm:scale-100 group">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-sun animate-pulse shrink-0" />
            <span className="text-white font-black text-sm sm:text-lg truncate">10.000+ visitantes felizes</span>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white/90 font-bold text-xs sm:text-base mb-10 px-6 py-3 bg-black/40 backdrop-blur-md block max-w-none mx-auto rounded-2xl border border-white/20 leading-tight w-fit shadow-2xl"
        >
          📍 Aberto das 9h às 17h • Sextas, Sábados, Domingos, Segun. e Feriados
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0 relative z-10"
        >
          <Button asChild size="lg" className="bg-sun hover:bg-sun/90 text-foreground text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 font-display font-bold shadow-lg w-full sm:w-auto">
            <motion.a whileTap={{ scale: 0.96 }} href="#reservas">🎫 Fazer Reserva</motion.a>
          </Button>
          <Button asChild size="lg" className="bg-white/20 hover:bg-white/30 text-white border border-white/40 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 font-display backdrop-blur-sm w-full sm:w-auto">
            <motion.a whileTap={{ scale: 0.96 }} href="#servicos">Nossos Serviços</motion.a>
          </Button>
        </motion.div>
      </div>

      {/* Transitional Wave */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none transform rotate-180">
        <svg 
          className="relative block w-[calc(110%+1.3px)] h-[50px] sm:h-[80px]" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-background"
          ></path>
        </svg>
      </div>
    </section>
  );
}
