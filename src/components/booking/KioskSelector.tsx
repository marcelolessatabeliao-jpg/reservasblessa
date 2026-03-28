import React, { useState, useEffect, useCallback } from 'react';
import { Home, AlertTriangle, CalendarIcon, Loader2, Info, CheckCircle2, Star, Tent } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { KioskItem, KIOSK_INFO, formatCurrency } from '@/lib/booking-types';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getKioskAvailability } from '@/lib/booking-service';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  kiosks: KioskItem[];
  onUpdate: (index: number, updates: Partial<KioskItem>) => void;
}

export function KioskSelector({ kiosks, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const [availabilities, setAvailabilities] = useState<Record<string, number>>({});
  const [isFetching, setIsFetching] = useState(false);

  const checkDate = kiosks[0]?.date;

  useEffect(() => {
    async function fetchAvail() {
      if (!checkDate) return;
      setIsFetching(true);
      try {
        const results = await Promise.all([
          getKioskAvailability(format(checkDate, 'yyyy-MM-dd'), 'menor'),
          getKioskAvailability(format(checkDate, 'yyyy-MM-dd'), 'maior')
        ]);
        setAvailabilities({ menor: results[0], maior: results[1] });
      } catch (err) {
        console.error("Error fetching kiosk availability:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchAvail();
  }, [checkDate]);

  const handleUpdate = useCallback((i: number, q: number, remaining: number) => {
      if (q > remaining) {
          toast({ title: 'Indisponível', description: 'Não há quiosques disponíveis para este dia.', variant: 'destructive' });
          return;
      }
      onUpdate(i, { quantity: q });
  }, [onUpdate, toast]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-12 h-12 rounded-[1.25rem] bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200">
          <Home className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-gliker text-2xl text-emerald-950 leading-tight">Escolha seu Espaço</h3>
          <p className="text-[10px] font-black uppercase text-emerald-600/60 tracking-widest leading-none">Quiosques para Família</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
      {kiosks.map((kiosk, i) => {
        const info = KIOSK_INFO[kiosk.type];
        const basePrice = getPrice(`kiosk_${kiosk.type}`, info.price);
        const used = availabilities[kiosk.type] || 0;
        const remaining = info.available - used;
        const isFull = remaining <= 0;
        
        return (
          <div key={kiosk.type} className={cn(
               "group relative overflow-hidden bg-white rounded-3xl border-2 transition-all duration-300 p-5 sm:p-6",
               kiosk.quantity > 0 
                ? "border-emerald-500 shadow-lg scale-[1.01]" 
                : "border-emerald-100 hover:border-emerald-200 hover:shadow-md"
          )}>
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
               <Home className="w-24 h-24" />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                     <div className={cn(
                        "p-2 rounded-xl transition-all",
                        kiosk.quantity > 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
                     )}>
                        <Home className="h-5 w-5" />
                     </div>
                     <h4 className="font-bold text-lg sm:text-xl text-emerald-950 uppercase tracking-tight">{info.label}</h4>
                     {kiosk.type === 'maior' && (
                        <div className="bg-amber-100 p-1 rounded-lg">
                           <Star className="h-3 w-3 text-amber-600 fill-amber-600" />
                        </div>
                     )}
                  </div>
                  
                  <div className="flex flex-wrap gap-3 mb-3">
                     <div className="flex items-center gap-1.5 font-bold text-[10px] text-emerald-800/60 uppercase tracking-wider">
                        <Tent className="h-3 w-3" /> Cap: {info.capacity}
                     </div>
                     <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5", 
                        isFull ? "text-red-500" : "text-emerald-600"
                     )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", isFull ? "bg-red-500" : "bg-emerald-500")} />
                        {isFetching ? 'Verificando...' : (isFull ? 'Lotado' : `${remaining} Disponíveis`)}
                     </div>
                  </div>

                  <div className="flex items-baseline gap-1.5 bg-emerald-50/80 px-3 py-1.5 rounded-xl w-fit">
                     <span className={cn("font-extrabold text-2xl tracking-tighter", kiosk.quantity > 0 ? "text-emerald-700" : "text-emerald-900")}>
                         {formatCurrency(basePrice)}
                     </span>
                     <span className="text-[10px] font-bold text-emerald-900/40 uppercase tracking-widest">/ locação</span>
                  </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-2 pt-2 sm:pt-0">
                <div className="bg-white border border-emerald-100 rounded-2xl p-1">
                  <QuantityStepper 
                    value={kiosk.quantity} 
                    onChange={(q) => handleUpdate(i, q, remaining)} 
                    max={remaining} 
                    disabled={isFull || isFetching}
                  />
                </div>
                {kiosk.quantity > 0 && (
                   <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Selecionado
                   </span>
                )}
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
               <div className="flex flex-wrap gap-2">
                 {['Churrasqueira', 'Pia exclusiva', 'Grelha inclusa', 'Mesas e Cadeiras'].map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-tight text-emerald-900/70">
                       <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {item}
                    </span>
                 ))}
               </div>
            </div>

            {kiosk.quantity > 0 && (
               <motion.div 
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mt-4 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-md overflow-hidden relative"
               >
                  <CalendarIcon className="h-5 w-5 text-emerald-200 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] font-bold opacity-80 uppercase leading-none mb-1 tracking-wider">Reserva para:</p>
                    <p className="font-bold text-sm uppercase leading-none">
                       {kiosk.date ? format(kiosk.date, "dd MMMM (EEE)", { locale: ptBR }) : "--"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold opacity-80 uppercase block mb-1">Total:</span>
                    <span className="font-extrabold text-base tracking-tight">{formatCurrency(basePrice * kiosk.quantity)}</span>
                  </div>
               </motion.div>
            )}
          </div>
        );
      })}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[10.5px] font-bold text-emerald-950 leading-relaxed">
             Importante: Reservas de quiosque não possuem reembolso em caso de desistência.
          </p>
          <p className="text-[9px] font-bold text-emerald-900/60 leading-relaxed">
             Obs: O valor refere-se apenas à reserva do espaço. Entradas são pagas separadamente.
          </p>
        </div>
      </div>
    </div>
  );
}
