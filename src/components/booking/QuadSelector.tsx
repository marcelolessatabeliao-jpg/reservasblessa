import { useState, useEffect, useMemo } from 'react';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime } from '@/lib/booking-types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getAllQuadAvailabilities, getGlobalSetting } from '@/lib/booking-service';
import { useToast } from '@/hooks/use-toast';
import { Bike, Clock, Tag, ChevronDown, Check, User, Users, Loader2, Calendar as CalendarIcon, AlertTriangle, Trash2, X, Minus, Plus } from 'lucide-react';
import { parseToRODate } from '@/utils/date-utils';

interface Props {
  quads: QuadItem[];
  selectedDate?: Date | string | null;
  onUpdate: (index: number, updates: Partial<QuadItem>) => void;
  onSetQuads?: (newQuads: QuadItem[]) => void;
  onAddQuad?: (item?: Partial<QuadItem>) => void;
  onRemoveQuad?: (index: number) => void;
}

// Capacidade configurável de quadriciclos por horário (padrão oficial: 3 quadriciclos)
const DEFAULT_QUADS_PER_SLOT = 3;

export function QuadSelector({ quads, selectedDate, onUpdate, onSetQuads }: Props) {
  const { getPrice, isLoading } = useServices();
  const { toast } = useToast();
  const [maxQuads, setMaxQuads] = useState<number>(DEFAULT_QUADS_PER_SLOT);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const [disableQuads, setDisableQuads] = useState(false);
  const [disabledQuadSlots, setDisabledQuadSlots] = useState<string[]>([]);
  
  // Horário atualmente selecionado/expandido para configuração
  const [expandedSlot, setExpandedSlot] = useState<QuadTime | null>(null);

  // Guarda persistentemente a data selecionada mesmo quando quads for esvaziado ou zerado
  const [lastKnownDate, setLastKnownDate] = useState<Date | null>(() => {
    if (selectedDate) return typeof selectedDate === 'string' ? parseToRODate(selectedDate) : selectedDate;
    return quads.find(q => q.date)?.date || null;
  });

  useEffect(() => {
    if (selectedDate) {
      const d = typeof selectedDate === 'string' ? parseToRODate(selectedDate) : selectedDate;
      if (d) setLastKnownDate(d);
    } else {
      const fromQuads = quads.find(q => q.date)?.date;
      if (fromQuads) setLastKnownDate(fromQuads);
    }
  }, [selectedDate, quads]);

  const checkDate = (selectedDate ? (typeof selectedDate === 'string' ? parseToRODate(selectedDate) : selectedDate) : null) || lastKnownDate || quads.find(q => q.date)?.date;

  useEffect(() => {
    async function fetchConfig() {
      const total = await getGlobalSetting('total_quads', DEFAULT_QUADS_PER_SLOT);
      const configuredTotal = Number(total);
      setMaxQuads(configuredTotal > 0 ? configuredTotal : DEFAULT_QUADS_PER_SLOT);
      const blockedQuads = await getGlobalSetting('disable_quads', false);
      setDisableQuads(Boolean(blockedQuads));
      const blockedSlots = await getGlobalSetting('disabled_quad_slots', []);
      setDisabledQuadSlots(Array.isArray(blockedSlots) ? blockedSlots : []);
    }
    fetchConfig();

    const handleSettingChange = (e: any) => {
      if (e?.detail?.key === 'total_quads') {
        const val = Number(e.detail.value);
        if (val > 0) setMaxQuads(val);
      }
    };
    window.addEventListener('global_setting_updated', handleSettingChange);
    return () => {
      window.removeEventListener('global_setting_updated', handleSettingChange);
    };
  }, []);

  useEffect(() => {
    async function fetchAvailability() {
      if (!checkDate) return;
      setIsFetchingAvailability(true);
      try {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const avail = await getAllQuadAvailabilities(dateStr);
        setSlotAvailabilities(avail);
      } catch (error) {
        console.error("Error fetching quad availability:", error);
      } finally {
        setIsFetchingAvailability(false);
      }
    }
    fetchAvailability();
  }, [checkDate]);

  // Se houver passeios ativos e nenhum expandido, expande o primeiro
  useEffect(() => {
    const firstActive = quads.find(q => q.quantity > 0 && q.time);
    if (firstActive?.time && !expandedSlot) {
      setExpandedSlot(firstActive.time as QuadTime);
    }
  }, [quads]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  // Uso do slot no banco de dados (excluindo reservas locais do próprio cliente)
  const getSlotDbUsage = (slotTime: string) => {
    return slotAvailabilities[slotTime] || 0;
  };

  // Atualizar quantidades para um horário específico (permite 1 Individual + 1 Dupla, 2 Individual, ou 2 Dupla)
  const handleUpdateSlotQuantities = (slotTime: QuadTime, newIndQty: number, newDupQty: number) => {
    if (!checkDate) {
      toast({ title: 'Selecione a data primeiro', variant: 'destructive' });
      return;
    }

    const dbUsed = getSlotDbUsage(slotTime);
    const indItem = quads.find(q => q.time === slotTime && q.type === 'individual' && q.quantity > 0);
    const dupItem = quads.find(q => q.time === slotTime && q.type === 'dupla' && q.quantity > 0);
    const currentSlotTotal = (indItem?.quantity || 0) + (dupItem?.quantity || 0);
    const maxAllowed = Math.max(0, maxQuads - dbUsed + currentSlotTotal);

    const safeInd = Math.max(0, newIndQty);
    const safeDup = Math.max(0, newDupQty);
    if (safeInd + safeDup > maxAllowed) {
      toast({
        title: 'Limite atingido',
        description: `O limite máximo é de ${maxAllowed} quadriciclo(s) para este horário.`,
        variant: 'destructive',
      });
      return;
    }

    // Filtra e reconstrói a lista de passeios
    const otherQuads = quads.filter(q => q.time !== slotTime && q.quantity > 0);
    const newSlotQuads: QuadItem[] = [];

    if (safeInd > 0) {
      newSlotQuads.push({
        type: 'individual',
        quantity: safeInd,
        time: slotTime,
        date: checkDate,
      });
    }

    if (safeDup > 0) {
      newSlotQuads.push({
        type: 'dupla',
        quantity: safeDup,
        time: slotTime,
        date: checkDate,
      });
    }

    const next = [...otherQuads, ...newSlotQuads];
    if (onSetQuads) {
      onSetQuads(next);
    } else {
      quads.forEach((_, idx) => onUpdate(idx, { quantity: 0 }));
      next.forEach((item, idx) => onUpdate(idx, item));
    }
  };

  const discount = getQuadDiscount(checkDate);
  const indBasePrice = getPrice('quad_individual', 130);
  const dupBasePrice = getPrice('quad_dupla', 195);
  const indGrossPrice = indBasePrice;
  const dupGrossPrice = dupBasePrice;
  const indFinalPrice = indBasePrice * (1 - discount);
  const dupFinalPrice = dupBasePrice * (1 - discount);

  const activeQuads = quads.filter(q => q.quantity > 0 && q.time);
  const totalQuadsCost = activeQuads.reduce((acc, q) => {
    const base = getPrice(`quad_${q.type}`, q.type === 'dupla' ? 195 : 130);
    return acc + (base * (1 - discount) * q.quantity);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-emerald-950 text-amber-400 border-2 border-amber-400 rounded-2xl shadow-sm shrink-0">
          <Bike className="h-5 w-5" />
        </div>
        <h3 className="font-gliker text-xl sm:text-2xl text-emerald-950">Passeio de Quadriciclo</h3>
      </div>

      {/* Banner de Retomada Oficial dos Quadriciclos */}
      <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 border-2 border-amber-400 p-4 sm:p-5 rounded-3xl mb-4 text-white shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black">
              <Bike className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-sans font-black text-sm sm:text-base text-amber-400 uppercase tracking-wide">
                🔥 INCRÍVEIS PASSEIOS DE QUADRICICLOS EM MEIO À NATUREZA
              </h4>
            </div>
          </div>
          <span className="self-start sm:self-auto bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-3 py-1 rounded-full shadow-sm">
            10% OFF Reserva Online
          </span>
        </div>

        <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
          Venha viver <strong>40 minutos de aventura e natureza</strong> no Balneário Lessa. Escolha seu horário e venha aproveitar a natureza de um jeito diferente!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-700/60 p-2.5 rounded-xl">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-white font-bold">
              Agendamentos das <strong>8h às 16h</strong> (última volta às 16h40)
            </span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-700/60 p-2.5 rounded-xl">
            <Tag className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-bold">
              Individual: <strong>R$ 117,00</strong> • De Dupla: <strong>R$ 175,50</strong> (10% OFF)
            </span>
          </div>
        </div>

        {/* AVISOS OFICIAIS DE FAIXA ETÁRIA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 p-2.5 rounded-xl text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold">
              Passeio válido apenas para crianças <strong>a partir de 7 anos</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 p-2.5 rounded-xl text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold">
              Para pilotar apenas <strong>a partir de 16 anos</strong>
            </span>
          </div>
        </div>
      </div>

      {/* SELETOR INTERATIVO POR HORÁRIO: CLIQUE NO HORÁRIO PARA EXPANDIR E CONFIGURAR */}
      {checkDate ? (
        <div className="bg-slate-50 border-2 border-emerald-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-800" />
              <span className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">
                Clique no horário desejado para escolher o passeio:
              </span>
              {isFetchingAvailability && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Data: {format(checkDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
            </span>
          </div>

          {(disableQuads || maxQuads === 0) ? (
            <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl text-center">
              <span className="text-sm font-black text-red-700 uppercase">
                Quadriciclos indisponíveis no momento
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Grid dos 9 Horários com Design de Cores Fortes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3 pt-1">
                {QUAD_TIMES.map(t => {
                  const dbUsed = getSlotDbUsage(t);
                  const isSlotDisabled = disabledQuadSlots.includes(t);
                  const slotInd = quads.find(q => q.time === t && q.type === 'individual' && q.quantity > 0);
                  const slotDup = quads.find(q => q.time === t && q.type === 'dupla' && q.quantity > 0);
                  const indQty = slotInd?.quantity || 0;
                  const dupQty = slotDup?.quantity || 0;
                  const totalSlotQty = indQty + dupQty;
                  const isSelectedByMe = totalSlotQty > 0;

                  // Trava dinâmica de quadriciclos por horário
                  const remaining = isSlotDisabled ? 0 : Math.max(0, maxQuads - dbUsed);
                  const isFull = isSlotDisabled || remaining <= 0;
                  const isExpanded = expandedSlot === t;
                  const isHighlighted = isSelectedByMe || isExpanded;

                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isFull && !isSelectedByMe}
                      onClick={() => {
                        setExpandedSlot(isExpanded ? null : t);
                      }}
                      className={cn(
                        "group relative flex flex-col items-start justify-between p-3 sm:p-3.5 rounded-2xl border-2 transition-all select-none text-left min-h-[96px] sm:min-h-[104px] shadow-md",
                        isFull && !isSelectedByMe
                          ? "opacity-55 bg-gradient-to-b from-[#241215] to-[#160a0c] border-red-900/70 text-red-200 cursor-not-allowed"
                          : isHighlighted
                            ? "bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-xl scale-[1.03] cursor-pointer ring-2 ring-amber-400/60"
                            : "bg-gradient-to-b from-[#063321] to-[#032014] text-white border-emerald-700/70 hover:border-amber-400 hover:shadow-xl hover:scale-[1.02] cursor-pointer"
                      )}
                    >
                      {/* Selo flutuante superior direito */}
                      <div className={cn(
                        "absolute -top-2.5 right-2 font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md border flex items-center gap-1 z-10",
                        isFull && !isSelectedByMe
                          ? "bg-red-600 text-white border-red-400"
                          : isHighlighted
                            ? "bg-slate-950 text-amber-300 border-slate-800"
                            : remaining === 1
                              ? "bg-amber-400 text-slate-950 border-amber-200"
                              : "bg-emerald-500 text-emerald-950 border-emerald-300"
                      )}>
                        {isSelectedByMe ? (
                          <>
                            <Check className="w-2.5 h-2.5 stroke-[3] text-amber-300" />
                            <span>RESERVADO</span>
                          </>
                        ) : isExpanded ? (
                          <>
                            <Clock className="w-2.5 h-2.5 text-amber-300" />
                            <span>ABERTO</span>
                          </>
                        ) : isFull ? (
                          <span>ESGOTADO</span>
                        ) : (
                          <>
                            <Clock className="w-2.5 h-2.5" />
                            <span>{remaining === 1 ? '1 VAGA' : 'LIVRE'}</span>
                          </>
                        )}
                      </div>

                      {/* Horário Principal */}
                      <div className="space-y-1 w-full">
                        <div className="flex items-center gap-1.5">
                          <Clock className={cn(
                            "w-4 h-4 shrink-0",
                            isFull && !isSelectedByMe ? "text-red-400" : isHighlighted ? "text-slate-950" : "text-amber-400"
                          )} />
                          <span className={cn(
                            "text-base sm:text-lg font-black tracking-tight font-sans",
                            isFull && !isSelectedByMe ? "text-red-300" : isHighlighted ? "text-slate-950" : "text-white group-hover:text-amber-300"
                          )}>
                            {t}
                          </span>
                        </div>

                        <span className={cn(
                          "text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md inline-block tracking-wider",
                          isFull && !isSelectedByMe
                            ? "bg-red-950/70 text-red-300 border border-red-800/50"
                            : isHighlighted
                              ? "bg-slate-950 text-amber-300"
                              : "bg-emerald-900/90 text-emerald-200 border border-emerald-700/60"
                        )}>
                          {isSelectedByMe ? (
                            indQty > 0 && dupQty > 0
                              ? `${indQty}x Ind. + ${dupQty}x Dup.`
                              : indQty > 0
                                ? `${indQty}x Individual`
                                : `${dupQty}x De Dupla`
                          ) : isSlotDisabled ? (
                            'Indisponível'
                          ) : isFull ? (
                            'Lotado'
                          ) : (
                            `${remaining} ${remaining === 1 ? 'Livre' : 'Livres'}`
                          )}
                        </span>
                      </div>

                      {/* Rodapé de Ação */}
                      <span className={cn(
                        "text-[10px] font-bold block pt-1.5",
                        isFull && !isSelectedByMe
                          ? "text-red-300/70"
                          : isHighlighted
                            ? "text-slate-950 font-black"
                            : "text-amber-300 group-hover:text-amber-200"
                      )}>
                        {isFull && !isSelectedByMe
                          ? 'Sem vagas neste horário'
                          : isSelectedByMe
                            ? '✓ Toque p/ alterar'
                            : isExpanded
                              ? '▼ Escolha abaixo'
                              : '+ Clique p/ reservar'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* PAINEL EXPANDIDO DE CONFIGURAÇÃO DO HORÁRIO SELECIONADO */}
              {expandedSlot && (() => {
                const slot = expandedSlot;
                const dbUsed = getSlotDbUsage(slot);
                const isSlotDisabled = disabledQuadSlots.includes(slot);
                const indItem = quads.find(q => q.time === slot && q.type === 'individual' && q.quantity > 0);
                const dupItem = quads.find(q => q.time === slot && q.type === 'dupla' && q.quantity > 0);
                const currentIndQty = indItem?.quantity || 0;
                const currentDupQty = dupItem?.quantity || 0;
                const currentSlotTotal = currentIndQty + currentDupQty;
                
                // Vagas disponíveis para este horário com base na capacidade mestre
                const availableForSlot = isSlotDisabled ? 0 : Math.max(0, maxQuads - dbUsed + currentSlotTotal);
                const slotGrossTotal = (currentIndQty * indGrossPrice) + (currentDupQty * dupGrossPrice);
                const slotFinalTotal = (currentIndQty * indFinalPrice) + (currentDupQty * dupFinalPrice);

                return (
                  <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white rounded-3xl p-4 sm:p-5 border-2 border-amber-400 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-emerald-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
                          <Clock className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-sans font-black text-sm sm:text-base text-white uppercase tracking-tight">
                            Configurar Passeio das {slot}
                          </h4>
                          <span className="text-[11px] text-amber-300 font-bold block">
                            {availableForSlot} quadriciclo{availableForSlot > 1 ? 's' : ''} disponível{availableForSlot > 1 ? 'is' : ''} (Limite: máximo {maxQuads} por horário)
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSlot(null)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SELEÇÃO INDEPENDENTE POR MODALIDADE (PERMITE 1 INDIVIDUAL + 1 DUPLA) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Modalidade 1: Passeio Individual */}
                      <div className={cn(
                        "p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3",
                        currentIndQty > 0
                          ? "bg-emerald-900/90 border-amber-400 shadow-md"
                          : "bg-white/10 border-white/20 hover:border-white/30"
                      )}>
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-black text-xs uppercase text-white">
                              <User className="w-3.5 h-3.5 text-amber-400" /> Passeio Individual
                            </div>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-amber-400 text-slate-950">
                              10% OFF
                            </span>
                          </div>
                          <span className="text-[10.5px] text-emerald-200/90 font-medium mt-0.5 block">1 pessoa · 40 minutos</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <div>
                            <span className="text-[10px] line-through font-bold text-emerald-300/80 block">
                              De {formatCurrency(indGrossPrice)}
                            </span>
                            <span className="text-sm sm:text-base font-black text-amber-300 block leading-tight">
                              {formatCurrency(indFinalPrice)}
                            </span>
                          </div>

                          {/* Stepper Passeio Individual */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={currentIndQty <= 0}
                              onClick={() => handleUpdateSlotQuantities(slot, currentIndQty - 1, currentDupQty)}
                              className="w-8 h-8 rounded-xl font-black bg-emerald-950 border-2 border-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                              title="Diminuir Individual"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <span className="w-6 text-center font-black text-sm text-amber-300">
                              {currentIndQty}
                            </span>
                            <button
                              type="button"
                              disabled={currentSlotTotal >= availableForSlot}
                              onClick={() => handleUpdateSlotQuantities(slot, currentIndQty + 1, currentDupQty)}
                              className="w-8 h-8 rounded-xl font-black bg-amber-400 border-2 border-amber-500 text-slate-950 hover:bg-amber-300 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                              title="Adicionar Individual"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Modalidade 2: Passeio de Dupla */}
                      <div className={cn(
                        "p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3",
                        currentDupQty > 0
                          ? "bg-emerald-900/90 border-amber-400 shadow-md"
                          : "bg-white/10 border-white/20 hover:border-white/30"
                      )}>
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-black text-xs uppercase text-white">
                              <Users className="w-3.5 h-3.5 text-amber-400" /> Passeio de Dupla
                            </div>
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-amber-400 text-slate-950">
                              10% OFF
                            </span>
                          </div>
                          <span className="text-[10.5px] text-emerald-200/90 font-medium mt-0.5 block">2 pessoas · 40 minutos</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <div>
                            <span className="text-[10px] line-through font-bold text-emerald-300/80 block">
                              De {formatCurrency(dupGrossPrice)}
                            </span>
                            <span className="text-sm sm:text-base font-black text-amber-300 block leading-tight">
                              {formatCurrency(dupFinalPrice)}
                            </span>
                          </div>

                          {/* Stepper Passeio de Dupla */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={currentDupQty <= 0}
                              onClick={() => handleUpdateSlotQuantities(slot, currentIndQty, currentDupQty - 1)}
                              className="w-8 h-8 rounded-xl font-black bg-emerald-950 border-2 border-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                              title="Diminuir de Dupla"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <span className="w-6 text-center font-black text-sm text-amber-300">
                              {currentDupQty}
                            </span>
                            <button
                              type="button"
                              disabled={currentSlotTotal >= availableForSlot}
                              onClick={() => handleUpdateSlotQuantities(slot, currentIndQty, currentDupQty + 1)}
                              className="w-8 h-8 rounded-xl font-black bg-amber-400 border-2 border-amber-500 text-slate-950 hover:bg-amber-300 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                              title="Adicionar de Dupla"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subtotal do Horário */}
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider block text-center sm:text-left">
                          Total deste horário ({slot}):
                        </span>
                        {currentSlotTotal > 0 ? (
                          <div className="flex items-center gap-2 mt-0.5 justify-center sm:justify-start">
                            <span className="text-xs text-emerald-300/80 line-through font-bold">
                              De {formatCurrency(slotGrossTotal)}
                            </span>
                            <span className="text-base sm:text-lg font-black text-amber-300">
                              {formatCurrency(slotFinalTotal)}
                            </span>
                            <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">
                              10% OFF aplicado
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 italic block mt-0.5 text-center sm:text-left">
                            Selecione até {availableForSlot} quadriciclo{availableForSlot > 1 ? 's' : ''} (individual ou dupla)
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-black text-amber-300 bg-emerald-950/90 px-3 py-1 rounded-xl border border-emerald-700/60 shadow-xs">
                        {currentSlotTotal} de {availableForSlot} quadriciclo{availableForSlot > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-800/80">
                      {currentSlotTotal > 0 ? (
                        <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
                          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                          <span>
                            Agendado às <strong>{slot}</strong>:{' '}
                            {[
                              currentIndQty > 0 ? `${currentIndQty}x Individual` : null,
                              currentDupQty > 0 ? `${currentDupQty}x De Dupla` : null,
                            ].filter(Boolean).join(' + ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Clique no botão [+] da opção desejada acima para agendar às {slot}.
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {currentSlotTotal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateSlotQuantities(slot, 0, 0)}
                            className="px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/50 hover:bg-red-900 text-red-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover deste horário
                          </button>
                        )}
                        <Button
                          type="button"
                          onClick={() => setExpandedSlot(null)}
                          className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase cursor-pointer"
                        >
                          Concluir Horário
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* RESUMO DOS QUADRICICLOS AGENDADOS */}
          <div className="pt-3 border-t border-slate-200">
            {activeQuads.length > 0 ? (
              <div className="bg-emerald-50/80 border-2 border-emerald-300 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-emerald-700" />
                    Passeios de Quadriciclo Agendados ({activeQuads.length} item{activeQuads.length > 1 ? 'ns' : ''}):
                  </span>
                  <span className="text-sm font-black text-emerald-900 font-sans">
                    Total: {formatCurrency(totalQuadsCost)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeQuads.map(q => (
                    <div 
                      key={`summary-${q.time}-${q.type}`} 
                      className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 text-xs shadow-2xs"
                    >
                      <span className="font-black text-emerald-950">⏰ {q.time}</span>
                      <span className="text-slate-700 font-bold">
                        {q.quantity}x {q.type === 'dupla' ? 'Passeio de Dupla' : 'Passeio Individual'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const slotTime = q.time as QuadTime;
                          const indQ = q.type === 'individual' ? 0 : (quads.find(x => x.time === slotTime && x.type === 'individual')?.quantity || 0);
                          const dupQ = q.type === 'dupla' ? 0 : (quads.find(x => x.time === slotTime && x.type === 'dupla')?.quantity || 0);
                          handleUpdateSlotQuantities(slotTime, indQ, dupQ);
                        }}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded-full cursor-pointer"
                        title="Remover"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-500 font-medium italic">
                Nenhum quadriciclo agendado. Clique em qualquer um dos horários acima para adicionar.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Aviso quando data não selecionada */
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-amber-400/30 text-amber-900 flex items-center justify-center mx-auto font-black">
            <Clock className="w-5 h-5 text-amber-800" />
          </div>
          <h4 className="font-sans font-black text-slate-900 text-base">Selecione a data da visita primeiro</h4>
          <p className="text-xs font-bold text-slate-600 max-w-md mx-auto">
            Por favor, escolha a data da sua visita no topo da página para visualizar a disponibilidade em tempo real dos quadriciclos.
          </p>
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs sm:text-sm space-y-1">
          <p className="font-black text-primary flex items-center gap-1">🏷️ Descontos:</p>
          <p className="text-muted-foreground">• Todas as reservas online com <strong>10% de desconto</strong> já calculados.</p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 text-[10px] sm:text-xs flex flex-col justify-center">
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-destructive">⚠️ Obs:</strong> As entradas continuam sendo à parte.<br />
            Os valores são referentes exclusivamente às reservas dos quadriciclos.
          </p>
        </div>
      </div>
    </div>
  );
}
