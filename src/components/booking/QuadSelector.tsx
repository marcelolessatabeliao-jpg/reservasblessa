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

interface Props {
  quads: QuadItem[];
  onUpdate: (index: number, updates: Partial<QuadItem>) => void;
  onSetQuads?: (newQuads: QuadItem[]) => void;
  onAddQuad?: (item?: Partial<QuadItem>) => void;
  onRemoveQuad?: (index: number) => void;
}

const DEFAULT_MAX_QUADS = 2;

export function QuadSelector({ quads, onUpdate, onSetQuads }: Props) {
  const { getPrice, isLoading } = useServices();
  const { toast } = useToast();
  const [maxQuads, setMaxQuads] = useState<number>(DEFAULT_MAX_QUADS);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const [disableQuads, setDisableQuads] = useState(false);
  const [disabledQuadSlots, setDisabledQuadSlots] = useState<string[]>([]);
  
  // Horário atualmente selecionado/expandido para configuração
  const [expandedSlot, setExpandedSlot] = useState<QuadTime | null>(null);

  const checkDate = quads[0]?.date || quads.find(q => q.date)?.date;

  useEffect(() => {
    async function fetchConfig() {
      const total = await getGlobalSetting('total_quads', DEFAULT_MAX_QUADS);
      setMaxQuads(Math.min(DEFAULT_MAX_QUADS, Number(total) || DEFAULT_MAX_QUADS));
      const blockedQuads = await getGlobalSetting('disable_quads', false);
      setDisableQuads(Boolean(blockedQuads));
      const blockedSlots = await getGlobalSetting('disabled_quad_slots', []);
      setDisabledQuadSlots(Array.isArray(blockedSlots) ? blockedSlots : []);
    }
    fetchConfig();
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

  // Encontra a reserva ativa do cliente para um determinado horário
  const getBookingForSlot = (slotTime: string) => {
    return quads.find(q => q.time === slotTime && q.quantity > 0);
  };

  // Salvar ou atualizar passeio para um horário específico
  const handleSaveSlot = (slotTime: QuadTime, type: 'individual' | 'dupla', quantity: number) => {
    if (!checkDate) {
      toast({ title: 'Selecione a data primeiro', variant: 'destructive' });
      return;
    }

    if (quantity <= 0) {
      // Remove o horário
      const nextQuads = quads.filter(q => q.time !== slotTime);
      if (onSetQuads) {
        onSetQuads(nextQuads);
      } else {
        const idx = quads.findIndex(q => q.time === slotTime);
        if (idx >= 0) onUpdate(idx, { quantity: 0, time: undefined });
      }
      return;
    }

    // Atualiza ou insere o horário
    const existingIdx = quads.findIndex(q => q.time === slotTime);
    if (existingIdx >= 0) {
      if (onSetQuads) {
        const next = quads.map((q, i) => i === existingIdx ? { ...q, type, quantity, date: checkDate, time: slotTime } : q);
        onSetQuads(next);
      } else {
        onUpdate(existingIdx, { type, quantity, time: slotTime, date: checkDate });
      }
    } else {
      const newQuad: QuadItem = { type, quantity, time: slotTime, date: checkDate };
      if (onSetQuads) {
        onSetQuads([...quads.filter(q => q.quantity > 0), newQuad]);
      } else {
        // Tenta achar um slot livre ou adiciona
        const emptyIdx = quads.findIndex(q => q.quantity === 0);
        if (emptyIdx >= 0) {
          onUpdate(emptyIdx, newQuad);
        } else {
          onUpdate(quads.length, newQuad);
        }
      }
    }
  };

  const discount = getQuadDiscount(checkDate);
  const indBasePrice = getPrice('quad_individual', 130);
  const dupBasePrice = getPrice('quad_dupla', 195);
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
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <Bike className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <h3 className="font-sans font-bold text-lg sm:text-xl">3. Passeio de Quadriciclo</h3>
      </div>

      {/* Banner de Retomada Oficial dos Quadriciclos */}
      <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 border-2 border-amber-400 p-4 sm:p-5 rounded-3xl mb-4 text-white shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black">
              <Bike className="w-5 h-5" />
            </span>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                🔥 RETOMADA OFICIAL DOS PASSEIOS
              </span>
              <h4 className="font-sans font-black text-sm sm:text-base text-white">
                Trilha Ecológica Balneário Lessa
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
      {checkDate && (
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
              {/* Grid dos 9 Horários */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {QUAD_TIMES.map(t => {
                  const dbUsed = getSlotDbUsage(t);
                  const isSlotDisabled = disabledQuadSlots.includes(t);
                  const bookingThisSlot = getBookingForSlot(t);
                  const isSelectedByMe = Boolean(bookingThisSlot && bookingThisSlot.quantity > 0);
                  const remaining = isSlotDisabled ? 0 : Math.max(0, maxQuads - dbUsed);
                  const isFull = isSlotDisabled || remaining <= 0;
                  const isExpanded = expandedSlot === t;

                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={isFull && !isSelectedByMe}
                      onClick={() => {
                        setExpandedSlot(isExpanded ? null : t);
                      }}
                      className={cn(
                        "relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all cursor-pointer select-none text-center shadow-xs",
                        isExpanded
                          ? "ring-2 ring-amber-400 scale-[1.02] border-amber-500 bg-[#042817] text-white shadow-md"
                          : isSelectedByMe
                            ? "bg-[#063f25] border-emerald-500 text-white shadow-sm"
                            : isFull
                              ? "bg-red-50 border-red-200 text-red-400 opacity-60 cursor-not-allowed"
                              : remaining === 1
                                ? "bg-amber-50/80 border-amber-300 hover:border-amber-400 text-slate-900"
                                : "bg-white border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-900"
                      )}
                    >
                      {/* Check se está reservado por mim */}
                      {isSelectedByMe && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      <span className={cn(
                        "text-sm sm:text-base font-black tracking-tight",
                        isExpanded ? "text-amber-300" : isSelectedByMe ? "text-white" : "text-slate-900"
                      )}>
                        {t}
                      </span>

                      <span className={cn(
                        "text-[10px] font-bold mt-0.5",
                        isExpanded 
                          ? "text-emerald-200"
                          : isSelectedByMe
                            ? "text-amber-300 font-black"
                            : isFull
                              ? "text-red-500 font-bold"
                              : remaining === 1
                                ? "text-amber-700 font-bold"
                                : "text-emerald-700 font-black"
                      )}>
                        {isSelectedByMe 
                          ? `${bookingThisSlot!.quantity}x ${bookingThisSlot!.type === 'dupla' ? 'Dupla' : 'Indiv.'}`
                          : isSlotDisabled
                            ? 'Indisponível'
                            : isFull
                              ? 'LOTADO'
                              : `${remaining} Livre${remaining > 1 ? 's' : ''}`}
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
                const currentBooking = getBookingForSlot(slot);
                const currentType = currentBooking?.type || 'individual';
                const currentQty = currentBooking?.quantity || 0;
                
                // Vagas disponíveis para este horário (considerando a quantidade já alocada para este usuário)
                const availableForSlot = isSlotDisabled ? 0 : Math.max(0, maxQuads - dbUsed + currentQty);
                const priceEach = currentType === 'dupla' ? dupFinalPrice : indFinalPrice;

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
                            {availableForSlot} vaga{availableForSlot > 1 ? 's' : ''} disponível{availableForSlot > 1 ? 'is' : ''} neste horário
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedSlot(null)}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* 1. Escolha a Modalidade */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
                          1. Escolha a Modalidade:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveSlot(slot, 'individual', Math.max(1, currentQty || 1))}
                            className={cn(
                              "p-3 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between",
                              currentType === 'individual' && currentQty > 0
                                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black"
                                : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            )}
                          >
                            <div className="flex items-center gap-1.5 font-black text-xs uppercase">
                              <User className="w-3.5 h-3.5" /> Individual
                            </div>
                            <span className="text-[10px] opacity-80 mt-1 block">1 pessoa · 40 min</span>
                            <span className="text-xs sm:text-sm font-black mt-2 block">
                              {formatCurrency(indFinalPrice)}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveSlot(slot, 'dupla', Math.max(1, currentQty || 1))}
                            className={cn(
                              "p-3 rounded-2xl border-2 transition-all cursor-pointer text-left flex flex-col justify-between",
                              currentType === 'dupla' && currentQty > 0
                                ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black"
                                : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            )}
                          >
                            <div className="flex items-center gap-1.5 font-black text-xs uppercase">
                              <Users className="w-3.5 h-3.5" /> De Dupla
                            </div>
                            <span className="text-[10px] opacity-80 mt-1 block">2 pessoas · 40 min</span>
                            <span className="text-xs sm:text-sm font-black mt-2 block">
                              {formatCurrency(dupFinalPrice)}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Quantidade de Quadriciclos */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
                          2. Quantidade de Quadriciclos:
                        </label>
                        <div className="bg-white/10 border border-white/20 rounded-2xl p-3 flex items-center justify-between gap-3 h-[90px]">
                          <div>
                            <span className="text-xs font-bold text-emerald-100 block">
                              Total deste horário:
                            </span>
                            <span className="text-base sm:text-lg font-black text-amber-300 block">
                              {currentQty > 0 ? formatCurrency(priceEach * currentQty) : 'Selecione a quantidade'}
                            </span>
                            {currentQty > 0 && (
                              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">
                                10% OFF aplicado
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={currentQty <= 0}
                              onClick={() => handleSaveSlot(slot, currentType, Math.max(0, currentQty - 1))}
                              className="w-8 h-8 rounded-xl font-black bg-emerald-950 border-2 border-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <span className="w-7 text-center font-black text-sm text-amber-300">
                              {currentQty}
                            </span>
                            <button
                              type="button"
                              disabled={currentQty >= availableForSlot}
                              onClick={() => handleSaveSlot(slot, currentType, Math.min(availableForSlot, currentQty + 1))}
                              className="w-8 h-8 rounded-xl font-black bg-amber-400 border-2 border-amber-500 text-slate-950 hover:bg-amber-300 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-800/80">
                      {currentQty > 0 ? (
                        <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
                          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                          Agendado: <strong>{currentQty}x {currentType === 'dupla' ? 'Passeio de Dupla' : 'Passeio Individual'}</strong> às {slot}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Escolha a modalidade e clique em [+] para agendar às {slot}.
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        {currentQty > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSaveSlot(slot, currentType, 0)}
                            className="px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/50 hover:bg-red-900 text-red-200 text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover deste horário
                          </button>
                        )}
                        <Button
                          type="button"
                          onClick={() => setExpandedSlot(null)}
                          className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase"
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
                    Passeios de Quadriciclo Agendados ({activeQuads.length} horário{activeQuads.length > 1 ? 's' : ''}):
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
                      <span className="text-slate-600 font-bold">
                        {q.quantity}x {q.type === 'dupla' ? 'De Dupla' : 'Individual'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSaveSlot(q.time as QuadTime, q.type, 0)}
                        className="text-slate-400 hover:text-red-500 p-0.5 rounded-full"
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
