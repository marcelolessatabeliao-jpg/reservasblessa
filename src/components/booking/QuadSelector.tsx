import React, { useState, useEffect } from 'react';
import { Bike, Tag, CalendarIcon, Loader2 } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime, isOperatingDay } from '@/lib/booking-types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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

export function QuadSelector({ quads, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const { toast } = useToast();
    const [slotAvailabilities, setSlotAvailabilities] = useState<Record<string, number>>({});
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);
  const MAX_QUADS_PER_SLOT = 5;

  // Fetch slot availability whenever the date of the first quad changes
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

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <Bike className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <h3 className="font-sans font-bold text-lg sm:text-xl">3. Passeio de Quadriciclo</h3>
      </div>
      
      <div className="bg-sun/10 border border-sun/20 p-3 sm:p-4 rounded-xl mb-4 shadow-sm">
        <p className="text-xs sm:text-sm text-sun-dark font-medium leading-relaxed">
          <strong className="font-bold uppercase tracking-wider">⏱️ Duração: 1h30 de passeio</strong> com Desafios com pedras, lama, rio, barrancos, floresta, buracos, poças de água, piscina natural, batistério e uma incrível tirolesa!
        </p>
      </div>

      {quads.map((quad, i) => {
        // Dynamic price from DB, fallback to 150/250/200 if not yet loaded or missing
        const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
        const basePrice = getPrice(`quad_${quad.type}`, fallbackMap[quad.type] || 0);
        const discount = getQuadDiscount(quad.date);
        const finalPrice = basePrice * (1 - discount);

        return (
          <div key={quad.type} className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-4 sm:p-5 shadow-xl">
            <div className="space-y-4">
              {/* Time Selection First */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest ml-1">
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
                      if (idx !== i && qry.time === v) return acc + qry.quantity;
                      return acc;
                    }, 0);
                    const remaining = MAX_QUADS_PER_SLOT - (used + localUsedOthers);
                    
                    if (remaining <= 0) {
                        toast({ title: 'Horário Lotado', description: `Não há vagas disponíveis para as ${v}.`, variant: 'destructive' });
                        return;
                    }
                    
                    // Limit current quantity to remaining
                    const newQty = Math.min(quad.quantity, remaining);
                    onUpdate(i, { time: v as QuadTime, quantity: newQty });
                  }}
                  disabled={!quad.date || isFetchingAvailability}
                >
                  <SelectTrigger className={cn(
                    "w-full h-12 rounded-2xl border-white/80 bg-white shadow-sm font-bold text-sm uppercase tracking-tight",
                    !quad.time && "border-primary/30 ring-2 ring-primary/10 animate-pulse"
                  )}>
                    <SelectValue placeholder="CLIQUE PARA ESCOLHER O HORÁRIO" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {QUAD_TIMES.map(t => {
                      const dbUsed = slotAvailabilities[t] || 0;
                      const localUsedOthers = quads.reduce((acc, q, idx) => {
                        if (idx !== i && q.time === t) return acc + q.quantity;
                        return acc;
                      }, 0);
                      const remaining = MAX_QUADS_PER_SLOT - (dbUsed + localUsedOthers);
                      const isFull = remaining <= 0;
                      return (
                        <SelectItem 
                          key={t} 
                          value={t} 
                          className={cn("font-bold py-3", isFull ? "text-destructive" : "text-foreground")}
                          disabled={isFull && quad.time !== t}
                        >
                          {t} — Passeio de 1h30 ({isFull ? 'LOTADO' : `${remaining} vagas`})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity Selection Second */}
              <div className={cn(
                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                quad.time ? "bg-primary/5 border-primary/10" : "bg-slate-50 border-slate-100 opacity-50 pointer-events-none"
              )}>
                <div>
                  <label className="text-[10px] font-bold text-primary/40 uppercase tracking-widest block mb-1">
                    2. Quantidade
                  </label>
                  <p className="font-sans font-bold text-sm sm:text-base">{QUAD_LABELS[quad.type]}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {discount > 0 ? (
                      <>
                        <span className="text-muted-foreground line-through text-[10px] sm:text-xs">{formatCurrency(basePrice)}</span>
                        <span className="text-primary font-bold text-base">
                          {quad.quantity > 0 ? formatCurrency(finalPrice * quad.quantity) : formatCurrency(finalPrice)}
                        </span>
                        <span className="bg-sun/20 text-sun-dark text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                          <Tag className="h-2.5 w-2.5" /> -{discount * 100}%
                        </span>
                      </>
                    ) : (
                      <span className="text-primary font-bold text-base">
                        {quad.quantity > 0 ? formatCurrency(basePrice * quad.quantity) : formatCurrency(basePrice)}
                      </span>
                    )}
                  </div>
                </div>
                <QuantityStepper 
                  value={quad.quantity} 
                  max={(() => {
                    if (!quad.time || !checkDate) return 0;
                    const usedInDb = slotAvailabilities[quad.time] || 0;
                    // others = all quads in the SAME slot except this ones quantity
                    const usedLocallyOthers = quads.reduce((acc, qry, idx) => {
                      if (idx !== i && qry.time === quad.time) return acc + qry.quantity;
                      return acc;
                    }, 0);
                    return Math.max(0, MAX_QUADS_PER_SLOT - (usedInDb + usedLocallyOthers));
                  })()}
                  onChange={(q) => {
                    onUpdate(i, { quantity: q });
                  }} 
                />
              </div>

              {quad.quantity > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 px-4 h-10 rounded-xl border border-emerald-100 shadow-sm">
                  <CalendarIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">
                    Agendado para {format(quad.date!, "dd/MM/yyyy")} às {quad.time}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}

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
