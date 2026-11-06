import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Ticket, Calculator, ChevronRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.01,
      delayChildren: 0,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  },
};

const MotionButton = motion(Button);

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
        className="relative z-10 container text-center px-3 sm:px-4 py-20 sm:py-32"
      >
        <motion.h1
          variants={itemVariants}
          className="font-display font-black text-[2.6rem] leading-[1] sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl text-white mb-4 sm:mb-6 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] px-2"
        >
          Balneário <span className="text-sun drop-shadow-none">Lessa</span>
        </motion.h1>

        <motion.div
          variants={itemVariants}
          className="inline-flex items-center gap-2 bg-sun text-slate-900 font-display font-black text-[10px] sm:text-xs px-5 sm:px-7 py-2 sm:py-2.5 rounded-full mb-5 sm:mb-7 shadow-2xl uppercase tracking-widest border border-white/20"
        >
          <Sparkles className="h-3 w-3 animate-pulse" /> 🌿 O Jardim do Éden em Ariquemes
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-white/95 font-bold text-[13px] sm:text-xl md:text-2xl max-w-[330px] sm:max-w-3xl mx-auto mb-6 sm:mb-10 font-body px-1 sm:px-4 drop-shadow-md leading-snug sm:leading-relaxed italic"
        >
          Natureza, lazer, fé e aventura para toda a família em um ambiente acolhedor e cristão.
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="flex justify-center mb-7 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 sm:gap-3 bg-black/60 backdrop-blur-md px-3.5 sm:px-6 py-2 rounded-2xl border border-white/10 shadow-2xl">
            <span className="text-base sm:text-xl shrink-0">📍</span>
            <span className="text-white font-black text-[9.5px] sm:text-xs uppercase tracking-wider sm:tracking-[0.2em] opacity-90">
              Aberto das 9h às 17h • Sextas, Sábados, Domingos e Feriados
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 sm:gap-6 justify-center items-center px-1 sm:px-0 relative z-10 sm:flex-wrap max-w-md sm:max-w-none mx-auto"
        >
          <Button
            asChild
            size="lg"
            className="order-1 sm:order-1 col-span-1 relative group bg-sun hover:bg-sun-light text-slate-950 text-xs sm:text-xl px-3 sm:px-12 py-5 sm:py-8 font-display font-black shadow-[0_20px_50px_rgba(234,179,8,0.3)] w-full sm:w-auto rounded-2xl sm:rounded-[2rem] transition-all duration-300 hover:-translate-y-1 active:scale-95 overflow-hidden whitespace-nowrap"
          >
            <a href="#reservas" className="flex items-center justify-center gap-1.5 sm:gap-3">
              <Ticket className="h-4 w-4 sm:h-6 sm:w-6 shrink-0" />
              <span>Fazer Reserva</span>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform shrink-0" />
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </a>
          </Button>

          <MotionButton 
            asChild 
            size="lg" 
            variants={itemVariants}
            animate={{ backdropFilter: "blur(12px)" }}
            className="order-3 sm:order-2 col-span-2 bg-emerald-800/60 hover:bg-emerald-700/80 text-white border-2 border-emerald-400/30 text-xs sm:text-xl px-4 sm:px-10 py-5 sm:py-8 font-display font-bold w-full sm:w-auto rounded-2xl sm:rounded-[2rem] shadow-xl transition-all hover:-translate-y-1 active:scale-95 whitespace-nowrap"
          >
            <a href="#especiais" className="flex items-center justify-center gap-2 sm:gap-3">
              <Calculator className="h-4 w-4 sm:h-6 sm:w-6 shrink-0" />
              <span>Simule seu Plano de Associado</span>
            </a>
          </MotionButton>
          
          <MotionButton 
            asChild 
            size="lg" 
            variants={itemVariants}
            animate={{ backdropFilter: "blur(12px)" }}
            className="order-2 sm:order-3 col-span-1 bg-blue-800/60 hover:bg-blue-700/80 text-white border-2 border-blue-400/30 text-xs sm:text-xl px-3 sm:px-10 py-5 sm:py-8 font-display font-bold w-full sm:w-auto rounded-2xl sm:rounded-[2rem] shadow-xl transition-all hover:-translate-y-1 active:scale-95 whitespace-nowrap"
          >
            <Link to="/consultar" className="flex items-center justify-center gap-1.5 sm:gap-3">
              <Search className="h-4 w-4 sm:h-6 sm:w-6 shrink-0" />
              <span>Consultar Reserva</span>
            </Link>
          </MotionButton>
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
