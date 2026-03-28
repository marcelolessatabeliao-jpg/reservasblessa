import { QuantityStepper } from '@/components/QuantityStepper';
import { AdditionalItem, ADDITIONAL_INFO, formatCurrency } from '@/lib/booking-types';
import { Fish, CircleDot, Loader2, Info, Sparkles, CheckCircle2 } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const ICONS: Record<string, typeof Fish> = {
  'pesca': Fish,
  'futebol-sabao': CircleDot,
};

interface Props {
  additionals: AdditionalItem[];
  onUpdate: (index: number, updates: Partial<AdditionalItem>) => void;
}

export function AdditionalSelector({ additionals, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-12 h-12 rounded-[1.25rem] bg-amber-100 text-amber-700 shadow-sm border border-amber-200">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-2xl text-amber-950 leading-tight">DIVERSÃO & LAZER</h3>
          <p className="text-[10px] font-bold uppercase text-amber-600/60 tracking-widest leading-none">Serviços Adicionais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
      {additionals.map((item, i) => {
        const info = ADDITIONAL_INFO[item.type];
        const basePrice = getPrice(`add_${item.type}`, info.price);
        const Icon = ICONS[item.type] || Fish;
        
        return (
          <div key={item.type} className={cn(
               "group relative overflow-hidden bg-white rounded-3xl border-2 transition-all duration-300 p-5 sm:p-6",
               item.quantity > 0 
                ? "border-amber-500 shadow-lg scale-[1.01]" 
                : "border-amber-100 hover:border-amber-200 hover:shadow-md"
          )}>
            <div className="absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform">
               <Icon className="w-24 h-24" />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                     <div className={cn(
                        "p-2 rounded-xl transition-all",
                        item.quantity > 0 ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"
                     )}>
                        <Icon className="h-5 w-5" />
                     </div>
                     <h4 className="font-bold text-lg sm:text-xl text-amber-950 uppercase tracking-tight">{info.label}</h4>
                  </div>
                  <div className="mb-3">
                     <p className="text-[10px] font-bold text-amber-900/40 uppercase tracking-wider leading-relaxed">{info.description}</p>
                  </div>
                  <div className="flex items-baseline gap-1.5 bg-amber-50/50 px-3 py-1 rounded-xl w-fit">
                     <span className={cn("font-extrabold text-2xl tracking-tighter", item.quantity > 0 ? "text-amber-600" : "text-amber-900")}>
                         {formatCurrency(basePrice)}
                     </span>
                     <span className="text-[10px] font-bold text-amber-900/30 uppercase tracking-wider mt-1.5">{item.type === 'futebol-sabao' ? '/pessoa' : '/molinete'}</span>
                  </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-2 pt-2 sm:pt-0">
                 <div className="bg-white border border-amber-100 rounded-2xl p-1">
                    <QuantityStepper value={item.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
                 </div>
                 {item.quantity > 0 && (
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Selecionado</span>
                 )}
              </div>
            </div>
            
            {item.quantity > 0 && (
               <motion.div 
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mt-5 flex items-center gap-3 bg-amber-600 text-white px-5 py-3 rounded-2xl shadow-md"
               >
                  <Sparkles className="h-5 w-5 text-amber-200 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] font-bold opacity-80 uppercase leading-none mb-1 tracking-wider">Total:</p>
                    <p className="font-bold text-sm uppercase leading-none tracking-tight">
                       {formatCurrency(basePrice * item.quantity)}
                    </p>
                  </div>
               </motion.div>
            )}

            {item.type === 'pesca' && (
              <div className="mt-5 bg-red-50 p-3 rounded-2xl border border-red-100/50">
                <p className="text-[9px] font-bold text-red-900 leading-relaxed uppercase tracking-wider flex items-center gap-1.5">
                   <Info className="h-3 w-3 text-red-500" />
                   <span>Traga seu molinete completo.</span>
                </p>
              </div>
            )}
            
            {item.type === 'futebol-sabao' && (
              <div className="mt-4 bg-amber-50 border border-amber-100 p-3 rounded-2xl">
                <p className="text-[9px] font-bold text-amber-900 leading-relaxed uppercase tracking-tight">
                  <strong className="text-amber-700">💡 Partida:</strong> Mínimo de 6 e máximo recomendado de 16 pessoas (8 vs 8).
                </p>
              </div>
            )}
          </div>
        );
      })}
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[10.5px] font-bold text-amber-900 leading-relaxed">
          Os serviços desta etapa são opcionais. Você pode pular ou adicionar conforme sua preferência.
        </p>
      </div>
    </div>
  );
}
