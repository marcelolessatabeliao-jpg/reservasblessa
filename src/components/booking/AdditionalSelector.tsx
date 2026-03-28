import { QuantityStepper } from '@/components/QuantityStepper';
import { AdditionalItem, ADDITIONAL_INFO, formatCurrency } from '@/lib/booking-types';
import { Fish, CircleDot, Loader2, Info, Star, Sparkles, CheckCircle2 } from 'lucide-react';
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
          <h3 className="font-gliker text-2xl text-amber-950 leading-tight">Diversão & Lazer</h3>
          <p className="text-[10px] font-black uppercase text-amber-600/60 tracking-widest leading-none">Serviços Adicionais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
      {additionals.map((item, i) => {
        const info = ADDITIONAL_INFO[item.type];
        const basePrice = getPrice(`add_${item.type}`, info.price);
        const Icon = ICONS[item.type] || Fish;
        
        return (
          <div key={item.type} className={cn(
               "group relative overflow-hidden bg-white/60 backdrop-blur-md rounded-[3rem] border-4 transition-all duration-500 p-6 sm:p-8",
               item.quantity > 0 
                ? "border-amber-500 shadow-2xl shadow-amber-200/50 scale-[1.02]" 
                : "border-transparent bg-amber-50/30 hover:bg-white hover:border-amber-300 hover:shadow-2xl hover:scale-[1.01]"
          )}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-all group-hover:scale-110">
               <Icon className="w-32 h-32" />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                     <div className={cn(
                        "p-3 rounded-2xl shadow-sm transition-all",
                        item.quantity > 0 ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
                     )}>
                        <Icon className="h-6 w-6" />
                     </div>
                     <h4 className="font-gliker text-2xl sm:text-3xl text-amber-950 uppercase tracking-tighter">{info.label}</h4>
                  </div>
                  <div className="space-y-2 mb-4">
                     <p className="text-xs sm:text-sm font-bold text-amber-900/40 uppercase tracking-[0.2em]">{info.description}</p>
                  </div>
                  <div className="flex items-baseline gap-2">
                     <span className={cn("font-black text-4xl tracking-tighter", item.quantity > 0 ? "text-amber-600" : "text-amber-400 group-hover:text-amber-500")}>
                         {formatCurrency(basePrice)}
                     </span>
                     <span className="text-xs font-black text-amber-900/20 uppercase tracking-widest">{item.type === 'futebol-sabao' ? '/ por pessoa' : '/ por molinete'}</span>
                  </div>
              </div>

              <div className="w-full sm:w-auto flex flex-col items-center gap-2">
                 <QuantityStepper value={item.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
                 {item.quantity > 0 && (
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest animate-pulse">Selecionado</span>
                 )}
              </div>
            </div>
            
            {item.quantity > 0 && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mt-6 flex items-center gap-3 bg-amber-600 text-white px-6 py-4 rounded-[2rem] shadow-xl shadow-amber-200"
               >
                  <Sparkles className="h-5 w-5 text-amber-200 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-[10px] font-black opacity-80 uppercase leading-none mb-1 tracking-widest">Total Reservado:</p>
                    <p className="font-gliker text-lg uppercase leading-none tracking-tight">
                       {formatCurrency(basePrice * item.quantity)}
                    </p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-amber-200" />
               </motion.div>
            )}

            {item.type === 'pesca' && (
              <div className="mt-6 bg-red-50/50 border-2 border-dashed border-red-200 p-4 rounded-3xl">
                <p className="text-[10px] font-black text-red-900 leading-relaxed uppercase tracking-wider flex items-center gap-2">
                   <Info className="h-4 w-4 text-red-500" />
                   <span><strong className="text-red-600">Equipamento:</strong> Traga seu molinete completo.</span>
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
