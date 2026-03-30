import React, { useState, useEffect } from 'react';
import { Bike, Tag, CalendarIcon, Loader2, Users, User, Baby, Clock, ChevronDown, Check } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime, isOperatingDay } from '@/lib/booking-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getQuadAvailability } from '@/lib/booking-service';
import { useToast } from '@/hooks/use-toast';

interface Props {
  quads: QuadItem[];
  onUpdate: (index: number, updates: Partial<QuadItem>) => void;
}

const QUAD_CARDS = [
  {
    type: 'individual' as const,
    icon: User,
    title: 'Individual',
    subtitle: '1 pessoa por quadriciclo',
    fallbackPrice: 150,
    color: 'emerald',
  },
  {
    type: 'dupla' as const,
    icon: Users,
    title: 'Dupla',
    subtitle: '2 pessoas no quadriciclo',
    fallbackPrice: 250,
    color: 'blue',
  },
  {
    type: 'adulto-crianca' as const,
    icon: Baby,
    title: 'Adulto + Criança',
    subtitle: 'Válido para crianças até 11 anos',
    fallbackPrice: 200,
    color: 'amber',
  },
];

const MAX_QUADS_PER_SLOT = 5;

export function QuadSelector({ quads, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const { toast } = useToast();
  const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const checkDate = quads[0]?.date;

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

      {/* Duration info */}
      <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl mb-4 flex flex-col sm:flex-row gap-3 sm:items-center shadow-sm">
        <div className="bg-white border border-emerald-100 p-2.5 rounded-xl shrink-0 shadow-sm flex items-center justify-center">
          <Clock className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h4 className="font-black text-emerald-800 text-sm uppercase tracking-wider mb-0.5">
            Duração: 1h30 de Aventura Exclusiva
          </h4>
          <p className="text-xs sm:text-sm text-emerald-700/80 font-medium leading-relaxed">
            Desafios com pedras, lama, rio, barrancos, floresta, piscina natural, poças de água, batistério e uma incrível tirolesa!
          </p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUAD_TIMES.map(t => {
              const totalUsed = getSlotUsage(t);
              const remaining = Math.max(0, MAX_QUADS_PER_SLOT - totalUsed);
              const pct = (totalUsed / MAX_QUADS_PER_SLOT) * 100;
              const isFull = remaining <= 0;

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
                  <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isFull ? "bg-red-400" : remaining <= 2 ? "bg-amber-400" : "bg-emerald-400"
                      )}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-[9px] sm:text-[10px] font-bold mt-1",
                    isFull ? "text-red-500" : remaining <= 2 ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {isFull ? 'LOTADO' : `${remaining}/${MAX_QUADS_PER_SLOT} vagas`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modality Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {QUAD_CARDS.map((card, cardIndex) => {
          const quad = quads[cardIndex];
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

                {/* Icon */}
                <div className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2 transition-colors",
                  isActive ? "bg-white/20" : colors.iconBg
                )}>
                  <IconComp className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5",
                    isActive ? "text-white" : colors.text
                  )} />
                </div>

                {/* Title */}
                <h4 className={cn(
                  "font-black text-sm sm:text-base uppercase tracking-wide",
                  isActive ? "text-white" : "text-slate-800"
                )}>
                  {card.title}
                </h4>

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
                        const remaining = MAX_QUADS_PER_SLOT - (used + localUsedOthers);
                        
                        if (remaining <= 0) {
                          toast({ title: 'Horário Lotado', description: `Não há vagas disponíveis para as ${v}.`, variant: 'destructive' });
                          return;
                        }
                        
                        const newQty = Math.max(1, Math.min(quad.quantity || 1, remaining));
                        onUpdate(cardIndex, { time: v as QuadTime, quantity: newQty });
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
                          const remaining = Math.max(0, MAX_QUADS_PER_SLOT - totalUsed);
                          const isFull = remaining <= 0;
                          return (
                            <SelectItem 
                              key={t} 
                              value={t} 
                              className={cn("font-bold py-3", isFull ? "text-destructive" : "text-foreground")}
                              disabled={isFull && quad.time !== t}
                            >
                              {t} — 1h30 ({isFull ? 'LOTADO' : `${remaining} vagas`})
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
                      <div className="flex flex-col">
                        {quad.quantity > 0 ? (
                          <>
                            <span className={cn("text-xs font-bold leading-tight", isActive ? "text-white/80" : "text-slate-600")}>
                              {quad.quantity}x =
                            </span>
                            <span className={cn("text-base sm:text-lg font-black leading-none mt-0.5", isActive ? "text-white" : "text-slate-800")}>
                              {formatCurrency(finalPrice * quad.quantity)}
                            </span>
                          </>
                        ) : (
                          <span className={cn("font-black text-sm", isActive ? "text-white" : "text-slate-700")}>
                            Selecione
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
                          return Math.max(0, MAX_QUADS_PER_SLOT - totalUsed);
                        })()}
                        onChange={(q) => onUpdate(cardIndex, { quantity: q })} 
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
          <p className="text-muted-foreground">• Segundas e Sextas: <strong>20% de desconto</strong></p>
          <p className="text-muted-foreground">• Sábado e Domingo: <strong>10% de desconto</strong></p>
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
