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
type WizardStep = 1 | 2 | 3 | 4;

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
      setIsWizardOpen(true);
      return;
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
              <h4 className="text-xl font-black text-primary mb-2">Qual a idade do participante?</h4>
              <p className="text-sm text-primary/60 font-bold">Escolha uma das opções abaixo:</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <Button 
                variant="outline" 
                className="h-20 rounded-[2rem] border-2 border-primary/20 text-lg font-black bg-primary/5 hover:bg-primary hover:text-white hover:border-primary transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 5 });
                  setWizardStep(2);
                }}
              >
                Até 11 anos
                <span className="text-[10px] uppercase font-bold opacity-80">Entrada Kids (Grátis)</span>
              </Button>

              <Button 
                variant="outline" 
                className="h-20 rounded-[2rem] border-2 border-primary/20 text-lg font-black bg-primary/5 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 30 });
                  setWizardStep(3); // Adult flow
                }}
              >
                Entre 12 e 59 anos
              </Button>

              <Button 
                variant="outline" 
                className="h-20 rounded-[2rem] border-2 border-primary/20 text-lg font-black bg-primary/5 hover:bg-primary hover:text-white hover:border-primary transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                onClick={() => {
                  setWizardData({ ...wizardData, age: 60, isPCD: false });
                  handleFinishWizard('inteira', false);
                }}
              >
                Acima de 60 anos
                <span className="text-[10px] uppercase font-bold opacity-80">Melhor Idade (Grátis)</span>
              </Button>
            </div>
          </motion.div>
        );

      case 2: // Special Condition Check (PCD/TEA)
        const isChildOrSenior = wizardData.age <= 11 || wizardData.age >= 60;
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
            <div className="text-center">
              <Accessibility className="h-12 w-12 text-whatsapp-dark mx-auto mb-3" />
              <h4 className="text-xl font-black text-primary mb-2">Possui alguma condição especial?</h4>
              <p className="text-sm text-primary/60 font-bold px-8">Essa pessoa é portadora de necessidades especiais (PCD ou TEA)?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                className="h-24 rounded-[2rem] bg-[#0077b6] text-white font-black text-xl hover:bg-[#03045e] shadow-lg flex flex-col gap-1 transition-all"
                onClick={() => {
                  setWizardData({ ...wizardData, isPCD: true });
                  setWizardStep(4); // Final display for special case
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

            <div className="flex gap-2 mt-4">
              <Button 
                variant="ghost" 
                className={cn(
                  "flex-1 text-xs font-black uppercase text-muted-foreground hover:text-primary hover:bg-transparent hover:underline transition-all",
                  (wizardType === 'child' || wizardType === 'senior') && "hidden"
                )}
                onClick={() => setWizardStep(1)}
              >
                ← Voltar
              </Button>
            </div>
          </motion.div>
        );

      case 3: // Adult Categories (Professor/Student/Server)
        const entryFullStr = formatCurrency(getPrice('entry_full', 50)).replace(',00', '');
        const entryHalfStr = formatCurrency(getPrice('entry_half', 25)).replace(',00', '');

        const categories = [
          { id: 'inteira', label: 'Entradas normais', sublabel: 'Inteira', price: entryFullStr, emoji: '🎟️', bg: 'bg-slate-50', border: 'border-slate-200', selectedBg: 'bg-slate-100', selectedBorder: 'border-slate-500', priceColor: 'text-slate-700', labelColor: 'text-slate-800' },
          { id: 'professor', label: 'Professor', sublabel: 'Lessa Professor Pass', price: entryHalfStr, emoji: '📚', bg: 'bg-blue-50', border: 'border-blue-100', selectedBg: 'bg-blue-100', selectedBorder: 'border-blue-500', priceColor: 'text-blue-700', labelColor: 'text-blue-900' },
          { id: 'estudante', label: 'Estudante', sublabel: 'Lessa Estudante Pass', price: entryHalfStr, emoji: '🎓', bg: 'bg-violet-50', border: 'border-violet-100', selectedBg: 'bg-violet-100', selectedBorder: 'border-violet-500', priceColor: 'text-violet-700', labelColor: 'text-violet-900' },
          { id: 'servidor', label: 'Servidor Público', sublabel: 'Lessa Servidor Pass', price: entryHalfStr, emoji: '🏛️', bg: 'bg-emerald-50', border: 'border-emerald-100', selectedBg: 'bg-emerald-100', selectedBorder: 'border-emerald-500', priceColor: 'text-emerald-700', labelColor: 'text-emerald-900' },
          { id: 'doador', label: 'Doador Sangue/Medula', sublabel: 'Benefício 50% OFF', price: entryHalfStr, emoji: '🩸', bg: 'bg-red-50', border: 'border-red-100', selectedBg: 'bg-red-100', selectedBorder: 'border-red-500', priceColor: 'text-red-700', labelColor: 'text-red-900' },
          { id: 'aniversariante', label: 'Aniversariante', sublabel: 'Da semana · com comprovação', price: 'GRÁTIS', emoji: '🎂', bg: 'bg-amber-50', border: 'border-amber-100', selectedBg: 'bg-amber-100', selectedBorder: 'border-amber-500', priceColor: 'text-amber-700', labelColor: 'text-amber-900' },
        ];

        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 py-2">
            <div className="text-center mb-4">
              <h4 className="text-xl font-black text-primary">Entradas</h4>
              <p className="text-sm text-muted-foreground font-bold italic">R$ 50 ou R$ 25 para categorias especiais</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const isSelected = wizardData.category === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={cn(
                      "flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center gap-1.5 active:scale-95 select-none",
                      isSelected ? `${cat.selectedBg} ${cat.selectedBorder} shadow-md scale-[1.02]` : `${cat.bg} ${cat.border} hover:scale-[1.01] hover:shadow-sm`
                    )}
                    onClick={() => {
                      setWizardData({ ...wizardData, category: cat.id });
                      if (cat.id === 'inteira' && entry.dayOfWeek !== 'domingo') {
                        setWizardStep(4); // Donation check
                      } else if (['professor', 'estudante', 'servidor', 'doador', 'aniversariante'].includes(cat.id)) {
                        setWizardStep(5); // Proof warning
                      } else {
                        handleFinishWizard(cat.id);
                      }
                    }}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <div>
                      <span className={cn("block font-black text-sm leading-tight", cat.labelColor)}>{cat.label}</span>
                      <span className="block text-[9px] text-muted-foreground font-semibold leading-tight mt-0.5">{cat.sublabel}</span>
                    </div>
                    <span className={cn("text-xs font-black px-2.5 py-0.5 rounded-full bg-white/70 mt-0.5", cat.priceColor)}>
                      {cat.price}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button 
                variant="ghost" 
                className={cn(
                  "flex-1 text-xs font-black uppercase text-muted-foreground hover:text-primary hover:bg-transparent hover:underline transition-all"
                )}
                onClick={() => setWizardStep(1)}
              >
                ← Voltar
              </Button>
            </div>
          </motion.div>
        );

      case 6: { // Child age check
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">👶</span>
              <h4 className="text-xl font-black text-primary">A criança tem até 11 anos?</h4>
              <p className="text-sm text-muted-foreground font-bold leading-tight">Crianças até 11 anos têm entrada gratuita.</p>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full h-14 rounded-2xl bg-[#006020] text-white font-black text-base hover:bg-[#004d1a] transition-all shadow-lg"
                onClick={() => handleFinishWizard('inteira', false)}
              >
                ✅ Sim, tem até 11 anos
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-black text-sm hover:bg-amber-100 hover:text-amber-900 transition-all leading-tight"
                onClick={() => {
                  setWizardType('adult');
                  setWizardStep(3);
                }}
              >
                ❌ Não — Adicionar como Adulto
                <span className="block text-[10px] font-semibold opacity-70">Use o botão “🎟️ + Adulto”</span>
              </Button>
            </div>
            
            <div className="bg-amber-100/50 border border-amber-200 rounded-2xl px-4 py-3 text-[10px] text-amber-900 font-bold leading-snug mt-2">
              ⚠️ <span className="font-black">Importante:</span> Por precaução, leve um documento (RG ou certidão) para comprovar a idade se solicitado.
            </div>

            <div className="flex gap-2 pt-2">
               <Button
                variant="ghost"
                className="flex-1 text-xs font-black uppercase text-muted-foreground"
                onClick={() => setWizardStep(1)}
              >
                ← Voltar
              </Button>
            </div>
          </motion.div>
        );
      }

      case 5: { // Proof required warning for professional categories
        const proofLabels: Record<string, { label: string; emoji: string; color: string; docs: string }> = {
          professor: { label: 'Professor', emoji: '📚', color: 'text-blue-800', docs: 'contracheque, cartão funcional ou declaração da escola' },
          estudante: { label: 'Estudante', emoji: '🎓', color: 'text-violet-800', docs: 'carteirinha estudantil ou matrícula atualizada' },
          servidor: { label: 'Servidor Público', emoji: '🏛️', color: 'text-emerald-800', docs: 'cartão funcional ou contracheque' },
          doador: { label: 'Doador de Sangue/Medula', emoji: '🩸', color: 'text-red-800', docs: 'foto do comprovante de doação ou carteirinha de doador' },
          aniversariante: { label: 'Aniversariante da Semana', emoji: '🎂', color: 'text-amber-800', docs: 'RG ou documento com foto que comprove a data de nascimento' },
        };
        const info = proofLabels[wizardData.category] || { label: 'Categoria', emoji: '📄', color: 'text-primary', docs: 'documento comprobatório' };
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-4 text-center">
            <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 flex flex-col items-center gap-4">
              <span className="text-5xl">{info.emoji}</span>
              <div>
                <h4 className={`text-xl font-black ${info.color}`}>
                  {wizardData.category === 'aniversariante' ? 'Benefício de gratuidade' : 'Benefício de Meia-Entrada'}
                </h4>
                <p className="text-sm text-muted-foreground font-bold mt-1">
                  {wizardData.category === 'aniversariante' ? 'Aniversariante da Semana — Grátis' : `${info.label} — R$ 25,00`}
                </p>
              </div>
                <div className="bg-amber-100 border border-amber-300 rounded-2xl px-4 py-3 text-xs text-amber-900 font-bold leading-snug text-left w-full">
                  ⚠️ <span className="font-black">Comprovação obrigatória na entrada:</span><br/>
                  {info.docs}
                </div>


            </div>
            <div className="space-y-3">
              <Button
                className="w-full h-14 rounded-2xl bg-[#006020] text-white font-black text-base hover:bg-[#004d1a] transition-all shadow-lg"
                onClick={() => handleFinishWizard(wizardData.category)}
              >
                ✅ Entendido — Adicionar
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs font-black uppercase text-muted-foreground hover:text-primary hover:bg-transparent hover:underline transition-all"
                onClick={() => setWizardStep(3)}
              >
                ← Voltar
              </Button>
            </div>
          </motion.div>
        );
      }

      case 4: {
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
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleFinishWizard()}
                  className="flex-[2] h-14 rounded-2xl bg-[#0077b6] text-white font-black text-lg hover:bg-[#03045e] transition-all shadow-lg"
                >
                  Confirmar e Adicionar
                </Button>
                <Button 
                  variant="outline" 
                  className={cn(
                    "flex-1 h-14 rounded-2xl border-2 border-primary/20 text-xs font-black uppercase text-muted-foreground",
                    wizardType === 'pcd' && "hidden"
                  )}
                  onClick={() => setWizardStep(2)}
                >
                  ← Voltar
                </Button>
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 py-4">
            <div className="text-center">
              <Heart className="h-12 w-12 text-sun mx-auto mb-3 animate-pulse" />
              <h4 className="text-xl font-black text-primary">Deseja ativar a Ação Solidária?</h4>
              <p className="text-sm text-primary/60 font-bold px-4 leading-relaxed">Leve 1kg de alimento, livros, roupas ou brinquedos e pague apenas <span className="text-sun-dark font-black underline">{formatCurrency(getPrice('entry_half', 25))} (Meia-Entrada)</span>.</p>
            </div>
            
            <div className="space-y-3 mt-6">
              <Button 
                className="w-full h-14 rounded-2xl bg-sun text-sun-dark font-black text-lg hover:bg-yellow-400 hover:text-sun-dark transition-all shadow-lg flex flex-col leading-tight py-2"
                onClick={() => handleFinishWizard(undefined, true)}
              >
                Sim, trará doação
                <span className="text-[10px] opacity-80 uppercase font-black">Pagar Meia-Entrada</span>
              </Button>
              <Button 
                variant="outline"
                className="w-full h-14 rounded-2xl border-2 border-primary/20 text-lg font-black opacity-80 hover:opacity-100 hover:border-primary/40 transition-all flex flex-col leading-tight py-2"
                onClick={() => handleFinishWizard(undefined, false)}
              >
                Não, prefiro Inteira
                <span className="text-[10px] opacity-60 uppercase font-black">Pagar {formatCurrency(getPrice('entry_full', 50))}</span>
              </Button>
            </div>

            <div className="flex gap-2 mt-6">
              <Button 
                variant="ghost" 
                className="flex-1 text-xs font-black uppercase text-muted-foreground hover:text-primary hover:bg-transparent hover:underline transition-all"
                onClick={() => setWizardStep(3)}
              >
                ← Voltar
              </Button>
            </div>
          </motion.div>
        );
      }

      case 7: {
        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-2 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">🧓</span>
              <h4 className="text-xl font-black text-primary">O participante tem 60 anos ou mais?</h4>
              <p className="text-sm text-muted-foreground font-bold leading-tight">Idosos acima de 60 anos têm entrada gratuita.</p>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full h-14 rounded-2xl bg-[#006020] text-white font-black text-base hover:bg-[#004d1a] transition-all shadow-lg"
                onClick={() => handleFinishWizard('inteira', false)}
              >
                ✅ Sim, tem 60 anos ou mais
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl border-2 border-primary/10 text-xs font-black"
                onClick={() => {
                  resetWizard();
                  setIsWizardOpen(false);
                }}
              >
                Cancelar
              </Button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-[10px] text-blue-900 font-bold leading-snug mt-2">
              ⚠️ <span className="font-black text-blue-950">Importante:</span> Por precaução, leve um documento com foto (RG ou CNH) para comprovar a idade se solicitado.
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
            {entry.visitDate ? (
              <Button 
                variant="outline" 
                className="w-full h-12 justify-center text-center font-black text-sm rounded-2xl border-primary/20 bg-primary/5 text-primary shadow-sm hover:bg-primary/10 transition-all uppercase tracking-tight"
                onClick={() => onUpdateEntry({ visitDate: null, dayOfWeek: '' })}
              >
                <CalendarIcon className="mr-2 h-5 w-5 shrink-0" />
                <span className="flex items-center gap-2">
                  {format(entry.visitDate, "dd/MM/yyyy", { locale: ptBR })}
                  <span className="bg-primary text-white px-2 py-0.5 rounded-lg text-[10px] uppercase font-black">
                    {format(entry.visitDate, "EEE", { locale: ptBR })}
                  </span>
                </span>
                <span className="ml-auto text-[10px] opacity-60 underline">Mudar data</span>
              </Button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 justify-start text-left font-black text-sm rounded-2xl border-white/80 bg-white/70 backdrop-blur-sm shadow-sm hover:bg-white hover:border-primary/30 hover:text-foreground transition-all uppercase tracking-tight text-muted-foreground">
                    <CalendarIcon className="mr-2 h-5 w-5 shrink-0 text-primary" />
                    Clique para escolher a data...
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
                        onUpdateEntry({ visitDate: null, dayOfWeek: '' });
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
            )}
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
                    className="h-12 rounded-2xl bg-[#006020]/90 text-white hover:bg-[#004d1a] font-black text-[10px] shadow-sm transition-all active:scale-95"
                >
                    🧓 Idoso (60+)
                </Button>
                <Button 
                    onClick={() => handleStartWizard('pcd')} 
                    className="h-12 rounded-2xl bg-[#006020]/90 text-white hover:bg-[#004d1a] font-black text-[10px] shadow-sm transition-all active:scale-95"
                >
                    ♿ PCD & TEA
                </Button>
              </div>
            </div>

          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-primary/60 text-xs uppercase tracking-widest pl-2">Lista de Acesso:</h4>
            
            {/* Adult Cards Ultra-Compact */}
            {entry.adults.map((adult, i) => (
              <div key={`adult-${i}`} className="bg-white/80 border border-primary/5 rounded-[1.5rem] px-4 py-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
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
                      {adult.isPCD && <span className="text-[8px] sm:text-[9px] bg-whatsapp/20 text-whatsapp-dark px-2 py-0.5 rounded-full font-black uppercase">♿ PCD</span>}
                      {(adult.isTeacher || adult.isStudent || adult.isServer || (adult as any).isBloodDonor) && <span className="text-[8px] sm:text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase">Meia-Entrada</span>}
                      {adult.takeDonation && <span className="text-[8px] sm:text-[9px] bg-sun/20 text-sun-dark px-2 py-0.5 rounded-full font-black uppercase">❤️ Solidária</span>}
                    </div>
                    {adult.isBirthday && <p className="text-[10px] text-sun-dark font-bold">🎂 Entrada grátis (mediante comprovação)</p>}
                    {adult.isPCD && <p className="text-[10px] text-whatsapp-dark font-bold">✨ entrada gratuita + 1 acompanhante gratuito</p>}
                    {adult.age >= 60 && !adult.isPCD && <p className="text-[10px] text-whatsapp-dark font-bold">✨ entrada gratuita - sócio vitalício</p>}
                    {(adult.isTeacher || adult.isStudent || adult.isServer || (adult as any).isBloodDonor) && <p className="text-[10px] text-primary font-bold">✨ benefício de meia-entrada 50% OFF</p>}
                    {adult.takeDonation && <p className="text-[10px] text-sun-dark font-bold">❤️ Levará 1kg de alimento para desconto ou outro donativo</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "font-black text-sm sm:text-base tabular-nums",
                    (adult.age >= 60 || adult.isPCD || adult.isBirthday) ? "text-whatsapp-dark" : "text-primary"
                  )}>
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
                    className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Child Cards Ultra-Compact */}
            {entry.children.map((child, i) => (
              <div key={`child-${i}`} className="bg-white/80 border border-primary/5 rounded-[1.5rem] px-4 py-3 flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/5 p-2 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Baby className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground">
                        {child.quantity && child.quantity > 1 ? `${child.quantity}x ` : ''}
                        {child.isPCD && child.age <= 11 ? 'Lessa Kids - PCD & TEA' :
                         child.isPCD ? 'Lessa Inclusão - PCD & TEA' :
                         'Lessa Kids'}
                      </span>
                      {child.isPCD && <span className="text-[8px] sm:text-[9px] bg-whatsapp/20 text-whatsapp-dark px-2 py-0.5 rounded-full font-black uppercase">♿ PCD</span>}
                      {child.isBirthday && <span className="text-[8px] sm:text-[9px] bg-sun/20 text-sun-dark px-2 py-0.5 rounded-full font-black uppercase">🎂 B-Day</span>}
                    </div>
                    {child.isPCD ? (
                      <p className="text-[10px] text-whatsapp-dark font-bold">✨ entrada gratuita + 1 acompanhante gratuito</p>
                    ) : (
                      <p className="text-[10px] text-whatsapp-dark font-bold">✨ entrada gratuita até 11 anos</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "font-black text-sm sm:text-base tabular-nums",
                    (child.age <= 11 || child.isPCD || child.isBirthday) ? "text-whatsapp-dark" : "text-primary"
                  )}>
                    {(child.age <= 11 || child.isPCD || child.isBirthday) 
                      ? "GRÁTIS" 
                      : formatCurrency(50 * (child.quantity || 1))
                    }
                  </span>
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
                    className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {(entry.adults.length === 0 && entry.children.length === 0) && (
              <div className="text-center py-10 border-2 border-dashed border-primary/10 rounded-[2.5rem] bg-primary/5">
                <p className="text-sm font-bold text-primary/40">Clique nos botões acima para começar a adicionar participantes.</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-sun/10 border border-sun/20 rounded-[2rem] p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-sun-dark shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-sun-dark leading-relaxed">
            {entry.dayOfWeek === 'domingo' 
              ? 'DOMINGO: Valor único de R$ 50,00 Inteira. PCD e TEA, Crianças, Idosos e Aniversariantes mantêm gratuidade. Professores, Estudantes e Servidores tem meia-entrada mediante comprovação.'
              : 'DICA: Traga 1kg de alimento, livro, brinquedo ou roupas em bom estado para pagar Meia-Entrada (R$ 25,00) em sextas, sábados, segundas e feriados.'}
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
                  wizardType === 'senior' ? 'Acesso Melhor Idade' :
                  wizardType === 'child' ? 'Acesso Kids' :
                  'Participante'}
              </DialogTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-[-10px] top-[-10px] rounded-full hover:bg-primary/5 text-primary z-50 bg-white/80 backdrop-blur-sm shadow-sm"
                onClick={() => { resetWizard(); setIsWizardOpen(false); }}
              >
                <X className="h-6 w-6" />
              </Button>
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
