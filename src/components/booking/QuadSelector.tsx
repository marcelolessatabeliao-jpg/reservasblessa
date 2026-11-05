import React, { useState, useEffect } from 'react';
import { Bike, Tag, CalendarIcon, Loader2, Users, User, Baby, Clock, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime, isOperatingDay } from '@/lib/booking-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getQuadAvailability, getGlobalSetting } from '@/lib/booking-service';
import { useToast } from '@/hooks/use-toast';

interface Props {
  quads: QuadItem[];
  onUpdate: (index: number, updates: Partial<QuadItem>) => void;
}

const QUAD_CARDS = [
  {
    type: 'individual' as const,
    icon: User,
    title: 'Passeio Individual',
    subtitle: '1 pessoa • 40 min de aventura e emoção',
    fallbackPrice: 130,
    color: 'emerald',
  },
  {
    type: 'dupla' as const,
    icon: Users,
    title: 'Passeio para Casal',
    subtitle: '2 pessoas • 40 min de aventura e natureza',
    fallbackPrice: 195,
    color: 'blue',
  },
];

const DEFAULT_MAX_QUADS = 2;

export function QuadSelector({ quads, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const { toast } = useToast();
  const [maxQuads, setMaxQuads] = useState<number>(DEFAULT_MAX_QUADS);
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const [disableQuads, setDisableQuads] = useState(false);
  const [disabledQuadSlots, setDisabledQuadSlots] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const checkDate = quads[0]?.date || quads.find(q => q.date)?.date;

  useEffect(() => {
    async function fetchConfig() {
      const total = await getGlobalSetting('total_quads', DEFAULT_MAX_QUADS);
      setMaxQuads(Math.min(DEFAULT_MAX_QUADS, Number(total) || DEFAULT_MAX_QUADS));
      const blockedQuads = await getGlobalSetting('disable_quads', false);
      const blockedSlots = await getGlobalSetting('disabled_quad_slots', []);
      setDisableQuads(!!blockedQuads);
      if (Array.isArray(blockedSlots)) setDisabledQuadSlots(blockedSlots);
    }
    fetchConfig();
  }, []);

  useEffect(() => {
    async function fetchAvailability() {
      if (!checkDate) return;
      setIsFetchingAvailability(true);
      try {
        const avail: Record<string, number> = {};
        for (const t of QUAD_TIMES) {
          avail[t] = await getQuadAvailability(format(checkDate, 'yyyy-MM-dd'), t);
        }
        setSlotAvailabilities(avail);
      } catch (error) {
        console.error("Error fetching quad availability:", error);
      } finally {
        setIsFetchingAvailability(false);
      }
    }
    fetchAvailability();
  }, [checkDate]);

  // Auto-expand card that has quantity > 0
  useEffect(() => {
    const activeQuad = quads.find(q => q.quantity > 0);
    if (activeQuad && !expandedCard) {
      setExpandedCard(activeQuad.type);
    }
  }, [quads]);

  useEffect(() => {
    if (disableQuads || maxQuads === 0) {
      quads.forEach((q, idx) => {
        if (q.quantity > 0) {
          onUpdate(idx, { quantity: 0, time: undefined });
        }
      });
    } else {
      quads.forEach((q, idx) => {
        if (q.quantity > 0 && q.time && disabledQuadSlots.includes(q.time)) {
          onUpdate(idx, { quantity: 0, time: undefined });
        }
      });
    }
  }, [disableQuads, maxQuads, disabledQuadSlots, quads, onUpdate]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  // Calculate total used per slot across all quad types
  const getSlotUsage = (slotTime: string, excludeIndex?: number) => {
    const dbUsed = slotAvailabilities[slotTime] || 0;
    const localUsed = quads.reduce((acc, q, idx) => {
      if (excludeIndex !== undefined && idx === excludeIndex) return acc;
      if (q.time === slotTime) return acc + q.quantity;
      return acc;
    }, 0);
    return dbUsed + localUsed;
  };

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
              <h4 className="font-sans font-black text-base sm:text-xl text-white">
                OS PASSEIOS DE QUADRICICLO ESTÃO DE VOLTA!
              </h4>
            </div>
          </div>
          <span className="self-start sm:self-auto bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md">
            💳 Aceitamos Cartão de Crédito
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
              Individual: <strong>R$ 130,00</strong> • Casal: <strong>R$ 195,00</strong>
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

      {/* Slot availability overview */}
      {checkDate && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[10px] sm:text-xs font-black text-slate-600 uppercase tracking-widest">
              Disponibilidade por Horário — {format(checkDate, "dd/MM", { locale: ptBR })}
            </span>
            {isFetchingAvailability && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
          </div>
          {(disableQuads || maxQuads === 0) ? (
            <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl text-center">
              <span className="text-sm font-black text-red-700 uppercase">
                Quadriciclos indisponíveis no momento
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUAD_TIMES.map(t => {
                const totalUsed = getSlotUsage(t);
                const isSlotDisabled = disabledQuadSlots.includes(t);
                const remaining = isSlotDisabled ? 0 : Math.max(0, maxQuads - totalUsed);
                const pct = isSlotDisabled ? 100 : (totalUsed / maxQuads) * 100;
                const isFull = isSlotDisabled || remaining <= 0;

                return (
                  <div key={t} className={cn(
                    "flex flex-col items-center p-2 rounded-xl border transition-all",
                    isFull 
                      ? "bg-red-50 border-red-200" 
                      : remaining <= 2 
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                  )}>
                    <span className={cn(
                      "text-sm sm:text-base font-black",
                      isFull ? "text-red-500" : remaining <= 2 ? "text-amber-600" : "text-emerald-700"
                    )}>
                      {t}
                    </span>
                    {/* Progress bar */}
                    {!isSlotDisabled && (
                      <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isFull ? "bg-red-400" : remaining <= 2 ? "bg-amber-400" : "bg-emerald-400"
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                    <span className={cn(
                      "text-[9px] sm:text-[10px] font-bold mt-1 text-center leading-none",
                      isFull ? "text-red-500" : remaining <= 2 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {isSlotDisabled ? 'Indisponível no momento' : isFull ? 'LOTADO' : `${totalUsed}/${maxQuads} ocupadas`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modality Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUAD_CARDS.map((card, cardIndex) => {
          const quad = quads.find(q => q.type === card.type) || quads[cardIndex];
          const actualIndex = quads.findIndex(q => q.type === card.type);
          const basePrice = getPrice(`quad_${card.type}`, card.fallbackPrice);
          const discount = getQuadDiscount(quad.date);
          const finalPrice = basePrice * (1 - discount);
          const isExpanded = expandedCard === card.type;
          const isActive = quad.quantity > 0;
          const IconComp = card.icon;

          // Color mapping
          const colorMap: Record<string, { bg: string; border: string; activeBg: string; activeBorder: string; text: string; iconBg: string }> = {
            emerald: { 
              bg: 'bg-emerald-50/60', border: 'border-emerald-300/50', 
              activeBg: 'bg-emerald-600', activeBorder: 'border-emerald-700',
              text: 'text-emerald-700', iconBg: 'bg-emerald-100'
            },
            blue: { 
              bg: 'bg-blue-50/60', border: 'border-blue-300/50', 
              activeBg: 'bg-blue-600', activeBorder: 'border-blue-700',
              text: 'text-blue-700', iconBg: 'bg-blue-100'
            },
            amber: { 
              bg: 'bg-amber-50/60', border: 'border-amber-300/50', 
              activeBg: 'bg-amber-600', activeBorder: 'border-amber-700',
              text: 'text-amber-700', iconBg: 'bg-amber-100'
            },
          };
          const colors = colorMap[card.color];

          return (
            <div 
              key={card.type}
              className={cn(
                "relative flex flex-col rounded-2xl border-2 transition-all duration-300 overflow-hidden cursor-pointer",
                (disableQuads || maxQuads === 0) && "opacity-50 cursor-not-allowed pointer-events-none",
                isActive 
                  ? `${colors.activeBg} ${colors.activeBorder} text-white shadow-lg` 
                  : isExpanded
                    ? `${colors.bg} ${colors.border} shadow-md ring-2 ring-${card.color}-400/30`
                    : `bg-white/90 border-slate-200/80 hover:border-slate-300 hover:shadow-md`,
              )}
            >
              {/* Card Header - Clickable */}
              <button
                onClick={() => {
                  if (!checkDate) {
                    toast({ title: 'Selecione a data primeiro', description: 'Escolha a data de visita antes de selecionar os quadriciclos.', variant: 'destructive' });
                    return;
                  }
                  if (disableQuads || maxQuads === 0) {
                    toast({ title: 'Quadriciclos Indisponíveis', description: 'O serviço de quadriciclos está indisponível no momento.', variant: 'destructive' });
                    return;
                  }
                  setExpandedCard(isExpanded ? null : card.type);
                }}
                className="w-full p-3 sm:p-4 text-left"
              >
                {/* Active badge */}
                {isActive && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                  </div>
                )}

                {/* Icon & Title */}
                <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                    isActive ? "bg-white/20" : colors.iconBg
                  )}>
                    <IconComp className={cn(
                      "h-4 w-4",
                      isActive ? "text-white" : colors.text
                    )} />
                  </div>
                  <h4 className={cn(
                    "font-black text-[11px] sm:text-xs uppercase tracking-tight truncate",
                    isActive ? "text-white" : "text-slate-800"
                  )}>
                    {card.title}
                  </h4>
                </div>

                {/* Subtitle */}
                <p className={cn(
                  "text-[10px] sm:text-xs font-medium mt-0.5",
                  isActive ? "text-white/80" : "text-slate-500"
                )}>
                  {card.subtitle}
                </p>

                {/* Price */}
                <div className="flex items-center gap-2 mt-3">
                  {discount > 0 && (
                    <span className={cn(
                      "line-through text-xs font-bold",
                      isActive ? "text-white/50" : "text-slate-400"
                    )}>
                      {formatCurrency(basePrice)}
                    </span>
                  )}
                  <span className={cn(
                    "font-black text-lg sm:text-xl",
                    isActive ? "text-white" : colors.text
                  )}>
                    {formatCurrency(finalPrice)}
                  </span>
                  {discount > 0 && (
                    <span className="bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      -{discount * 100}%
                    </span>
                  )}
                </div>

                {/* Expand indicator */}
                <div className="flex items-center justify-center mt-3">
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-300",
                    isExpanded && "rotate-180",
                    isActive ? "text-white/60" : "text-slate-400"
                  )} />
                </div>
              </button>

              {/* Expanded: Time + Quantity Selection */}
              {isExpanded && (
                <div className={cn(
                  "px-4 pb-4 sm:px-5 sm:pb-5 space-y-3 border-t",
                  isActive ? "border-white/20" : "border-slate-200"
                )}>
                  {/* Time Slot Selection */}
                  <div className="space-y-1.5 pt-3">
                    <label className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      isActive ? "text-white/60" : "text-slate-500"
                    )}>
                      1. Escolha o Horário
                    </label>
                    <Select 
                      value={quad.time || ''} 
                      onValueChange={async (v) => {
                        if (!quad.date) {
                          toast({ title: 'Escolha uma data primeiro', variant: 'destructive' });
                          return;
                        }
                        const visitDate = format(quad.date, 'yyyy-MM-dd');
                        const used = await getQuadAvailability(visitDate, v);
                        const localUsedOthers = quads.reduce((acc, qry, idx) => {
                          if (idx !== cardIndex && qry.time === v) return acc + qry.quantity;
                          return acc;
                        }, 0);
                        const remaining = maxQuads - (used + localUsedOthers);
                        
                        if (remaining <= 0) {
                          toast({ title: 'Horário Lotado', description: `Não há vagas disponíveis para as ${v}.`, variant: 'destructive' });
                          return;
                        }
                        
                        const newQty = Math.max(1, Math.min(quad.quantity || 1, remaining));
                        onUpdate(actualIndex >= 0 ? actualIndex : cardIndex, { time: v as QuadTime, quantity: newQty });
                      }}
                      disabled={!quad.date || isFetchingAvailability}
                    >
                      <SelectTrigger className={cn(
                        "w-full h-12 rounded-2xl font-bold text-sm uppercase tracking-tight",
                        isActive 
                          ? "bg-white/20 border-white/30 text-white placeholder:text-white/60" 
                          : "bg-white border-slate-200 shadow-sm",
                        !quad.time && !isActive && "border-primary/30 ring-2 ring-primary/10 animate-pulse"
                      )}>
                        <SelectValue placeholder="SELECIONAR HORÁRIO" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {QUAD_TIMES.map(t => {
                          const totalUsed = getSlotUsage(t, cardIndex);
                          const isSlotDisabled = disabledQuadSlots.includes(t);
                          const remaining = isSlotDisabled ? 0 : Math.max(0, maxQuads - totalUsed);
                          const isFull = isSlotDisabled || remaining <= 0;
                          return (
                            <SelectItem 
                              key={t} 
                              value={t} 
                              className={cn("font-bold py-3", isFull ? "text-destructive" : "text-foreground")}
                              disabled={isFull && quad.time !== t}
                            >
                              {t} {isSlotDisabled ? ' (Indisponível)' : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity Selection */}
                  <div className={cn(
                    "flex flex-col p-3 rounded-2xl border transition-all",
                    quad.time
                      ? isActive ? "bg-white/10 border-white/20" : "bg-emerald-50/60 border-emerald-300/40"
                      : "bg-slate-50 border-slate-200 opacity-50 pointer-events-none"
                  )}>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest mb-2",
                      isActive ? "text-white/60" : "text-slate-500"
                    )}>
                      2. Quantidade
                    </span>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-row items-center gap-1.5 flex-nowrap min-w-0">
                          {quad.quantity > 0 ? (
                            <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden flex-nowrap shrink-0">
                              <span className={cn("text-[8px] sm:text-[10px] font-bold leading-none opacity-80", isActive ? "text-white" : "text-slate-600")}>
                                {quad.quantity}x =
                              </span>
                              <span className={cn("text-xs sm:text-base font-black leading-none", isActive ? "text-white" : "text-slate-800")}>
                                {formatCurrency(finalPrice * quad.quantity)}
                              </span>
                            </div>
                          ) : (
                            <span className={cn("font-black text-xs", isActive ? "text-white" : "text-slate-700")}>
                              SELECIONE
                            </span>
                          )}
                        </div>
                      <QuantityStepper 
                        size="sm"
                        theme={isActive ? 'dark' : 'default'}
                        value={quad.quantity} 
                        max={(() => {
                          if (!quad.time || !checkDate) return 0;
                          const totalUsed = getSlotUsage(quad.time, cardIndex);
                          return Math.max(0, maxQuads - totalUsed);
                        })()}
                        onChange={(q) => onUpdate(actualIndex >= 0 ? actualIndex : cardIndex, { quantity: q })} 
                      />
                    </div>
                  </div>

                  {/* Booking confirmation badge */}
                  {quad.quantity > 0 && quad.time && (
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider",
                      isActive ? "bg-white/20 text-white" : "bg-emerald-900 text-white"
                    )}>
                      <CalendarIcon className="h-3 w-3" />
                      Agendado — {format(quad.date!, "dd/MM/yyyy")} às {quad.time}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs sm:text-sm space-y-1">
          <p className="font-medium text-primary">🏷️ Descontos:</p>
          <p className="text-muted-foreground">• Todas as reservas online com <strong>10% de desconto</strong></p>

        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-[10px] sm:text-xs flex flex-col justify-center">
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-destructive">⚠️ Obs:</strong> As entradas continuam sendo a parte.<br />
            Os valores são referente apenas às reservas dos quadriciclos.
          </p>
        </div>
      </div>
    </div>
  );
}
