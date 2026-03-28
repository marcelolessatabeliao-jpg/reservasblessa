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
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-sans font-bold text-sm sm:text-base">{QUAD_LABELS[quad.type]}</p>
                {quad.type === 'adulto-crianca' && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">(válido para crianças até 11 anos)</p>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {discount > 0 ? (
                    <>
                      <span className="text-muted-foreground line-through text-xs sm:text-sm">{formatCurrency(basePrice)}</span>
                      <span className="text-primary font-bold text-base sm:text-lg">
                        {quad.quantity > 1 ? `${formatCurrency(finalPrice)} x ${quad.quantity} = ${formatCurrency(finalPrice * quad.quantity)}` : formatCurrency(finalPrice)}
                      </span>
                      <span className="inline-flex items-center gap-0.5 bg-sun/20 text-foreground text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                        <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> -{discount * 100}%
                      </span>
                    </>
                  ) : (
                    <span className="text-primary font-bold text-base sm:text-lg">
                      {quad.quantity > 1 ? `${formatCurrency(basePrice)} x ${quad.quantity} = ${formatCurrency(basePrice * quad.quantity)}` : formatCurrency(basePrice)}
                    </span>
                  )}
                </div>
              </div>
              <QuantityStepper 
                value={quad.quantity} 
                onChange={async (q) => {
                  if (q > quad.quantity && quad.time) {
                    const dbUsed = await getQuadAvailability(format(checkDate!, 'yyyy-MM-dd'), quad.time);
                    const localUsedOthers = quads.reduce((acc, qry, idx) => {
                      if (idx !== i && qry.time === quad.time) return acc + qry.quantity;
                      return acc;
                    }, 0);

                    if (dbUsed + localUsedOthers + q > MAX_QUADS_PER_SLOT) {
                       const rest = MAX_QUADS_PER_SLOT - (dbUsed + localUsedOthers);
                       toast({ 
                         title: 'Quantidade indisponível', 
                         description: `Não há vagas suficientes às ${quad.time}. Máximo permitido: ${MAX_QUADS_PER_SLOT - dbUsed} adicionais.`, 
                         variant: 'destructive' 
                       });
                       return;
                    }
                  }
                  onUpdate(i, { quantity: q });
                }} 
              />
            </div>

            {quad.quantity > 0 && (
              <div className="pt-3 border-t flex flex-col gap-3">
                 <div className="flex items-center gap-2 bg-primary/5 px-4 h-12 rounded-2xl border border-primary/10 shadow-sm">
                   <CalendarIcon className="h-4 w-4 text-primary" />
                   <div>
                     <p className="text-[10px] font-bold uppercase text-primary/60 tracking-wider leading-none mb-1">Data Sincronizada</p>
                     <p className="font-bold text-sm text-primary uppercase leading-none">
                       {quad.date ? format(quad.date, "dd/MM/yyyy (EEE)", { locale: ptBR }) : "--/--/----"}
                     </p>
                   </div>
                 </div>

                <Select 
                  value={quad.time || ''} 
                  onValueChange={async (v) => {
                    if (!quad.date) {
                        toast({ title: 'Escolha uma data primeiro', variant: 'destructive' });
                        return;
                    }
                    const checkDate = quad.date;
                    const used = await getQuadAvailability(format(checkDate, 'yyyy-MM-dd'), v);
                    if (used + quad.quantity > MAX_QUADS_PER_SLOT) {
                        toast({ title: 'Horário Lotado', description: `Restam apenas ${MAX_QUADS_PER_SLOT - used} quadriciclos para as ${v}.`, variant: 'destructive' });
                        return;
                    }
                    onUpdate(i, { time: v as QuadTime });
                  }}
                  disabled={!quad.date || isFetchingAvailability} // Disable if no date or fetching
                >
                  <SelectTrigger className="w-full h-12 rounded-2xl border-white/80 bg-white/70 backdrop-blur-sm shadow-sm hover:bg-white hover:border-primary/30 font-bold text-sm uppercase tracking-tight">
                    <SelectValue placeholder="Escolha o Horário" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {isFetchingAvailability ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="animate-spin text-primary h-4 w-4" />
                      </div>
                    ) : (
                      QUAD_TIMES.map(t => {
                        const dbUsed = slotAvailabilities[t] || 0;
                        // Calculamos o quanto JÁ foi selecionado localmente em OUTROS tipos de quadriciclo para esse mesmo horário
                        const localUsedOthers = quads.reduce((acc, q, idx) => {
                          if (idx !== i && q.time === t) return acc + q.quantity;
                          return acc;
                        }, 0);

                        const totalUsed = dbUsed + localUsedOthers;
                        const remaining = MAX_QUADS_PER_SLOT - totalUsed;
                        const isFull = remaining <= 0;
                        const canSelect = quad.time === t || remaining >= quad.quantity;

                        return (
                          <SelectItem 
                            key={t} 
                            value={t} 
                            className={cn("font-bold py-3", {
                              "text-muted-foreground cursor-not-allowed": isFull,
                              "text-red-500": isFull && quad.time !== t, // Highlight full slots not currently selected
                            })}
                            disabled={isFull && quad.time !== t} // Disable if full and not the currently selected time
                          >
                            {t} — Passeio de 1h30 ({isFull ? 'Lotado' : `${remaining} vagas`})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {quad.time && (
                   <p className="text-[10px] text-primary/60 font-bold uppercase text-center py-1 bg-white/40 rounded-lg">
                      Horário selecionado. Lotação máx: {MAX_QUADS_PER_SLOT} quads/slot.
                   </p>
                )}
              </div>
            )}
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
