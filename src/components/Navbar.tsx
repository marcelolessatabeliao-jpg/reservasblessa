import { useState } from 'react';
import { Menu, X, Calculator, Ticket, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';
import { Settings } from 'lucide-react';

const links = [
  { label: 'Início', href: '#inicio' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Reservas', href: '#reservas' },
  { label: 'Contato', href: '#contato' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-primary-foreground/10">
      <div className="container px-2 sm:px-4 flex items-center justify-between h-12 sm:h-16 relative">
        <a href="#inicio" className="flex items-center gap-1 sm:gap-3 min-w-0">
          <img src={logo} alt="Balneário Lessa" className="h-7 sm:h-10 shrink-0" />
          <span className="hidden sm:inline font-display font-black text-primary-foreground text-lg md:text-xl tracking-wide uppercase whitespace-nowrap">
            Balneário Lessa
          </span>
        </a>

        {/* Center label for mobile */}
        <span className="absolute left-1/2 -translate-x-1/2 sm:hidden font-display font-extrabold text-primary-foreground text-base tracking-wide uppercase whitespace-nowrap pointer-events-none opacity-80">
          Reservas
        </span>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-5 mr-2">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-sm font-bold text-primary-foreground/80 hover:text-sun transition-all hover:scale-105 active:scale-95">
                {l.label}
              </a>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="text-primary-foreground border-white/20 hover:bg-white/10 shrink-0">
              <a href="/admin" title="Painel de Administração">
                <Settings className="h-5 w-5" />
              </a>
            </Button>
            
            <Button asChild variant="ghost" className="text-primary-foreground hover:bg-white/10 font-bold border border-white/20">
              <a href="#especiais" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Simule seu plano
              </a>
            </Button>
            
            <Button asChild className="bg-sun hover:bg-sun-light text-foreground font-display font-black px-6 shadow-lg shadow-sun/20">
              <a href="#reservas" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" /> Reservar
              </a>
            </Button>
          </div>
        </div>

        {/* Mobile Toggle */}
        <Button variant="ghost" size="icon" className="lg:hidden text-primary-foreground shrink-0 hover:bg-white/10" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="lg:hidden bg-primary border-b border-primary-foreground/10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="container px-4 py-6 flex flex-col gap-4">
            {links.map(l => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-base font-bold py-2 text-primary-foreground/90 border-b border-white/5 hover:text-sun transition-colors">
                {l.label}
              </a>
            ))}
            
            <div className="flex flex-col gap-3 pt-2">
              <Button asChild variant="outline" className="text-white border-white/20 hover:bg-white/10 h-12 font-bold w-full">
                <a href="/admin" className="flex items-center justify-center gap-2">
                  <Settings className="h-5 w-5" /> Admin Dashboard
                </a>
              </Button>
              <Button asChild variant="outline" className="text-white border-white/20 hover:bg-white/10 h-12 font-bold" onClick={() => setOpen(false)}>
                <a href="#especiais" className="flex items-center justify-center gap-2">
                  <Calculator className="h-5 w-5" /> Simule seu plano
                </a>
              </Button>
              
              <Button asChild className="bg-sun hover:bg-sun-light text-foreground h-12 font-display font-black shadow-lg" onClick={() => setOpen(false)}>
                <a href="#reservas" className="flex items-center justify-center gap-2">
                  <Ticket className="h-5 w-5" /> Reservar Agora
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
