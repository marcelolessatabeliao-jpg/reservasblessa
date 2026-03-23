import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstagramGallery() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://elfsightcdn.com/platform.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Optional cleanup
    };
  }, []);

  return (
    <section id="galeria" className="py-12 sm:py-24 bg-card border-y">
      <div className="container px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-center md:text-left"
          >
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 text-primary font-bold tracking-widest uppercase text-xs">
              <Instagram className="h-4 w-4" /> Instagram Feed
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground">
              Acompanhe nosso <span className="text-primary italic">estilo Lessa</span>
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Button asChild variant="outline" className="rounded-full font-display font-bold px-8 py-6 border-2 group hover:bg-primary hover:text-white transition-all">
              <a href="https://www.instagram.com/balneariolessa/" target="_blank" rel="noopener noreferrer">
                @balneariolessa <Instagram className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full mt-8 min-h-[200px]"
        >
          <div className="elfsight-app-e577c4d4-c203-407c-9c8a-ff3b5c35b782" data-elfsight-app-lazy></div>
        </motion.div>
      </div>
    </section>
  );
}
