import { useState } from 'react';
import { Ticket, X, User, UserPlus, Baby, CalendarIcon, Heart, Info, Phone, CheckCircle2, Accessibility, GraduationCap, Briefcase, Gift, Loader2 } from 'lucide-react';
import { BookingState, formatCurrency, isOperatingDay, ChildInfo, AdultInfo } from '@/lib/booking-types';
import { useServices } from '@/hooks/useServices';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

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
      handleFinishWizardInternal({ age: 60, category: 'inteira', isPCD: false, takeDonation: false }, 'senior');
      toast({ title: "Idoso Adicionado", description: "Entrada gratuita para maiores de 60 anos." });
      return;
    } else if (type === 'pcd') {
      handleFinishWizardInternal({ age: 30, category: 'pcd', isPCD: true, takeDonation: false }, 'pcd');
      toast({ title: "PCD / TEA Adicionado", description: "Entrada gratuita garantida." });
      return;
    } else if (type === 'child') {
      handleFinishWizardInternal({ age: 5, category: 'inteira', isPCD: false, takeDonation: false }, 'child');
      toast({ title: "Criança Adicionada", description: "Entrada gratuita até 11 anos." });
      return;
    } else if (type === 'adult') {
      setWizardData({ age: 30, category: 'inteira', isPCD: false, takeDonation: false });
      setWizardStep(3); // Adult Categories
      setIsWizardOpen(true);
    }
  };

  const handleFinishWizardInternal = (data: any, type: WizardType) => {
    const { age, isPCD, category, takeDonation } = data;
    const flags: any = { 
      age: age || (type === 'child' ? 5 : 30), 
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

    if (type === 'child' || (flags.age && flags.age <= 11)) {
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
      case 3: { // Adult Categories
        const entryFullStr = formatCurrency(getPrice('entry_full', 50)).replace(',00', '');
        const entryHalfStr = formatCurrency(getPrice('entry_half', 25)).replace(',00', '');

        const categories = [
          { id: 'inteira', label: 'Inteira', price: entryFullStr, emoji: '🎟️', color: 'emerald' },
          { id: 'solidaria', label: 'Solidária', price: entryHalfStr, emoji: '❤️', color: 'red' },
          { id: 'professor', label: 'Professor', price: entryHalfStr, emoji: '📚', color: 'blue' },
          { id: 'estudante', label: 'Estudante', price: entryHalfStr, emoji: '🎓', color: 'violet' },
          { id: 'servidor', label: 'Servidor', price: entryHalfStr, emoji: '🏛️', color: 'cyan' },
          { id: 'doador', label: 'Doador', price: entryHalfStr, emoji: '🩸', color: 'red' },
          { id: 'aniversariante', label: 'Bday', price: 'GRÁTIS', emoji: '🎂', color: 'amber' },
        ];

        return (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 py-2">
            <div className="text-center mb-2">
              <h4 className="text-xl font-bold text-emerald-950">Selecione a Categoria</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant="outline"
                  className="h-16 rounded-2xl border-2 flex flex-col items-center justify-center p-1 hover:bg-emerald-50 hover:border-emerald-500 transition-all"
                  onClick={() => {
                    const updates = { ...wizardData, category: cat.id, takeDonation: cat.id === 'solidaria' };
                    handleFinishWizardInternal(updates, 'adult');
                  }}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] font-bold uppercase tracking-tight">{cat.label}</span>
                  <span className="text-[9px] opacity-60">{cat.price}</span>
                </Button>
              ))}
            </div>
          </motion.div>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary shrink-0">
              <Ticket className="h-4 w-4" />
            </div>
            <h3 className="font-bold text-lg text-primary tracking-tight">ADICIONAR PESSOAS:</h3>
        </div>
      )}

      <div className={cn(
          "bg-white rounded-3xl border border-emerald-100 p-4 sm:p-5 shadow-sm space-y-5",
          hideMainInfo && "bg-transparent border-none shadow-none p-0"
      )}>
        {!hideMainInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <User className="h-3 w-3" /> NOME COMPLETO
              </label>
              <Input
                placeholder="Ex: João Silva"
                value={entry.name}
                onChange={(e) => onUpdateEntry({ name: e.target.value })}
                className="h-10 rounded-xl border-emerald-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> WHATSAPP
              </label>
              <Input
                placeholder="(00) 00000-0000"
                value={formatPhone(entry.phone || '')}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  onUpdateEntry({ phone: val });
                }}
                className="h-10 rounded-xl border-emerald-100"
                type="tel"
              />
            </div>
          </div>
        )}

        {!hideMainInfo && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-widest ml-1 flex items-center gap-1.5">
              <CalendarIcon className="h-3 w-3" /> DATA DA RESERVA
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(
                  "w-full h-10 justify-start font-bold text-xs rounded-xl",
                  entry.visitDate ? "border-emerald-500 bg-emerald-50" : "border-emerald-100"
                )}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-emerald-500" />
                  {entry.visitDate ? format(entry.visitDate, "dd/MM/yyyy", { locale: ptBR }) : "Escolha a data..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
                <Calendar
                  mode="single"
                  selected={entry.visitDate || undefined}
                  onSelect={(d) => {
                    if (d) {
                      const dayMap: Record<number, any> = { 0: 'domingo', 1: 'segunda', 5: 'sexta', 6: 'sabado' };
                      onUpdateEntry({ visitDate: d, dayOfWeek: dayMap[d.getDay()] || '' });
                    }
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0,0,0,0)) || !isOperatingDay(d)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleStartWizard('adult')} className="h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-2">
              <span>🎟️</span> ADULTO
            </Button>
            <Button onClick={() => handleStartWizard('child')} className="h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-2">
              <span>👶</span> CRIANÇA
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleStartWizard('senior')} variant="outline" className="h-10 rounded-xl border-emerald-100 text-emerald-700 font-bold text-[10px]">
              🧓 IDOSO (+60)
            </Button>
            <Button onClick={() => handleStartWizard('pcd')} variant="outline" className="h-10 rounded-xl border-emerald-100 text-blue-700 font-bold text-[10px]">
              ♿ PCD / TEA
            </Button>
          </div>

          <div className="space-y-2">
            {entry.adults.map((adult, i) => (
              <div key={`adult-${i}`} className="bg-emerald-50/30 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">
                    {adult.quantity > 1 ? `${adult.quantity}x ` : ''}
                    {adult.isTeacher ? 'Professor' : adult.isStudent ? 'Estudante' : adult.isServer ? 'Servidor' : adult.isBirthday ? 'Aniversariante' : adult.takeDonation ? 'Solidário' : 'Adulto'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700">{adult.age >= 60 || adult.isBirthday ? 'GRÁTIS' : formatCurrency((adult.takeDonation || adult.isTeacher || adult.isStudent) ? 25 : 50)}</span>
                  <Button variant="ghost" size="icon" onClick={() => onRemoveAdult(i)} className="h-6 w-6 text-red-400"><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {entry.children.map((child, i) => (
              <div key={`child-${i}`} className="bg-emerald-50/30 border border-emerald-100 rounded-xl px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Baby className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">{child.quantity > 1 ? `${child.quantity}x ` : ''}Criança</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700">GRÁTIS</span>
                  <Button variant="ghost" size="icon" onClick={() => onRemoveChild(i)} className="h-6 w-6 text-red-400"><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 flex gap-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-[10px] font-bold text-amber-900 leading-tight">
            Traga 1kg de alimento/livro/brinquedo para Meia-Entrada (R$ 25).
          </p>
        </div>
      </div>

      <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl p-4">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-emerald-950">ADICIONAR</DialogTitle>
          </DialogHeader>
          {renderWizardStep()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
