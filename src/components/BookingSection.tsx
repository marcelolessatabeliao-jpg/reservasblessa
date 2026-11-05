import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBooking } from '@/hooks/useBooking';
import { EntrySelector } from '@/components/booking/EntrySelector';
import { KioskSelector } from '@/components/booking/KioskSelector';
import { AdditionalSelector } from '@/components/booking/AdditionalSelector';
import { ChaleSelector } from '@/components/booking/ChaleSelector';
import { CampingSelector } from '@/components/booking/CampingSelector';
import { BookingOverview } from '@/components/booking/BookingOverview';
import { QuadSelector } from '@/components/booking/QuadSelector';
import { formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { getGlobalSetting } from '@/lib/booking-service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  User, 
  Ticket, 
  Home, 
  Fish, 
  ClipboardList, 
  ArrowRight, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Calendar,
  Tent,
  Sun,
  Moon,
  Check,
  Crown,
  Lock,
  RefreshCw,
  Clock,
  Coffee,
  Users,
  Bike
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

export type MainModalidade = 'dayuse' | 'hospedagem' | 'camping';
export type DayUseSubTab = 'entradas' | 'quiosques' | 'quads' | 'diversoes';
export type HospedagemSubTab = 'chales' | 'quiosques' | 'quads' | 'diversoes';
export type CampingSubTab = 'camping' | 'quiosques' | 'quads' | 'diversoes';

export function BookingSection() {
  const { 
    booking, 
    updateEntry, 
    removeAdult, 
    updateAdult, 
    removeChild, 
    updateChild, 
    updateKiosk, 
    updateQuad, 
    updateAdditional,
    updateChale,
    updateCamping,
    resetOptionalServices,
    totals 
  } = useBooking();

  // Etapa principal: 'data' -> 'escolha_modalidade' -> 'servicos' -> 'resumo'
  const [currentStep, setCurrentStep] = useState<'data' | 'escolha_modalidade' | 'servicos' | 'resumo'>('data');
  const [modalidade, setModalidade] = useState<MainModalidade>('dayuse');
  
  // Sub-abas ativas dentro de cada modalidade
  const [dayUseTab, setDayUseTab] = useState<DayUseSubTab>('entradas');
  const [hospedagemTab, setHospedagemTab] = useState<HospedagemSubTab>('chales');
  const [campingTab, setCampingTab] = useState<CampingSubTab>('camping');

  // Modal de troca de modalidade para evitar confusão
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [targetModalidade, setTargetModalidade] = useState<MainModalidade | null>(null);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const isFirstMount = useRef(true);

  // Smooth scroll
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const element = document.getElementById('reservas-content');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentStep, modalidade, dayUseTab, hospedagemTab, campingTab]);

  // Sync kiosk dates
  useEffect(() => {
    if (!booking.entry.visitDate) return;
    const mainDate = booking.entry.visitDate.getTime();
    let needsKioskUpdate = false;
    booking.kiosks.forEach((k) => {
      if (k.quantity > 0 && (!k.date || k.date.getTime() !== mainDate)) {
        needsKioskUpdate = true;
      }
    });

    if (needsKioskUpdate) {
      booking.kiosks.forEach((k, i) => {
        if (k.quantity > 0 && (!k.date || k.date.getTime() !== mainDate)) {
          updateKiosk(i, { date: booking.entry.visitDate });
        }
      });
    }
  }, [booking.entry.visitDate, updateKiosk]);

  // Handle external "Reservar" triggers
  useEffect(() => {
    const handleTabChange = (e: any) => {
      const tabDetail = e?.detail;
      if (tabDetail === 'hospedagem' || tabDetail === 'chales') {
        setModalidade('hospedagem');
        setHospedagemTab('chales');
        setCurrentStep('servicos');
      } else if (tabDetail === 'camping') {
        setModalidade('camping');
        setCampingTab('camping');
        setCurrentStep('servicos');
      } else if (tabDetail === 'quiosques') {
        if (modalidade === 'hospedagem') {
          setHospedagemTab('quiosques');
        } else if (modalidade === 'camping') {
          setCampingTab('quiosques');
        } else {
          setModalidade('dayuse');
          setDayUseTab('quiosques');
        }
        setCurrentStep('servicos');
      } else if (tabDetail === 'quads' || tabDetail === 'quadriciclo') {
        if (modalidade === 'hospedagem') {
          setHospedagemTab('quads');
        } else if (modalidade === 'camping') {
          setCampingTab('quads');
        } else {
          setModalidade('dayuse');
          setDayUseTab('quads');
        }
        setCurrentStep('servicos');
      } else if (tabDetail === 'futebol' || tabDetail === 'pesca') {
        if (modalidade === 'hospedagem') {
          setHospedagemTab('diversoes');
        } else if (modalidade === 'camping') {
          setCampingTab('diversoes');
        } else {
          setModalidade('dayuse');
          setDayUseTab('diversoes');
        }
        setCurrentStep('servicos');
      } else {
        setModalidade('dayuse');
        setDayUseTab('entradas');
        setCurrentStep('servicos');
      }

      const element = document.getElementById('reservas');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('changeBookingTab', handleTabChange);
    return () => window.removeEventListener('changeBookingTab', handleTabChange);
  }, [modalidade]);

  useEffect(() => {
    getGlobalSetting('blocked_dates', []).then(val => {
      if (Array.isArray(val)) setBlockedDates(val);
    });
  }, []);

  const isSelectedDateBlocked = booking.entry.visitDate && blockedDates.includes(format(booking.entry.visitDate, 'yyyy-MM-dd'));

  // Executa troca de modalidade com limpeza mútua estrita
  const executeModalidadeSwitch = (mod: MainModalidade) => {
    setModalidade(mod);
    // Zera quiosques, quadriciclos e diversões selecionados na modalidade anterior para não entrar no carrinho
    resetOptionalServices();

    if (mod === 'dayuse') {
      // Limpa itens de hospedagem e camping
      updateChale({ packageType: null, chaleId: null, chaleIds: [], guestNames: [] });
      updateCamping({ peopleCount: 0, adultsCount: 0, childrenCount: 0, seniorsCount: 0 });
      setDayUseTab('entradas');
    } else if (mod === 'hospedagem') {
      // Limpa entradas de Day Use e camping (pois hospedagem em chalé tem entradas inclusas)
      updateEntry({ adults: [], children: [] });
      updateCamping({ peopleCount: 0, adultsCount: 0, childrenCount: 0, seniorsCount: 0 });
      setHospedagemTab('chales');
    } else if (mod === 'camping') {
      // Limpa entradas de Day Use e chalés (pois camping tem suas próprias regras e entradas inclusas)
      updateEntry({ adults: [], children: [] });
      updateChale({ packageType: null, chaleId: null, chaleIds: [], guestNames: [] });
      setCampingTab('camping');
    }
    setCurrentStep('servicos');
    setIsSwitchModalOpen(false);
  };

  const handleRequestSwitch = (mod: MainModalidade) => {
    if (mod === modalidade && currentStep === 'servicos') return;
    
    // Se já tem itens da modalidade atual, pede confirmação
    let hasCurrentItems = false;
    if (modalidade === 'dayuse') {
      hasCurrentItems = booking.entry.adults.length > 0 || booking.entry.children.length > 0;
    } else if (modalidade === 'hospedagem') {
      hasCurrentItems = !!booking.chale.packageType;
    } else if (modalidade === 'camping') {
      hasCurrentItems = (booking.camping.peopleCount || 0) > 0;
    }

    if (hasCurrentItems) {
      setTargetModalidade(mod);
      setIsSwitchModalOpen(true);
    } else {
      executeModalidadeSwitch(mod);
    }
  };

  // Contagens
  const countEntradas = booking.entry.adults.length + booking.entry.children.length;
  const countQuiosques = booking.kiosks.reduce((acc, k) => acc + k.quantity, 0);
  const countHospedagem = booking.chale.packageType ? 1 : 0;
  const countCamping = booking.camping.peopleCount || 0;
  const countQuads = booking.quads.reduce((acc, q) => acc + q.quantity, 0);
  const countDiversoes = booking.additionals.reduce((acc, a) => acc + a.quantity, 0);

  const handleGoToSummary = () => {
    if (!booking.entry.visitDate) {
      setCurrentStep('data');
      return;
    }
    setCurrentStep('resumo');
  };

  return (
    <section id="reservas" className="relative pt-6 pb-12 sm:pt-32 sm:pb-28 bg-transparent min-h-screen">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-40 hidden sm:block">
        <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-sun/10 rounded-full blur-3xl" />
      </div>

      <div className="container px-2 sm:px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center mb-6 sm:mb-8 px-2">
            <h2 className="font-sans font-black text-3xl sm:text-5xl md:text-6xl mb-3 text-emerald-950 drop-shadow-xl leading-tight text-balance italic">
              Agende sua Experiência
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border border-emerald-200/50 shadow-md">
                <Sparkles className="h-3 w-3 animate-pulse text-sun" /> Reservas em menos de 1 minuto
              </div>
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border border-amber-300 shadow-md">
                🏷️ 10% de Desconto Online
              </div>
            </div>
          </div>

          {/* BARRA SUPERIOR DE FLUXO COM O DESIGN PREMIUM VERDE ESCURO E DOURADO */}
          <div className="mb-4 bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl sm:rounded-3xl border-2 border-amber-400 shadow-xl space-y-2 relative overflow-hidden">
            {/* Brilho suave dourado */}
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
              {/* Etapa 1: Data */}
              <button
                onClick={() => setCurrentStep('data')}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  currentStep === 'data'
                    ? "bg-amber-400 text-emerald-950 shadow-md scale-100"
                    : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                )}
              >
                <Calendar className="w-4 h-4" />
                <span>1. Data da Visita</span>
                {booking.entry.visitDate && (
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                    currentStep === 'data' ? "bg-emerald-950 text-amber-300" : "bg-amber-400 text-emerald-950"
                  )}>
                    {format(booking.entry.visitDate, 'dd/MM')}
                  </span>
                )}
              </button>

              {/* Seletor Exclusivo das 3 Modalidades: DAY USE, HOSPEDAGEM (CHALÉS) E CAMPING */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="inline-flex bg-black/40 p-1 rounded-xl border border-white/20 backdrop-blur-md gap-1 flex-wrap">
                  {/* 1. BOTÃO DAY USE */}
                  <button
                    type="button"
                    disabled={!booking.entry.visitDate}
                    onClick={() => {
                      if (modalidade !== 'dayuse' && currentStep === 'servicos') {
                        handleRequestSwitch('dayuse');
                      } else {
                        executeModalidadeSwitch('dayuse');
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      !booking.entry.visitDate && "opacity-40 cursor-not-allowed",
                      currentStep === 'servicos' && modalidade === 'dayuse'
                        ? "bg-emerald-600 text-white shadow-md border border-emerald-400"
                        : (currentStep === 'servicos'
                            ? "opacity-60 text-slate-300 hover:opacity-100 hover:text-white"
                            : "text-emerald-100 hover:text-white")
                    )}
                    title={currentStep === 'servicos' && modalidade !== 'dayuse' ? "Clique para alternar para Day Use" : ""}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Day Use</span>
                    {currentStep === 'servicos' && modalidade === 'dayuse' && (
                      <span className="bg-amber-400 text-emerald-950 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                        Ativo
                      </span>
                    )}
                  </button>

                  {/* 2. BOTÃO HOSPEDAGEM (CHALÉS) */}
                  <button
                    type="button"
                    disabled={!booking.entry.visitDate}
                    onClick={() => {
                      if (modalidade !== 'hospedagem' && currentStep === 'servicos') {
                        handleRequestSwitch('hospedagem');
                      } else {
                        executeModalidadeSwitch('hospedagem');
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      !booking.entry.visitDate && "opacity-40 cursor-not-allowed",
                      currentStep === 'servicos' && modalidade === 'hospedagem'
                        ? "bg-amber-400 text-emerald-950 shadow-md font-black"
                        : (currentStep === 'servicos'
                            ? "opacity-60 text-slate-300 hover:opacity-100 hover:text-white"
                            : "text-emerald-100 hover:text-white")
                    )}
                    title={currentStep === 'servicos' && modalidade !== 'hospedagem' ? "Clique para alternar para Chalés" : ""}
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hospedagem (Chalés)</span>
                    {currentStep === 'servicos' && modalidade === 'hospedagem' && (
                      <span className="bg-emerald-950 text-amber-300 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                        Ativo
                      </span>
                    )}
                  </button>

                  {/* 3. BOTÃO CAMPING */}
                  <button
                    type="button"
                    disabled={!booking.entry.visitDate}
                    onClick={() => {
                      if (modalidade !== 'camping' && currentStep === 'servicos') {
                        handleRequestSwitch('camping');
                      } else {
                        executeModalidadeSwitch('camping');
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                      !booking.entry.visitDate && "opacity-40 cursor-not-allowed",
                      currentStep === 'servicos' && modalidade === 'camping'
                        ? "bg-emerald-500 text-white shadow-md font-black border border-emerald-300"
                        : (currentStep === 'servicos'
                            ? "opacity-60 text-slate-300 hover:opacity-100 hover:text-white"
                            : "text-emerald-100 hover:text-white")
                    )}
                    title={currentStep === 'servicos' && modalidade !== 'camping' ? "Clique para alternar para Camping" : ""}
                  >
                    <Tent className="w-3.5 h-3.5 text-amber-400" />
                    <span>Camping</span>
                    {currentStep === 'servicos' && modalidade === 'camping' && (
                      <span className="bg-amber-400 text-emerald-950 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                        Ativo
                      </span>
                    )}
                  </button>
                </div>

                {/* Opção abaixo das modalidades para alternar */}
                <button
                  type="button"
                  onClick={() => setCurrentStep('escolha_modalidade')}
                  className="text-[10.5px] font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 underline underline-offset-2 transition-all cursor-pointer mt-0.5"
                >
                  <RefreshCw className="w-3 h-3 text-amber-400" />
                  mude aqui a modalidade
                </button>
              </div>
            </div>

            {/* SE ESTIVER NA ETAPA DE SERVIÇOS: SUB-BARRA DE ABAS EXCLUSIVA DA MODALIDADE ATIVA */}
            {currentStep === 'servicos' && (
              <div className="pt-2 border-t border-white/10">
                {modalidade === 'dayuse' && (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-amber-400" /> Modalidade Day Use:
                      </span>
                      <button
                        onClick={() => handleRequestSwitch('hospedagem')}
                        className="text-[10px] text-emerald-200/90 hover:text-white flex items-center gap-1 underline underline-offset-2"
                      >
                        <RefreshCw className="w-3 h-3" /> Mudar para Chalés
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDayUseTab('entradas')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          dayUseTab === 'entradas'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Entradas</span>
                        {countEntradas > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countEntradas}</span>}
                      </button>

                      <button
                        onClick={() => setDayUseTab('quiosques')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          dayUseTab === 'quiosques'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Quiosques</span>
                        {countQuiosques > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countQuiosques}</span>}
                      </button>

                      <button
                        onClick={() => setDayUseTab('quads')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          dayUseTab === 'quads'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>Quadriciclos</span>
                        {countQuads > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countQuads}</span>}
                      </button>

                      <button
                        onClick={() => setDayUseTab('diversoes')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          dayUseTab === 'diversoes'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Fish className="w-3.5 h-3.5" />
                        <span>Diversões</span>
                        {countDiversoes > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countDiversoes}</span>}
                      </button>
                    </div>
                  </div>
                )}

                {modalidade === 'hospedagem' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                    <div className="flex items-center gap-2 bg-emerald-900/50 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-700/50">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-[11px] leading-tight">
                        <span className="font-black text-white block">Entrada: 14h</span>
                        <span className="text-emerald-200/80 text-[10px]">Saída: às 12h</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-900/50 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-700/50">
                      <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-[11px] leading-tight">
                        <span className="font-black text-white block">Café Incluso</span>
                        <span className="text-emerald-200/80 text-[10px]">Das 7h às 9h (Sex, Sáb, Dom)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-900/50 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-700/50">
                      <Users className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-[11px] leading-tight">
                        <span className="font-black text-white block">Capacidade</span>
                        <span className="text-emerald-200/80 text-[10px]">Até 2 adultos por chalé</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-emerald-900/50 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-emerald-700/50">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-[11px] leading-tight">
                        <span className="font-black text-white block">Day Use Incluso</span>
                        <span className="text-emerald-200/80 text-[10px]">Sex a Dom até 17h</span>
                      </div>
                    </div>
                  </div>
                )}

                {modalidade === 'camping' && (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Tent className="w-4 h-4 text-amber-400" /> Modalidade Área de Camping (Entradas Inclusas):
                      </span>
                      <button
                        onClick={() => handleRequestSwitch('dayuse')}
                        className="text-[10px] text-emerald-200/90 hover:text-white flex items-center gap-1 underline underline-offset-2"
                      >
                        <RefreshCw className="w-3 h-3" /> Mudar para Day Use
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCampingTab('camping')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          campingTab === 'camping'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Tent className="w-3.5 h-3.5" />
                        <span>Camping</span>
                        {countCamping > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countCamping}</span>}
                      </button>

                      <button
                        onClick={() => setCampingTab('quiosques')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          campingTab === 'quiosques'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Quiosques</span>
                        {countQuiosques > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countQuiosques}</span>}
                      </button>

                      <button
                        onClick={() => setCampingTab('quads')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          campingTab === 'quads'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Bike className="w-3.5 h-3.5" />
                        <span>Quadriciclos</span>
                        {countQuads > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countQuads}</span>}
                      </button>

                      <button
                        onClick={() => setCampingTab('diversoes')}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all",
                          campingTab === 'diversoes'
                            ? "bg-amber-400 text-emerald-950 shadow-sm font-black"
                            : "bg-white/10 text-emerald-100 hover:bg-white/20"
                        )}
                      >
                        <Fish className="w-3.5 h-3.5" />
                        <span>Diversões</span>
                        {countDiversoes > 0 && <span className="text-[9px] bg-emerald-950 text-amber-300 px-1.5 rounded-full font-bold">{countDiversoes}</span>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CONTEÚDO PRINCIPAL DAS ETAPAS */}
          <div id="reservas-content" className="bg-transparent sm:bg-white rounded-none sm:rounded-[2.5rem] p-0 sm:p-10 min-h-[400px]">
            {isSelectedDateBlocked ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white sm:bg-transparent rounded-[2.5rem] space-y-6">
                <AlertTriangle className="h-20 w-20 text-red-500 opacity-80" />
                <h3 className="text-3xl font-black text-emerald-950">Data Indisponível</h3>
                <p className="text-lg text-emerald-800 font-medium max-w-lg">
                  O balneário não estará recebendo novas reservas para a data selecionada ({format(booking.entry.visitDate!, 'dd/MM/yyyy')}). Por favor, escolha outra data.
                </p>
                <Button
                  onClick={() => updateEntry({ visitDate: null })}
                  className="mt-4 h-16 px-8 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-lg"
                >
                  <CalendarIcon className="mr-2 h-5 w-5" />
                  Escolher Outra Data
                </Button>
                <a
                  href="/consultar"
                  className="mt-2 inline-flex items-center justify-center gap-2 font-bold h-12 px-8 rounded-2xl border-2 border-primary/30 text-primary hover:bg-primary/5 transition-all text-base bg-white"
                >
                  <ClipboardList className="h-5 w-5" />
                  Consultar Reserva Existente
                </a>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* 1. DATA DA VISITA E CONTATO */}
                {currentStep === 'data' && (
                  <motion.div
                    key="data"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-gliker text-2xl text-emerald-950">1. Data da Visita & Identificação</h3>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Defina o dia da sua reserva e seus dados para contato
                        </p>
                      </div>
                    </div>

                    <EntrySelector
                      entry={booking.entry}
                      onUpdateEntry={updateEntry}
                      onRemoveAdult={removeAdult}
                      onUpdateAdult={updateAdult}
                      onRemoveChild={removeChild}
                      onUpdateChild={updateChild}
                      hideMainInfo={false}
                      onlyMainInfo={true}
                      hideTitle={true}
                      blockedDates={blockedDates}
                    />

                    <div className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-3 px-4">
                      <Button 
                        size="lg"
                        disabled={!booking.entry.visitDate || !booking.entry.name || !booking.entry.phone}
                        onClick={() => setCurrentStep('escolha_modalidade')}
                        className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-bold h-16 px-10 rounded-2xl shadow-xl shadow-primary/20 text-lg group"
                      >
                        Continuar para Escolha do Serviço <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* 2. ESCOLHA DAS 3 MODALIDADES PRINCIPAIS (DAY USE, HOSPEDAGEM EM CHALÉS, ÁREA DE CAMPING) */}
                {currentStep === 'escolha_modalidade' && (
                  <motion.div
                    key="escolha_modalidade"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-8"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="font-sans font-black text-2xl sm:text-4xl text-emerald-950 tracking-tight">
                        O que você deseja reservar?
                      </h3>
                      <p className="text-xs sm:text-sm font-bold text-emerald-800 uppercase tracking-wider">
                        Data Selecionada: {booking.entry.visitDate ? format(booking.entry.visitDate, "dd 'de' MMMM (EEEE)", { locale: ptBR }) : ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                      {/* CARD MODALIDADE 1: DAY USE */}
                      <div
                        onClick={() => executeModalidadeSwitch('dayuse')}
                        className="group relative rounded-[2.5rem] bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-6 cursor-pointer shadow-2xl border-2 border-emerald-600/60 hover:border-amber-400 transition-all duration-300 flex flex-col justify-between overflow-hidden hover:scale-[1.01]"
                      >
                        <div className="relative z-10 space-y-3.5">
                          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            PASSAR O DIA (9h às 17h)
                          </div>

                          <h4 className="font-sans font-black text-xl sm:text-2xl text-white group-hover:text-amber-300 transition-colors">
                            Day Use no Balneário
                          </h4>

                          <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                            Aproveite as piscinas, cachoeiras naturais, novo toboágua espiral e área de lazer completa durante o dia.
                          </p>

                          <div className="space-y-2 pt-3 border-t border-emerald-800/60 text-xs font-bold text-emerald-200">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Entradas Adulto, Criança, Idoso e Meia</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Quiosques exclusivos com churrasqueira</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Pesca Esportiva e Futebol de Sabão</span>
                            </div>
                          </div>
                        </div>

                        <Button className="mt-6 w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-wider shadow-lg">
                          Escolher Day Use <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </div>

                      {/* CARD MODALIDADE 2: HOSPEDAGEM EM CHALÉS */}
                      <div
                        onClick={() => executeModalidadeSwitch('hospedagem')}
                        className="group relative rounded-[2.5rem] bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-6 cursor-pointer shadow-2xl border-2 border-amber-400 ring-4 ring-amber-400/20 hover:border-amber-300 transition-all duration-300 flex flex-col justify-between overflow-hidden hover:scale-[1.01]"
                      >
                        <div className="relative z-10 space-y-3.5">
                          <div className="inline-flex items-center gap-2 bg-amber-400 text-emerald-950 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
                            <Crown className="w-3.5 h-3.5 fill-emerald-950" />
                            EXCLUSIVO • SUÍTES & CHALÉS
                          </div>

                          <h4 className="font-sans font-black text-xl sm:text-2xl text-white group-hover:text-amber-300 transition-colors">
                            Hospedagem em Chalés
                          </h4>

                          <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                            Pernoite privativo em chalé com suíte, cama casal, ar-condicionado, TV, frigobar, café da manhã e entradas já inclusas!
                          </p>

                          <div className="space-y-2 pt-3 border-t border-emerald-800/60 text-xs font-bold text-emerald-200">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-amber-300 font-black">Entradas e Day Use 100% Inclusos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Café da manhã incluso servido até as 09h</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Check-in 15h / Check-out 11h</span>
                            </div>
                          </div>
                        </div>

                        <Button className="mt-6 w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black uppercase text-xs tracking-wider shadow-lg">
                          Escolher Hospedagem <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </div>

                      {/* CARD MODALIDADE 3: ÁREA DE CAMPING */}
                      <div
                        onClick={() => executeModalidadeSwitch('camping')}
                        className="group relative rounded-[2.5rem] bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-6 cursor-pointer shadow-2xl border-2 border-emerald-500/70 hover:border-amber-400 transition-all duration-300 flex flex-col justify-between overflow-hidden hover:scale-[1.01]"
                      >
                        <div className="relative z-10 space-y-3.5">
                          <div className="inline-flex items-center gap-2 bg-emerald-500/30 text-emerald-200 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                            <Tent className="w-3.5 h-3.5 text-amber-400" />
                            NATUREZA • SOB AS ESTRELAS
                          </div>

                          <h4 className="font-sans font-black text-xl sm:text-2xl text-white group-hover:text-amber-300 transition-colors">
                            Área de Camping
                          </h4>

                          <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                            Acampe com sua barraca em meio à natureza com estrutura completa de banheiros, duchas e acesso ao balneário.
                          </p>

                          <div className="space-y-2 pt-3 border-t border-emerald-800/60 text-xs font-bold text-emerald-200">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-amber-300 font-black">Apenas R$ 100 por pessoa</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Entradas no Balneário Inclusas</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Estrutura com banheiros e duchas quentes</span>
                            </div>
                          </div>
                        </div>

                        <Button className="mt-6 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider shadow-lg">
                          Escolher Camping <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep('data')}
                        className="font-bold text-muted-foreground hover:text-emerald-900"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Mudar Data da Visita
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* 3. SERVIÇOS DA MODALIDADE ESCOLHIDA */}
                {currentStep === 'servicos' && (
                  <motion.div
                    key="servicos"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {/* SE DAY USE */}
                    {modalidade === 'dayuse' && (
                      <div className="space-y-8">
                        {dayUseTab === 'entradas' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                  <Ticket className="h-6 w-6" />
                                </div>
                                <div>
                                  <h3 className="font-gliker text-2xl text-emerald-950">Entradas Day Use</h3>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {booking.entry.visitDate ? format(booking.entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR }) : ''}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <EntrySelector
                              entry={booking.entry}
                              onUpdateEntry={updateEntry}
                              onRemoveAdult={removeAdult}
                              onUpdateAdult={updateAdult}
                              onRemoveChild={removeChild}
                              onUpdateChild={updateChild}
                              hideMainInfo={true}
                              onlyMainInfo={false}
                              hideTitle={true}
                              blockedDates={blockedDates}
                            />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => handleRequestSwitch('hospedagem')} className="font-bold text-muted-foreground">
                                <RefreshCw className="w-4 h-4 mr-2" /> Trocar para Hospedagem
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setDayUseTab('quiosques')}
                                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quiosques <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {dayUseTab === 'quiosques' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Home className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-gliker text-2xl text-emerald-950">Quiosques para seu conforto</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  Garanta um espaço exclusivo com churrasqueira para sua família
                                </p>
                              </div>
                            </div>

                            <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setDayUseTab('entradas')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Entradas
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setDayUseTab('quads')}
                                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quadriciclos <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {dayUseTab === 'quads' && (
                          <div className="space-y-6">
                            <QuadSelector quads={booking.quads} onUpdate={updateQuad} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setDayUseTab('quads')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quadriciclos
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setDayUseTab('diversoes')}
                                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Diversões <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {dayUseTab === 'diversoes' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Fish className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-gliker text-2xl text-emerald-950">Diversões & Atividades</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  Pesca esportiva e futebol de sabão
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'futebol-sabao')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'futebol-sabao');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'pesca')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'pesca');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                            </div>

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setDayUseTab('quads')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quadriciclos
                              </Button>
                              <Button 
                                size="lg"
                                onClick={handleGoToSummary}
                                className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white font-black h-16 px-10 rounded-2xl shadow-lg"
                              >
                                Ver Resumo e Finalizar <ArrowRight className="ml-2 h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SE HOSPEDAGEM (CHALÉS EXCLUSIVOS) */}
                    {modalidade === 'hospedagem' && (
                      <div className="space-y-8">
                        {hospedagemTab === 'chales' && (
                          <div className="space-y-6">
                            <ChaleSelector
                              chale={booking.chale}
                              onUpdate={updateChale}
                              visitDate={booking.entry.visitDate}
                              onUpdateVisitDate={(date) => updateEntry({ visitDate: date })}
                            />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => handleRequestSwitch('dayuse')} className="font-bold text-muted-foreground">
                                <RefreshCw className="w-4 h-4 mr-2" /> Trocar para Day Use
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setHospedagemTab('quiosques')}
                                  className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-slate-950 font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quiosques (Opcional) <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {hospedagemTab === 'quiosques' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Home className="h-6 w-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-gliker text-2xl text-emerald-950">Quiosques para seu churrasco</h3>
                                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                                    Opcional
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                  Item Opcional • Garanta uma churrasqueira exclusiva para seu churrasco durante a hospedagem (não é obrigatório)
                                </p>
                              </div>
                            </div>

                            <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setHospedagemTab('chales')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Chalés
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setHospedagemTab('quads')}
                                  className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quadriciclos (Opcional) <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {hospedagemTab === 'quads' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                                Opcional
                              </span>
                              <span className="text-xs font-bold text-emerald-900">
                                Reserve também passeios de quadriciclo para sua estadia (opcional)
                              </span>
                            </div>
                            <QuadSelector quads={booking.quads} onUpdate={updateQuad} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setHospedagemTab('quiosques')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quiosques
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setHospedagemTab('diversoes')}
                                  className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Diversões (Opcional) <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {hospedagemTab === 'diversoes' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Fish className="h-6 w-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-gliker text-2xl text-emerald-950">Diversões & Atividades</h3>
                                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                                    Opcional
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                  Item Opcional • Pesca esportiva e futebol de sabão para complementar a estadia (não é obrigatório)
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'futebol-sabao')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'futebol-sabao');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'pesca')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'pesca');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                            </div>

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setHospedagemTab('quads')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quadriciclos
                              </Button>
                              <Button 
                                size="lg"
                                onClick={handleGoToSummary}
                                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-16 px-10 rounded-2xl shadow-lg"
                              >
                                Ver Resumo e Finalizar <ArrowRight className="ml-2 h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SE CAMPING (ÁREA DE CAMPING EXCLUSIVA) */}
                    {modalidade === 'camping' && (
                      <div className="space-y-8">
                        {campingTab === 'camping' && (
                          <div className="space-y-6">
                            <CampingSelector
                              camping={booking.camping}
                              onUpdate={updateCamping}
                            />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => handleRequestSwitch('dayuse')} className="font-bold text-muted-foreground">
                                <RefreshCw className="w-4 h-4 mr-2" /> Trocar para Day Use
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setCampingTab('quiosques')}
                                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quiosques <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {campingTab === 'quiosques' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Home className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-gliker text-2xl text-emerald-950">Quiosques para Campistas</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  Garanta uma churrasqueira exclusiva para sua estadia no camping
                                </p>
                              </div>
                            </div>

                            <KioskSelector kiosks={booking.kiosks} onUpdate={updateKiosk} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setCampingTab('camping')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Camping
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setCampingTab('quads')}
                                  className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Quadriciclos <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {campingTab === 'quads' && (
                          <div className="space-y-6">
                            <QuadSelector quads={booking.quads} onUpdate={updateQuad} />

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setCampingTab('quiosques')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quiosques
                              </Button>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                  size="lg"
                                  onClick={() => setCampingTab('diversoes')}
                                  className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-14 px-8 rounded-2xl shadow-lg"
                                >
                                  Próximo: Diversões <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        {campingTab === 'diversoes' && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-secondary/10 rounded-2xl text-secondary shadow-sm">
                                <Fish className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-gliker text-2xl text-emerald-950">Diversões & Atividades</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                  Pesca esportiva e futebol de sabão
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'futebol-sabao')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'futebol-sabao');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                              <AdditionalSelector
                                additionals={booking.additionals.filter(a => a.type === 'pesca')}
                                onUpdate={(idx, updates) => {
                                  const originalIndex = booking.additionals.findIndex(a => a.type === 'pesca');
                                  updateAdditional(originalIndex, updates);
                                }}
                              />
                            </div>

                            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <Button variant="ghost" onClick={() => setCampingTab('quads')} className="font-bold text-muted-foreground">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Quadriciclos
                              </Button>
                              <Button 
                                size="lg"
                                onClick={handleGoToSummary}
                                className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-black h-16 px-10 rounded-2xl shadow-lg"
                              >
                                Ver Resumo e Finalizar <ArrowRight className="ml-2 h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 4. RESUMO E PAGAMENTO */}
                {currentStep === 'resumo' && (
                  <motion.div
                    key="resumo"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    {/* Header Resumo com Identidade Visual Premium */}
                    <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white rounded-3xl p-4 sm:p-6 border-2 border-amber-400 shadow-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setCurrentStep('servicos')}
                          className="p-2.5 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-amber-400 hover:text-slate-950 transition-all shrink-0"
                          title="Voltar para Serviços"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl font-black shadow-sm">
                          <ClipboardList className="h-5 w-5 stroke-[2.5]" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-black tracking-widest text-emerald-300 block">Etapa Final</span>
                          <h3 className="font-gliker text-xl sm:text-2xl text-white">Resumo da Experiência</h3>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentStep('data')}
                        className="font-bold text-xs bg-white/10 text-white border-white/30 hover:bg-amber-400 hover:text-slate-950 hover:border-amber-400 rounded-xl transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1 text-amber-300" /> Mudar Data
                      </Button>
                    </div>

                    <div className="bg-white rounded-3xl p-4 sm:p-8 border-2 border-emerald-400/40 shadow-xl">
                      <BookingOverview 
                        booking={booking} 
                        totals={totals} 
                        updateEntry={updateEntry} 
                        orderId={orderId}
                        setOrderId={setOrderId}
                        confirmationCode={confirmationCode}
                        setConfirmationCode={setConfirmationCode}
                        onRemoveAdult={removeAdult}
                        onRemoveChild={removeChild}
                        onUpdateKiosk={updateKiosk}
                        onUpdateQuad={updateQuad}
                        onUpdateAdditional={updateAdditional}
                        onUpdateChale={updateChale}
                        onUpdateCamping={updateCamping}
                        onPrevStep={() => setCurrentStep('servicos')}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
          
          <p className="text-center mt-8 text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
             <CheckCircle2 className="h-3 w-3 text-primary" /> Agendamento Seguro & Processamento Garantido
          </p>
        </div>
      </div>

      {/* DIALOG DE CONFIRMAÇÃO PARA ALTERNAR DE MODALIDADE */}
      <Dialog open={isSwitchModalOpen} onOpenChange={setIsSwitchModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border border-slate-200 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-black text-emerald-950 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Trocar de Modalidade?
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Você está prestes a mudar para{' '}
              <strong className="text-emerald-950">
                {targetModalidade === 'dayuse' 
                  ? 'Day Use' 
                  : (targetModalidade === 'hospedagem' ? 'Hospedagem em Chalés' : 'Área de Camping')}
              </strong>
              . Para evitar conflitos, os itens selecionados da modalidade anterior serão removidos.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsSwitchModalOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (targetModalidade) {
                  executeModalidadeSwitch(targetModalidade);
                }
              }}
              className="rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider"
            >
              Sim, Trocar Modalidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
