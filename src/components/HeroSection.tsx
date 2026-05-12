import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Ticket, Calculator, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 150, damping: 15 }
  },
};

export function HeroSection() {
  return (
    <section id="inicio" className="relative min-h-[70vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Parallax-like feel */}
      <motion.div
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 5, ease: "easeOut" }}
        className="absolute inset-0 bg-cover bg-[center_35%] z-0"
        style={{ backgroundImage: `url(/images/cachoeira-nova-larga.jpg)` }}
      />
      
      {/* Multi-layer Gradient Overlay for Depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/20 via-transparent to-emerald-950/20 z-[1]" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 container text-center px-4 py-20 sm:py-32"
      >
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 bg-sun text-slate-900 font-display font-black text-[10px] sm:text-xs px-5 sm:px-7 py-2 sm:py-2.5 rounded-full mb-6 sm:mb-8 shadow-2xl uppercase tracking-widest border border-white/20"
        >
          <Sparkles className="h-3 w-3 animate-pulse" /> 🌿 O Jardim do Éden em Ariquemes
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="font-display font-black text-[2.8rem] leading-[1] sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-white mb-6 sm:mb-8 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] px-2"
        >
          Balneário <span className="text-sun drop-shadow-none">Lessa</span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-white/90 font-bold text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto mb-10 sm:mb-12 font-body px-4 drop-shadow-md leading-relaxed italic"
        >
          Natureza, lazer, fé e aventura para toda a família em um ambiente acolhedor e cristão.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/20 shadow-2xl scale-[0.9] sm:scale-100 transition-transform hover:scale-105">
            <div className="flex text-sun drop-shadow-sm">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white font-black text-base sm:text-lg tracking-tight">Nota 4.8/5</span>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/20 shadow-2xl scale-[0.9] sm:scale-100 group transition-transform hover:scale-105">
            <div className="bg-emerald-500/20 p-1 rounded-lg">
              <Sparkles className="h-4 w-4 sm:h-5 sm:h-5 text-emerald-400 animate-pulse shrink-0" />
            </div>
            <span className="text-white font-black text-sm sm:text-lg truncate tracking-tight uppercase">Mais de 10.000 visitantes felizes</span>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <span className="text-xl">📍</span>
            <span className="text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] opacity-90">
              Aberto das 9h às 17h • Sextas, Sábados, Domingos, Segundas e Feriados
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center px-4 sm:px-0 relative z-10 flex-wrap"
        >
          <Button asChild size="lg" className="relative group bg-sun hover:bg-sun-light text-slate-950 text-base sm:text-xl px-8 sm:px-12 py-7 sm:py-8 font-display font-black shadow-[0_20px_50px_rgba(234,179,8,0.3)] w-full sm:w-auto rounded-[2rem] transition-all duration-300 hover:-translate-y-1 active:scale-95 overflow-hidden">
            <a href="#reservas" className="flex items-center gap-3">
              <Ticket className="h-6 w-6" /> Fazer Reserva 
              <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </a>
          </Button>

          <Button asChild size="lg" className="bg-emerald-600/20 hover:bg-emerald-600/40 text-white border-2 border-emerald-400/50 text-base sm:text-xl px-8 sm:px-10 py-7 sm:py-8 font-display font-bold backdrop-blur-md w-full sm:w-auto rounded-[2rem] shadow-xl transition-all hover:-translate-y-1 active:scale-95">
            <a href="#especiais" className="flex items-center gap-3">
              <Calculator className="h-6 w-6" /> Simular Meu Plano
            </a>
          </Button>
          
          <Button asChild size="lg" className="bg-blue-600/20 hover:bg-blue-600/40 text-white border-2 border-blue-400/50 text-base sm:text-xl px-8 sm:px-10 py-7 sm:py-8 font-display font-bold backdrop-blur-md w-full sm:w-auto rounded-[2rem] shadow-xl transition-all hover:-translate-y-1 active:scale-95">
            <Link to="/consultar" className="flex items-center gap-3">
              <Search className="h-6 w-6" /> Consultar Reserva
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      {/* Transitional Wave with improved color matching and smoothness */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg 
          className="relative block w-[calc(150%+1.3px)] h-[70px] sm:h-[120px]" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          {/* Layer 1: Soft Blur Shadow Wave */}
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-emerald-900/10 blur-xl"
          ></path>
          {/* Layer 2: Solid Base Wave */}
          <path 
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" 
            className="fill-emerald-50"
          ></path>
        </svg>
      </div>
    </section>
  );
}
