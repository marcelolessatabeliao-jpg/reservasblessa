import React, { useState, useEffect, useCallback } from 'react';
import { Bike, Tag, CalendarIcon, Loader2, Info, Timer, Map, Wind, MapPin, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuantityStepper } from '@/components/QuantityStepper';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime } from '@/lib/booking-types';
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
        // Fetch all slots in parallel
        const results = await Promise.all(
          QUAD_TIMES.map(t => getQuadAvailability(format(checkDate, 'yyyy-MM-dd'), t))
        );
        QUAD_TIMES.forEach((t, i) => {
          avail[t] = results[i];
        });
        setSlotAvailabilities(avail);
      } catch (error) {
        console.error("Error fetching quad availability:", error);
      } finally {
        setIsFetchingAvailability(false);
      }
    }
    fetchAvailability();
  }, [checkDate]);

  const handleQuantityChange = useCallback((i: number, q: number) => {
    const currentQuad = quads[i];
    if (!currentQuad.time) return;

    // Use pure logic for limit check to avoid unnecessary state access delay
    if (q > currentQuad.quantity) {
      const othersInSameSlot = quads.reduce((acc, qry, idx) => {
        if (idx !== i && qry.time === currentQuad.time) return acc + qry.quantity;
        return acc;
      }, 0);

      const dbUsed = slotAvailabilities[currentQuad.time] || 0;
      const availableRemaining = MAX_QUADS_PER_SLOT - dbUsed - othersInSameSlot;

      if (q - currentQuad.quantity > availableRemaining) {
        toast({ 
          title: 'Vagas Esgotadas', 
          description: availableRemaining > 0 
            ? `Só restam ${availableRemaining} vagas para as ${currentQuad.time}.` 
            : `As ${currentQuad.time} já estão totalmente reservadas.`, 
          variant: 'destructive' 
        });
        return;
      }
    }

    onUpdate(i, { quantity: q });
  }, [quads, slotAvailabilities, onUpdate, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="animate-spin text-indigo-600 h-10 w-10" />
        <p className="font-black text-indigo-950/40 uppercase tracking-widest text-xs">Preparando Máquinas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center justify-center w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-200 border-2 border-indigo-400/50">
          <Bike className="h-7 w-7 animate-pulse" />
        </div>
        <div>
          <h3 className="font-bold text-2xl text-indigo-950 leading-tight">AVENTURA 4X4</h3>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase text-indigo-600/60 tracking-wider">Aventure-se nas trilhas do Lessa</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <div className="group bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
           <div className="flex items-start gap-3">
              <Timer className="h-5 w-5 text-indigo-600" />
              <div>
                 <p className="font-bold text-indigo-950 leading-tight text-base">Expedição 1h30</p>
                 <p className="text-[9px] font-bold text-indigo-700/60 uppercase tracking-wider">Off-road com paradas estratégicas</p>
              </div>
           </div>
        </div>
        <div className="group bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
           <div className="flex items-start gap-3">
              <Map className="h-5 w-5 text-indigo-600" />
              <div>
                 <p className="font-bold text-indigo-950 leading-tight text-base">Roteiro Exclusivo</p>
                 <p className="text-[9px] font-bold text-indigo-700/60 uppercase tracking-wider">Trilhas, rios e piscinas naturais</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
      {quads.map((quad, i) => {
        const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
        const basePrice = getPrice(`quad_${quad.type}`, fallbackMap[quad.type] || 0);
        const discount = getQuadDiscount(quad.date);
        const finalPrice = basePrice * (1 - discount);

        return (
          <div key={quad.type} className={cn(
            "group relative overflow-hidden bg-white rounded-3xl border-2 transition-all duration-300 p-5 sm:p-6",
            quad.quantity > 0 
              ? "border-indigo-500 shadow-lg scale-[1.01]" 
              : "border-indigo-100 hover:border-indigo-200 hover:shadow-md"
          )}>
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
               <Bike className="w-24 h-24" />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    "p-2 rounded-xl transition-all",
                    quad.quantity > 0 ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                  )}>
                    <Bike className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-lg sm:text-xl text-indigo-950 uppercase tracking-tight">{QUAD_LABELS[quad.type]}</h4>
                  {discount > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                      -{discount * 100}% OFF
                    </span>
                  )}
                </div>
                {quad.type === 'adulto-crianca' && (
                  <p className="text-[9px] font-bold text-indigo-600/60 mb-3 ml-0.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="h-3 w-3" /> Crianças até 11 anos acompanhadas
                  </p>
                )}
                
                <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1.5 rounded-xl w-fit">
                  <span className={cn("font-extrabold text-2xl tracking-tighter", quad.quantity > 0 ? "text-indigo-700" : "text-indigo-900")}>
                    {formatCurrency(finalPrice)}
                  </span>
                  {discount > 0 && (
                    <span className="text-muted-foreground line-through text-[10px] font-bold opacity-30">{formatCurrency(basePrice)}</span>
                  )}
                  <span className="text-[10px] font-bold text-indigo-900/30 uppercase tracking-wider mt-1.5">/por quad</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-2">
                <div className="bg-white border border-indigo-100 rounded-2xl p-1">
                  <QuantityStepper 
                    value={quad.quantity} 
                    onChange={(q) => handleQuantityChange(i, q)} 
                    max={5}
                  />
                </div>
                {!quad.time && (
                  <span className="text-[9px] font-bold uppercase text-indigo-400 tracking-wider">
                    Escolha o Horário
                  </span>
                )}
                {quad.quantity > 0 && (
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Selecionado
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-indigo-100/50 flex flex-col gap-3">
              <Select 
                value={quad.time || ''} 
                onValueChange={(v) => {
                  const dbUsed = slotAvailabilities[v] || 0;
                  const localUsedOthers = quads.reduce((acc, q, idx) => {
                    if (idx !== i && q.time === v) return acc + q.quantity;
                    return acc;
                  }, 0);
                  const availableSlot = MAX_QUADS_PER_SLOT - dbUsed - localUsedOthers;
                  
                  if (availableSlot <= 0) {
                      toast({ title: 'Horário Lotado', description: `Não há mais vagas disponíveis às ${v}.`, variant: 'destructive' });
                      return;
                  }
                  
                  const newQty = Math.min(quad.quantity || 1, availableSlot);
                  onUpdate(i, { time: v as QuadTime, quantity: newQty });
                }}
                disabled={isFetchingAvailability} 
              >
                  <SelectTrigger className={cn(
                    "w-full h-12 rounded-xl border transition-all font-bold text-xs uppercase tracking-wider px-4",
                    quad.time 
                      ? "bg-indigo-600 border-indigo-400 text-white" 
                      : "bg-indigo-50/50 border-indigo-100 text-indigo-900/60"
                  )}>
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      <SelectValue placeholder="Escolha o Horário" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border border-indigo-100 shadow-xl bg-white">
                    {QUAD_TIMES.map(t => {
                      const dbUsed = slotAvailabilities[t] || 0;
                      const localUsedOthers = quads.reduce((acc, q, idx) => {
                        if (idx !== i && q.time === t) return acc + q.quantity;
                        return acc;
                      }, 0);
                      const remainingSlots = MAX_QUADS_PER_SLOT - dbUsed - localUsedOthers;
                      const isFullSlot = remainingSlots <= 0;

                      return (
                        <SelectItem 
                          key={t} 
                          value={t} 
                          disabled={isFullSlot && quad.time !== t}
                          className="font-bold py-3 text-indigo-950 rounded-lg focus:bg-indigo-50"
                        >
                          <div className="flex items-center justify-between w-full min-w-[150px] gap-4">
                            <span>{t}</span>
                            <span className={cn(
                              "text-[8px] px-2 py-0.5 rounded-full font-bold border", 
                              isFullSlot 
                                ? "bg-red-50 text-red-600 border-red-100" 
                                : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            )}>
                               {isFullSlot ? 'LOTADO' : `${remainingSlots} VAGAS`}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
              {quad.quantity > 0 && quad.time && (
                 <motion.div 
                   initial={{ opacity: 0, y: 5 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="flex items-center gap-3 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-md"
                 >
                    <CalendarIcon className="h-5 w-5 text-indigo-300 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[9px] font-bold text-indigo-200 uppercase leading-none mb-1 tracking-wider">Confirmado:</p>
                      <p className="font-bold text-sm uppercase leading-none">
                         {quad.date ? format(quad.date, "dd MMM", { locale: ptBR }) : "--"} às {quad.time}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-indigo-200 uppercase block mb-1">Total:</span>
                      <span className="font-extrabold text-base tracking-tight">{formatCurrency(finalPrice * quad.quantity)}</span>
                    </div>
                 </motion.div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      <div className="bg-amber-100/30 border-2 border-dashed border-amber-300 p-6 rounded-[2.5rem] flex items-start gap-4">
        <div className="p-2 bg-amber-400 text-white rounded-xl shrink-0"><Info className="h-5 w-5" /></div>
        <p className="text-[11px] font-black text-amber-950/70 leading-relaxed uppercase tracking-wider">
          <strong className="text-amber-600 text-xs">⚠️ ATENÇÃO:</strong> OS VALORES ACIMA SÃO EXCLUSIVOS PARA O PASSEIO. O ACESSO AO BALNEÁRIO (DAY USE) DEVE SER ADICIONADO NO PRIMEIRO PASSO DO AGENDAMENTO.
        </p>
      </div>
    </div>
  );
}

