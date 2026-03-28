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
               "group relative overflow-hidden bg-white/70 backdrop-blur-xl rounded-[3rem] border-4 transition-all duration-500 p-6 sm:p-8",
               kiosk.quantity > 0 
                ? "border-emerald-500 shadow-2xl shadow-emerald-200/60 scale-[1.01]" 
                : "border-emerald-50 hover:border-emerald-200 hover:shadow-xl hover:bg-white"
          )}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-all pointer-events-none group-hover:scale-110">
               <Home className="w-40 h-40 rotate-12" />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 relative z-10">
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                     <div className={cn(
                        "p-3 rounded-2xl shadow-sm transition-all",
                        kiosk.quantity > 0 ? "bg-emerald-600 text-white shadow-emerald-200" : "bg-emerald-50 text-emerald-600"
                     )}>
                        <Home className="h-6 w-6" />
                     </div>
                     <h4 className="font-gliker text-2xl sm:text-3xl text-emerald-950 uppercase tracking-tighter">{info.label}</h4>
                     {kiosk.type === 'maior' && (
                        <div className="bg-sun/20 p-1.5 rounded-xl border border-sun/30">
                           <Star className="h-4 w-4 text-sun fill-sun animate-pulse" />
                        </div>
                     )}
                  </div>
                  <div className="flex flex-wrap gap-4 mb-4">
                     <div className="flex items-center gap-2 font-black text-[10px] text-emerald-800/40 uppercase tracking-[0.2em] bg-emerald-50/50 px-3 py-1.5 rounded-xl border border-emerald-100/50">
                        <Tent className="h-3.5 w-3.5 text-emerald-600" /> Capacidade: {info.capacity}
                     </div>
                     <div className={cn(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-xl border flex items-center gap-2", 
                        isFull ? "bg-red-50 text-red-500 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                     )}>
                        <div className={cn("w-2 h-2 rounded-full", isFull ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
                        {isFetching ? 'VERIFICANDO...' : (isFull ? 'ESTÁ LOTADO HOJE' : `${remaining} DISPONÍVEIS`)}
                     </div>
                  </div>
                  <div className="flex items-baseline gap-2 bg-emerald-50/50 p-2 rounded-2xl w-fit">
                     <span className={cn("font-black text-4xl tracking-tighter", kiosk.quantity > 0 ? "text-emerald-700" : "text-emerald-900/40 transition-colors group-hover:text-emerald-900")}>
                         {formatCurrency(basePrice)}
                     </span>
                     <span className="text-[10px] font-black text-emerald-900/20 uppercase tracking-widest mt-2">/ por locação</span>
                  </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-3">
                <div className="p-2 rounded-3xl bg-white shadow-inner border border-emerald-100/50 hover:scale-105 transition-transform active:scale-95">
                  <QuantityStepper 
                    value={kiosk.quantity} 
                    onChange={(q) => handleUpdate(i, q, remaining)} 
                    max={remaining} 
                    disabled={isFull || isFetching}
                  />
                </div>
                {kiosk.quantity > 0 && (
                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 animate-in zoom-in duration-300">
                      <CheckCircle2 className="h-3 w-3" /> Selecionado
                   </span>
                )}
              </div>
            </div>
            
            <div className="mt-8 p-5 bg-emerald-50/30 rounded-[2rem] border-2 border-dashed border-emerald-100/50">
               <div className="flex flex-wrap gap-2">
                 {['Churrasqueira', 'Pia exclusiva', 'Grelha inclusa', 'Mesas e Cadeiras'].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-900 bg-white/70 px-4 py-2 rounded-2xl shadow-sm border border-white">
                       <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {item}
                    </span>
                 ))}
               </div>
            </div>

            {kiosk.quantity > 0 && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="mt-6 flex items-center gap-4 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white px-7 py-5 rounded-[2.5rem] shadow-2xl shadow-emerald-200 relative overflow-hidden group/confirm"
               >
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/confirm:opacity-100 transition-opacity" />
                  <CalendarIcon className="h-6 w-6 text-emerald-200 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-emerald-200 uppercase leading-none mb-1 tracking-[0.2em]">Reserva Garantida:</p>
                    <p className="font-gliker text-xl uppercase leading-none tracking-tight">
                       {kiosk.date ? format(kiosk.date, "dd MMMM (EEE)", { locale: ptBR }) : "--"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-200 uppercase block mb-1">Subtotal:</span>
                    <span className="font-gliker text-2xl tracking-tighter text-white">{formatCurrency(basePrice * kiosk.quantity)}</span>
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
