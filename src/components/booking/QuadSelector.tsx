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
          <h3 className="font-gliker text-3xl text-indigo-950 leading-tight tracking-tighter">AVENTURA 4X4</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] font-black uppercase text-indigo-600/60 tracking-widest leading-none">Passeios em Combate Off-Road</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="group bg-gradient-to-br from-indigo-50 to-indigo-100/30 p-5 rounded-[2.5rem] border-2 border-indigo-200/50 shadow-sm hover:shadow-md transition-all">
           <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm"><Timer className="h-6 w-6" /></div>
              <div>
                 <p className="font-black text-indigo-950 leading-tight text-lg mb-1">EXPEDIÇÃO 1H30</p>
                 <p className="text-[10px] font-bold text-indigo-700/60 uppercase tracking-widest leading-relaxed">Puro off-road com paradas estratégicas</p>
              </div>
           </div>
        </div>
        <div className="group bg-gradient-to-br from-indigo-50 to-indigo-100/30 p-5 rounded-[2.5rem] border-2 border-indigo-200/50 shadow-sm hover:shadow-md transition-all">
           <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-2xl text-indigo-600 shadow-sm"><Map className="h-6 w-6" /></div>
              <div>
                 <p className="font-black text-indigo-950 leading-tight text-lg mb-1">ROTEIRO EXCLUSIVO</p>
                 <p className="text-[10px] font-bold text-indigo-700/60 uppercase tracking-widest leading-relaxed">Trilhas, rios e piscinas naturais</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
      {quads.map((quad, i) => {
        const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
        const basePrice = getPrice(`quad_${quad.type}`, fallbackMap[quad.type] || 0);
        const discount = getQuadDiscount(quad.date);
        const finalPrice = basePrice * (1 - discount);

        return (
          <div key={quad.type} className={cn(
            "group relative overflow-hidden bg-white/70 backdrop-blur-xl rounded-[3rem] border-4 transition-all duration-500 p-6 sm:p-8",
            quad.quantity > 0 
              ? "border-indigo-500 shadow-2xl shadow-indigo-200/60 scale-[1.01]" 
              : "border-indigo-50 hover:border-indigo-200 hover:shadow-xl hover:bg-white"
          )}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-all pointer-events-none group-hover:scale-110">
               <Bike className="w-40 h-40 -rotate-12" />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 relative z-10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-sm transition-all",
                    quad.quantity > 0 ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-600"
                  )}>
                    <Bike className="h-6 w-6" />
                  </div>
                  <h4 className="font-gliker text-2xl sm:text-3xl text-indigo-950 uppercase tracking-tighter">{QUAD_LABELS[quad.type]}</h4>
                  {discount > 0 && (
                    <motion.span 
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="inline-flex items-center gap-1 bg-gradient-to-r from-sun to-yellow-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg"
                    >
                      <Tag className="h-3 w-3" /> -{discount * 100}% OFF
                    </motion.span>
                  )}
                </div>
                {quad.type === 'adulto-crianca' && (
                  <p className="text-[10px] font-black text-indigo-600/60 mb-4 ml-1 uppercase tracking-widest flex items-center gap-2">
                    <Info className="h-3 w-3" /> Crianças até 11 anos acompanhadas
                  </p>
                )}
                
                <div className="flex items-center gap-3 bg-indigo-50/50 p-2 rounded-2xl w-fit">
                  <span className={cn("font-black text-4xl tracking-tighter", quad.quantity > 0 ? "text-indigo-700" : "text-indigo-900/40 transition-colors group-hover:text-indigo-900")}>
                    {formatCurrency(finalPrice)}
                  </span>
                  {discount > 0 && (
                    <span className="text-muted-foreground line-through text-sm font-bold opacity-30">{formatCurrency(basePrice)}</span>
                  )}
                  <span className="text-[10px] font-black text-indigo-900/20 uppercase tracking-widest mt-2">/por quad</span>
                </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-3">
                <div className={cn(
                  "transition-all duration-700 p-2 rounded-3xl bg-white shadow-inner border border-indigo-100/50", 
                  !quad.time ? "opacity-20 grayscale pointer-events-none scale-90" : "opacity-100 hover:scale-105 active:scale-95"
                )}>
                  <QuantityStepper 
                    value={quad.quantity} 
                    onChange={(q) => handleQuantityChange(i, q)} 
                    max={5}
                  />
                </div>
                {!quad.time && (
                  <motion.span 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em]"
                  >
                    Selecione o Horário
                  </motion.span>
                )}
                {quad.quantity > 0 && (
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 animate-in zoom-in duration-300">
                    <CheckCircle2 className="h-3 w-3" /> Selecionado
                  </span>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-indigo-100/50 flex flex-col gap-4">
              <div className="relative group/select">
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
                      "w-full h-16 rounded-2xl border-4 transition-all font-black text-sm uppercase tracking-widest flex items-center justify-between px-6",
                      quad.time 
                        ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-200" 
                        : "bg-indigo-50/50 border-indigo-100 text-indigo-900/60 hover:bg-white hover:border-indigo-400"
                    )}>
                      <div className="flex items-center gap-3">
                        <Timer className={cn("h-5 w-5", quad.time ? "text-indigo-200" : "text-indigo-400")} />
                        <SelectValue placeholder="CLIQUE PARA ESCOLHER O HORÁRIO" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-[2.5rem] border-4 border-indigo-100 shadow-2xl p-2 bg-white/95 backdrop-blur-md">
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
                            className="font-black py-4 text-indigo-950 rounded-2xl focus:bg-indigo-50 focus:text-indigo-700 transition-colors uppercase tracking-widest text-xs px-6"
                          >
                            <div className="flex items-center justify-between w-full min-w-[200px] gap-8">
                              <span className="text-sm">{t}</span>
                              <span className={cn(
                                "text-[10px] px-3 py-1 rounded-full font-black border", 
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
                  {isFetchingAvailability && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-indigo-400" />}
              </div>
                
              {quad.quantity > 0 && quad.time && (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="flex items-center gap-4 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-7 py-5 rounded-[2.5rem] shadow-2xl shadow-indigo-300 relative overflow-hidden group"
                 >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CalendarIcon className="h-6 w-6 text-indigo-300 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-indigo-300 uppercase leading-none mb-1 tracking-[0.2em]">Reserva Confirmada:</p>
                      <p className="font-gliker text-xl uppercase leading-none tracking-tight">
                         {quad.date ? format(quad.date, "dd MMM", { locale: ptBR }) : "--"} às <span className="text-sun">{quad.time}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Subtotal:</span>
                      <span className="font-gliker text-2xl tracking-tighter text-white">{formatCurrency(finalPrice * quad.quantity)}</span>
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

