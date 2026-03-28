import { useState } from 'react';
import { Ticket, Plus, X, User, UserPlus, Baby, CalendarIcon, Heart, Info, Phone, ArrowLeft, ArrowRight, CheckCircle2, Accessibility, GraduationCap, Briefcase, Gift, Loader2 } from 'lucide-react';
import { BookingState, formatCurrency, isOperatingDay, ChildInfo, AdultInfo } from '@/lib/booking-types';
import { useServices } from '@/hooks/useServices';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { formatPhone } from '@/lib/utils/format';

interface Props {
  entry: BookingState['entry'];
  onUpdateEntry: (updates: Partial<BookingState['entry']>) => void;
  onRemoveAdult: (index: number) => void;
  onUpdateAdult: (index: number, updates: Partial<AdultInfo>) => void;
  onRemoveChild: (index: number) => void;
  onUpdateChild: (index: number, updates: Partial<ChildInfo>) => void;
  hideMainInfo?: boolean;
  hideTitle?: boolean;
}

type WizardType = 'adult' | 'child' | 'senior' | 'pcd' | null;
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function EntrySelector({ entry, onUpdateEntry, onRemoveAdult, onRemoveChild, onUpdateAdult, onUpdateChild, hideMainInfo, hideTitle }: Props) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<WizardType>(null);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardData, setWizardData] = useState<any>({ age: null, category: 'inteira', takeDonation: false, isPCD: false });

  const { getPrice } = useServices();

  const resetWizard = () => {
    setWizardType(null);
    setWizardStep(1);
    setWizardData({ age: null, category: 'inteira', takeDonation: false, isPCD: false });
  };

  const handleStartWizard = (type: WizardType) => {
    resetWizard();
    setWizardType(type);
    
    if (type === 'senior') {
      setWizardData({ age: 60, category: 'inteira', isPCD: false });
      setWizardStep(7); // Senior warning step
    } else if (type === 'pcd') {
      setWizardData({ age: 30, category: 'pcd', isPCD: true });
      setWizardStep(4); // Final display for PCD
    } else if (type === 'child') {
      setWizardData({ age: 5, category: 'inteira', isPCD: false });
      setWizardStep(6); // New age check step
    } else if (type === 'adult') {
      setWizardData({ age: 30, category: 'inteira', isPCD: false });
      setWizardStep(3); // Skip to step 3 (Categories)
    } else {
      setWizardStep(1);
    }
    
    setIsWizardOpen(true);
  };

  const handleFinishWizard = (categoryOverride?: string, takeDonationOverride?: boolean) => {
    const { age, isPCD } = wizardData;
    const category = categoryOverride ?? wizardData.category;
    const takeDonation = takeDonationOverride ?? wizardData.takeDonation;
    const flags: any = { 
      age: age || (wizardType === 'child' ? 5 : 30), 
      quantity: 1,
      isPCD: isPCD || category === 'pcd',
      isTeacher: category === 'professor',
      isStudent: category === 'estudante',
      isServer: category === 'servidor',
      isBloodDonor: category === 'doador',
      isBirthday: category === 'aniversariante',
      takeDonation: !!takeDonation
    };

    const isSamePerson = (p1: any, p2: any) => p1.age === p2.age && p1.isPCD === p2.isPCD && p1.isTeacher === p2.isTeacher && p1.isStudent === p2.isStudent && p1.isServer === p2.isServer && p1.isBloodDonor === p2.isBloodDonor && p1.isBirthday === p2.isBirthday && p1.takeDonation === p2.takeDonation;

    if (wizardType === 'child' || (flags.age && flags.age <= 11)) {
      const existingIdx = entry.children.findIndex(c => isSamePerson(c, flags));
      if (existingIdx >= 0) {
        onUpdateChild(existingIdx, { quantity: (entry.children[existingIdx].quantity || 1) + 1 });
      } else {
        onUpdateEntry({ children: [...entry.children, flags] });
      }
    } else {
      const existingIdx = entry.adults.findIndex(a => isSamePerson(a, flags));
      if (existingIdx >= 0) {
        onUpdateAdult(existingIdx, { quantity: (entry.adults[existingIdx].quantity || 1) + 1 });
      } else {
        onUpdateEntry({ adults: [...entry.adults, flags] });
      }
    }
    
    setIsWizardOpen(false);
    resetWizard();
  };

  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1: // Age Question
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
            <div className="text-center">
              <h4 className="text-xl font-black text-emerald-950 mb-2">Quem vai participar?</h4>
              <p className="text-sm text-emerald-800/60 font-bold italic">Selecione a faixa etária:</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <Button 
                variant="outline" 
                className="h-24 rounded-[2.5rem] border-2 border-primary/20 text-lg font-black bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all flex flex-col items-center justify-center gap-1 shadow-md group relative overflow-hidden"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 5 });
                  setWizardStep(2);
                }}
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 translate-x-1 -translate-y-1 group-hover:opacity-20 transition-opacity">👶</div>
                <span>Até 11 anos</span>
                <span className="text-[10px] uppercase font-bold opacity-80 text-emerald-600 group-hover:text-white/90">Lessa Kids (Entrada Grátis)</span>
              </Button>

              <Button 
                variant="outline" 
                className="h-24 rounded-[2.5rem] border-2 border-primary/20 text-lg font-black bg-white hover:bg-emerald-700 hover:text-white hover:border-emerald-700 transition-all shadow-md group relative overflow-hidden"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 30 });
                  setWizardStep(3); // Adult flow
                }}
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 translate-x-1 -translate-y-1 group-hover:opacity-20 transition-opacity">🧔</div>
                Entre 12 e 59 anos
              </Button>

              <Button 
                variant="outline" 
                className="h-24 rounded-[2.5rem] border-2 border-primary/20 text-lg font-black bg-white hover:bg-emerald-800 hover:text-white hover:border-emerald-800 transition-all flex flex-col items-center justify-center gap-1 shadow-md group relative overflow-hidden"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 60, isPCD: false });
                  setWizardStep(7);
                }}
              >
                <div className="absolute top-0 right-0 p-2 opacity-5 translate-x-1 -translate-y-1 group-hover:opacity-20 transition-opacity">👵</div>
                <span>Acima de 60 anos</span>
                <span className="text-[10px] uppercase font-bold opacity-80 text-emerald-600 group-hover:text-white/90">Melhor Idade (Entrada Grátis)</span>
              </Button>
            </div>
          </motion.div>
        );

      case 2: // Special Condition Check (PCD/TEA)
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
            <div className="text-center">
              <Accessibility className="h-12 w-12 text-blue-600 mx-auto mb-3" />
              <h4 className="text-xl font-black text-primary mb-2">Condição Especial?</h4>
              <p className="text-sm text-primary/60 font-bold px-8">A criança é portadora de necessidades especiais (PCD ou TEA)?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                className="h-24 rounded-[2rem] bg-[#0077b6] text-white font-black text-xl hover:bg-[#03045e] shadow-lg flex flex-col gap-1 transition-all"
                onClick={() => {
                  setWizardData({ ...wizardData, isPCD: true });
                  setWizardStep(4); 
                }}
              >
                Sim
                <span className="text-[10px] font-bold uppercase opacity-90">(PCD ou TEA)</span>
              </Button>

              <Button 
                variant="outline"
                className="h-24 rounded-[2rem] border-2 border-primary/20 text-xl font-black opacity-80 hover:opacity-100 transition-all shadow-sm"
                onClick={() => handleFinishWizard()}
              >
                Não
              </Button>
            </div>

            <div className="flex gap-2 mt-4 text-center justify-center">
              <Button variant="ghost" className="text-xs font-black uppercase text-muted-foreground" onClick={() => setWizardStep(1)}>← Voltar</Button>
            </div>
          </motion.div>
        );

      case 3: // Adult Categories
        const entryFullStr = formatCurrency(getPrice('entry_full', 50)).replace(',00', '');
        const entryHalfStr = formatCurrency(getPrice('entry_half', 25)).replace(',00', '');

        const categories = [
          { id: 'inteira', label: 'Entradas normais', sublabel: 'Inteira ou Solidária', price: `${entryFullStr} ou ${entryHalfStr}`, emoji: '🎟️', bg: 'bg-emerald-50', border: 'border-emerald-600/30', selectedBg: 'bg-emerald-100', selectedBorder: 'border-emerald-500', priceColor: 'text-emerald-700', labelColor: 'text-emerald-900', shadow: 'shadow-emerald-100' },
          { id: 'professor', label: 'Professor', sublabel: 'Lessa Professor Pass', price: entryHalfStr, emoji: '📚', bg: 'bg-blue-50', border: 'border-blue-200/30', selectedBg: 'bg-blue-100', selectedBorder: 'border-blue-500', priceColor: 'text-blue-700', labelColor: 'text-blue-900', shadow: 'shadow-blue-100' },
          { id: 'estudante', label: 'Estudante', sublabel: 'Lessa Estudante Pass', price: entryHalfStr, emoji: '🎓', bg: 'bg-violet-50', border: 'border-violet-200/30', selectedBg: 'bg-violet-100', selectedBorder: 'border-violet-500', priceColor: 'text-violet-700', labelColor: 'text-violet-900', shadow: 'shadow-violet-100' },
          { id: 'servidor', label: 'Servidor Público', sublabel: 'Lessa Servidor Pass', price: entryHalfStr, emoji: '🏛️', bg: 'bg-cyan-50', border: 'border-cyan-200/30', selectedBg: 'bg-cyan-100', selectedBorder: 'border-cyan-500', priceColor: 'text-cyan-700', labelColor: 'text-cyan-900', shadow: 'shadow-cyan-100' },
          { id: 'doador', label: 'Doador Sangue/Medula', sublabel: 'Benefício 50% OFF', price: entryHalfStr, emoji: '🩸', bg: 'bg-red-50', border: 'border-red-200/30', selectedBg: 'bg-red-100', selectedBorder: 'border-red-500', priceColor: 'text-red-700', labelColor: 'text-red-900', shadow: 'shadow-red-100' },
          { id: 'aniversariante', label: 'Aniversariante', sublabel: 'Da semana · com comprovação', price: 'GRÁTIS', emoji: '🎂', bg: 'bg-amber-50', border: 'border-amber-200/30', selectedBg: 'bg-amber-100', selectedBorder: 'border-amber-500', priceColor: 'text-amber-700', labelColor: 'text-amber-900', shadow: 'shadow-amber-100' },
        ];

        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 py-2">
            <div className="text-center mb-2">
              <h4 className="text-xl font-black text-emerald-950">Escolha a Categoria</h4>
              <p className="text-xs text-muted-foreground font-bold italic">R$ 50 ou desconto para categorias especiais</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    "flex flex-col items-center justify-center p-5 rounded-[2.5rem] border-[3px] transition-all cursor-pointer text-center gap-1 active:scale-95 select-none hover:shadow-xl",
                    cat.bg, cat.border, "hover:border-primary/40", cat.shadow
                  )}
                  onClick={() => {
                    setWizardData({ ...wizardData, category: cat.id });
                    if (cat.id === 'inteira') {
                      setWizardStep(4); // Goes to donation question
                    } else if (['professor', 'estudante', 'servidor', 'doador', 'aniversariante'].includes(cat.id)) {
                      setWizardStep(5); // Proof warning
                    } else {
                      handleFinishWizard(cat.id);
                    }
                  }}
                >
                  <span className="text-3xl mb-1">{cat.emoji}</span>
                  <span className={cn("block font-black text-xs leading-tight", cat.labelColor)}>{cat.label}</span>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full bg-white/70 mt-1", cat.priceColor)}>
                    {cat.price}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4 text-center justify-center">
              <Button variant="ghost" className="text-xs font-black uppercase text-muted-foreground" onClick={() => setWizardStep(1)}>← Voltar</Button>
            </div>
          </motion.div>
        );

      case 4: { // Donation or PCD
        if (wizardData.isPCD) {
          return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4 text-center">
              <div className="bg-blue-50 p-8 rounded-[3rem] border-2 border-blue-100 flex flex-col items-center gap-6 shadow-sm">
                <div className="bg-[#0077b6] text-white p-5 rounded-full shadow-lg">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-[#0077b6]">PCD / TEA Identificado</h4>
                  <p className="text-base font-bold text-[#0077b6]/80 mt-3 leading-relaxed">
                    Esta pessoa tem direito a entrada gratuita e <span className="underline">+1 acompanhante também grátis!</span>
                  </p>
                </div>
                <div className="bg-blue-100 border border-blue-200 rounded-2xl px-4 py-3 text-xs text-[#0077b6] font-bold leading-snug">
                  ⚠️ Necessário apresentar comprovação na entrada:<br/>
                  <span className="font-black">laudo médico, carteirinha PCD/TEA ou documento que comprove a condição</span>
                </div>
              </div>
              <Button 
                onClick={() => handleFinishWizard()}
                className="w-full h-14 rounded-2xl bg-[#0077b6] text-white font-black text-lg hover:bg-[#03045e] transition-all shadow-lg"
              >
                Confirmar e Adicionar
              </Button>
            </motion.div>
          );
        }

        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
            <div className="text-center">
              <Heart className="h-16 w-16 text-emerald-500 mx-auto mb-4 animate-[bounce_2s_infinite]" />
              <h4 className="text-2xl font-black text-emerald-950 uppercase tracking-tighter">Entrada Solidária?</h4>
              <p className="text-sm text-emerald-800/80 font-bold px-4 leading-relaxed mt-2">Pague apenas <span className="text-emerald-600 font-extrabold underline decoration-emerald-200 decoration-4">R$ 25,00</span> trazendo 1kg de alimento, livro, roupa ou brinquedo para doação.</p>
            </div>
            
            <div className="space-y-3 mt-6">
              <Button 
                className="w-full h-16 rounded-[2rem] bg-sun text-sun-dark font-black text-lg hover:bg-yellow-400 hover:text-sun-dark transition-all shadow-lg flex flex-col leading-tight py-2 px-6"
                onClick={() => handleFinishWizard(undefined, true)}
              >
                Sim, trará doação
                <span className="text-[10px] opacity-80 uppercase font-black">Pagar Meia-Entrada (R$ 25)</span>
              </Button>
              <Button 
                variant="outline"
                className="w-full h-16 rounded-[2rem] border-2 border-emerald-900/10 text-lg font-black opacity-80 hover:opacity-100 hover:border-emerald-900/40 transition-all flex flex-col leading-tight py-2 px-6"
                onClick={() => handleFinishWizard(undefined, false)}
              >
                Não, prefiro Inteira
                <span className="text-[10px] opacity-60 uppercase font-black">Pagar R$ 50,00</span>
              </Button>
            </div>

            <div className="flex gap-2 mt-4 text-center justify-center">
              <Button variant="ghost" className="text-xs font-black uppercase text-muted-foreground" onClick={() => setWizardStep(3)}>← Voltar</Button>
            </div>
          </motion.div>
        );
      }

      case 5: { // Proof Warning
        const proofLabels: Record<string, { label: string; emoji: string; color: string; docs: string }> = {
          professor: { label: 'Professor', emoji: '📚', color: 'text-blue-800', docs: 'contracheque, cartão funcional ou declaração da escola' },
          estudante: { label: 'Estudante', emoji: '🎓', color: 'text-violet-800', docs: 'carteirinha estudantil ou matrícula atualizada' },
          servidor: { label: 'Servidor Público', emoji: '🏛️', color: 'text-emerald-800', docs: 'cartão funcional ou contracheque' },
          doador: { label: 'Doador de Sangue/Medula', emoji: '🩸', color: 'text-red-800', docs: 'foto do comprovante de doação ou carteirinha de doador' },
          aniversariante: { label: 'Aniversariante da Semana', emoji: '🎂', color: 'text-amber-800', docs: 'RG ou documento com foto que comprove a data de nascimento' },
        };
        const info = proofLabels[wizardData.category] || { label: 'Categoria', emoji: '📄', color: 'text-primary', docs: 'documento comprobatório' };
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4 text-center">
            <div className="bg-amber-50 p-8 rounded-[3rem] border-2 border-amber-200 flex flex-col items-center gap-6 shadow-sm">
              <span className="text-5xl">{info.emoji}</span>
              <div>
                <h4 className={`text-xl font-black ${info.color}`}>
                  {wizardData.category === 'aniversariante' ? 'Gratuidade Confirmada!' : 'Meia-Entrada Confirmada!'}
                </h4>
                <p className="text-sm text-muted-foreground font-bold mt-2">
                  Apresente o comprovante na entrada.
                </p>
              </div>
              <div className="bg-amber-100/50 border border-amber-300/50 rounded-2xl px-4 py-3 text-xs text-amber-900 font-bold leading-snug">
                ⚠️ <span className="font-black">Documentos aceitos:</span><br/>
                {info.docs}
              </div>
            </div>
            <Button
              className="w-full h-14 rounded-2xl bg-emerald-700 text-white font-black text-lg hover:bg-emerald-800 transition-all shadow-lg"
              onClick={() => handleFinishWizard(wizardData.category)}
            >
              Confirmar e Adicionar
            </Button>
            <Button variant="ghost" className="w-full text-xs font-black uppercase text-muted-foreground" onClick={() => setWizardStep(3)}>← Voltar</Button>
          </motion.div>
        );
      }

      case 6: { // Child check
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="text-5xl">👶</span>
              <h4 className="text-xl font-black text-emerald-950">A criança tem até 11 anos?</h4>
              <p className="text-sm text-muted-foreground font-bold leading-tight">Crianças até 11 anos têm entrada gratuita.</p>
            </div>
            <div className="space-y-3 pt-4">
              <Button
                className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-black text-base hover:bg-emerald-700 transition-all shadow-lg"
                onClick={() => setWizardStep(2)} // Ask about PCD
              >
                Sim, tem até 11 anos
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-black text-sm hover:bg-amber-100 transition-all"
                onClick={() => {
                  setWizardType('adult');
                  setWizardStep(3);
                }}
              >
                Não — Adicionar como Adulto
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-xs font-black uppercase text-muted-foreground" onClick={() => setWizardStep(1)}>← Voltar</Button>
          </motion.div>
        );
      }

      case 7: { // Senior check
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="text-5xl">🧓</span>
              <h4 className="text-xl font-black text-emerald-950">Acima de 60 anos?</h4>
              <p className="text-sm text-muted-foreground font-bold leading-tight">Idosos acima de 60 anos têm entrada gratuita.</p>
            </div>
            <div className="space-y-3 pt-4">
              <Button
                className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-black text-base hover:bg-emerald-700 transition-all shadow-lg"
                onClick={() => handleFinishWizard('inteira', false)}
              >
                Sim, confirmar gratuidade
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-emerald-900/10 text-xs font-black"
                onClick={() => setWizardStep(1)}
              >
                Voltar e corrigir idade
              </Button>
            </div>
          </motion.div>
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary shrink-0">
            <Ticket className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <h3 className="font-gliker font-normal text-xl sm:text-2xl md:text-3xl leading-tight text-primary drop-shadow-sm text-center w-full">
            Selecione quem vai participar
            </h3>
        </div>
      )}

      <div className={cn(
          "bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white/60 p-4 sm:p-6 shadow-xl space-y-6",
          hideMainInfo && "bg-transparent backdrop-blur-none border-none shadow-none p-0"
      )}>
        {/* Nome & Telefone Row */}
        {!hideMainInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-3xl border border-primary/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
            <div>
              <label className="text-xs font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" /> Nome Completo
              </label>
              <Input
                placeholder="Ex: João Silva"
                value={entry.name}
                onChange={(e) => onUpdateEntry({ name: e.target.value })}
                className="bg-white/90 backdrop-blur-sm border-primary/20 h-11 rounded-xl focus-visible:ring-primary/50 shadow-sm transition-all text-foreground font-medium"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Phone className="h-4 w-4" /> WhatsApp
              </label>
              <Input
                placeholder="(00) 00000-0000"
                value={formatPhone(entry.phone || '')}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  onUpdateEntry({ phone: val });
                }}
                className="bg-white/90 backdrop-blur-sm border-primary/20 h-11 rounded-xl focus-visible:ring-primary/50 shadow-sm transition-all text-foreground font-medium"
                maxLength={15}
                type="tel"
              />
            </div>
          </div>
        )}

        {/* 1. Escolha a Data Row */}
        {!hideMainInfo && (
          <div className="space-y-3 p-4 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
            <label className="text-xs font-black flex items-center gap-2 text-primary uppercase tracking-widest">
              <CalendarIcon className="h-4 w-4" /> Escolha a Data da Reserva
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(
                  "w-full h-12 justify-start font-black text-sm rounded-2xl transition-all uppercase tracking-tight",
                  entry.visitDate 
                    ? "border-primary/40 bg-primary/5 text-primary hover:!bg-primary/10 hover:!text-primary shadow-sm" 
                    : "border-primary/20 bg-white hover:bg-primary/[0.05] hover:border-primary/50 hover:text-primary text-muted-foreground shadow-sm"
                )}>
                  <CalendarIcon className="mr-2 h-5 w-5 shrink-0 text-primary" />
                  {entry.visitDate ? (
                    <span className="flex items-center gap-2 flex-1">
                      {format(entry.visitDate, "dd/MM/yyyy", { locale: ptBR })}
                      <span className="bg-primary text-white px-2 py-0.5 rounded-lg text-[10px] uppercase font-black">
                        {format(entry.visitDate, "EEE", { locale: ptBR })}
                      </span>
                      <span className="ml-auto text-[10px] opacity-60 underline font-black">Mudar data</span>
                    </span>
                  ) : (
                    "Clique para escolher a data..."
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-[2rem] border-white shadow-2xl" align="start">
                <Calendar
                  mode="single"
                  selected={entry.visitDate || undefined}
                  onSelect={(d) => {
                    if (d) {
                      const dayMap: Record<number, any> = { 0: 'domingo', 1: 'segunda', 5: 'sexta', 6: 'sabado' };
                      const dayOfWeek = dayMap[d.getDay()];
                      if (dayOfWeek) {
                        onUpdateEntry({ visitDate: d, dayOfWeek });
                      } else {
                        onUpdateEntry({ visitDate: d });
                      }
                    } else {
                      onUpdateEntry({ visitDate: null, dayOfWeek: '' as any });
                    }
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today || !isOperatingDay(d);
                  }}
                  className="p-3 pointer-events-auto"
                  locale={ptBR}
                  classNames={{
                    day_today: entry.visitDate ? "bg-transparent text-foreground border border-primary/10" : "bg-accent text-accent-foreground"
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Participantes Summary Container */}
        <div className="space-y-6 pt-2">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <h4 className="font-gliker text-primary font-normal text-xl flex items-center gap-2">
                <User className="h-5 w-5" /> Adicionar Pessoas:
              </h4>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                    onClick={() => handleStartWizard('adult')} 
                    className="w-full h-14 rounded-2xl bg-[#006020] text-white hover:bg-[#004d1a] font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-1"
                >
                    <span className="text-sm">🎟️</span>
                    <span>Adulto</span>
                </Button>
                <Button 
                    onClick={() => handleStartWizard('child')} 
                    className="w-full h-14 rounded-2xl bg-[#006020] text-white hover:bg-[#004d1a] font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 py-1"
                >
                    <span className="text-sm">👶</span>
                    <span>Criança</span>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                    onClick={() => handleStartWizard('senior')} 
                    className="h-12 rounded-2xl bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-200 font-black text-[10px] shadow-sm transition-all active:scale-95"
                >
                    🧓 Idoso (60+)
                </Button>
                <Button 
                    onClick={() => handleStartWizard('pcd')} 
                    className="h-12 rounded-2xl bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-200 font-black text-[10px] shadow-sm transition-all active:scale-95"
                >
                    ♿ PCD / TEA
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-primary/60 text-xs uppercase tracking-widest pl-2">Lista de Acesso:</h4>
              
              {/* Adult Cards */}
              {entry.adults.map((adult, i) => (
                <div key={`adult-${i}`} className="bg-white/80 border border-primary/10 rounded-[1.5rem] px-4 py-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/5 p-2 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      {adult.isTeacher || adult.isStudent ? <GraduationCap className="h-4 w-4" /> :
                       adult.isServer ? <Briefcase className="h-4 w-4" /> :
                       adult.isBirthday ? <Gift className="h-4 w-4" /> :
                       adult.isPCD ? <Accessibility className="h-4 w-4" /> :
                       (adult as any).isBloodDonor ? <Heart className="h-4 w-4" /> :
                       adult.age >= 60 ? <UserPlus className="h-4 w-4" /> :
                       <User className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground">
                          {adult.quantity && adult.quantity > 1 ? `${adult.quantity}x ` : ''}
                          {adult.isTeacher ? 'Lessa Professor Pass' :
                           adult.isStudent ? 'Lessa Estudante Pass' :
                           adult.isServer ? 'Lessa Servidor Pass' :
                           (adult as any).isBloodDonor ? 'Doador de Sangue/Medula' :
                           adult.isBirthday ? 'Aniversariante da Semana' :
                           (adult.age >= 60 && adult.isPCD) ? 'Lessa Vitalício - PCD & TEA' :
                           adult.isPCD ? 'Lessa Inclusão - PCD & TEA' :
                           (adult.age >= 60) ? 'Lessa Vitalício' :
                           adult.takeDonation ? 'Adulto Solidário' :
                           'Adulto - Entrada Inteira'}
                        </span>
                      </div>
                      <p className="text-[10px] text-primary/60 font-bold">
                        {adult.takeDonation ? '❤️ Doação de 1kg de alimento' : '🎟️ Entrada Padrão'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-sm text-primary">
                      {(adult.age >= 60 || adult.isPCD || adult.isBirthday) 
                        ? "GRÁTIS" 
                        : formatCurrency(((adult.isTeacher || adult.isStudent || adult.isServer || (adult as any).isBloodDonor || adult.takeDonation) ? 25 : 50) * (adult.quantity || 1))
                      }
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (adult.quantity && adult.quantity > 1) {
                          onUpdateAdult(i, { quantity: adult.quantity - 1 });
                        } else {
                          onRemoveAdult(i);
                        }
                      }}
                      className="h-8 w-8 rounded-full text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Child Cards */}
              {entry.children.map((child, i) => (
                <div key={`child-${i}`} className="bg-white/80 border border-primary/10 rounded-[1.5rem] px-4 py-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/5 p-2 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Baby className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-black text-sm text-foreground">
                        {child.quantity && child.quantity > 1 ? `${child.quantity}x ` : ''}
                        Lessa Kids (Criança)
                      </span>
                      <p className="text-[10px] text-primary/60 font-bold">✨ Gratuidade até 11 anos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-sm text-whatsapp-dark">GRÁTIS</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (child.quantity && child.quantity > 1) {
                          onUpdateChild(i, { quantity: child.quantity - 1 });
                        } else {
                          onRemoveChild(i);
                        }
                      }}
                      className="h-8 w-8 rounded-full text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-sun/10 border border-sun/20 rounded-[2rem] p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sun-dark shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-sun-dark leading-relaxed">
            {entry.dayOfWeek === 'domingo' 
              ? 'DOMINGO: Valor único de R$ 50,00 Inteira. PCD e TEA, Crianças, Idosos e Aniversariantes mantêm gratuidade.'
              : 'DICA: Traga 1kg de alimento, livro, brinquedo ou roupas em bom estado para pagar Meia-Entrada (R$ 25,00).'}
          </p>
        </div>
      </div>

      {/* Simplified Guided Wizard Modal */}
      <Dialog open={isWizardOpen} onOpenChange={(open) => { if(!open) resetWizard(); setIsWizardOpen(open); }}>
        <DialogContent className="sm:max-w-md w-[100vw] h-full sm:h-auto sm:w-[95vw] bg-white rounded-none sm:rounded-[3rem] border-white shadow-2xl p-4 sm:p-6 overflow-y-auto">
          <DialogHeader className="mb-0 sm:mb-2 sticky top-0 bg-white z-20 py-2 border-b sm:border-none">
            <div className="flex items-center justify-center relative px-10">
              <DialogTitle className="text-xl sm:text-2xl font-black text-center text-primary font-gliker mt-2">
                {wizardType === 'pcd' ? 'PCD / TEA' : 
                  wizardType === 'senior' ? 'Melhor Idade' :
                  wizardType === 'child' ? 'Lessa Kids' :
                  'Novo Participante'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="relative px-2 pb-8">
            <AnimatePresence mode="wait">
              {renderWizardStep()}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
