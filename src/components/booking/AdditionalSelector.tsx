import { QuantityStepper } from '@/components/QuantityStepper';
import { AdditionalItem, ADDITIONAL_INFO, formatCurrency } from '@/lib/booking-types';
import { Fish, CircleDot, Loader2 } from 'lucide-react';
import { useServices } from '@/hooks/useServices';

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
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sun/20 text-foreground shrink-0">
          <span className="text-base sm:text-lg">⚡</span>
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl">4. Serviços Adicionais</h3>
      </div>

      {additionals.map((item, i) => {
        const info = ADDITIONAL_INFO[item.type];
        const basePrice = getPrice(`add_${item.type}`, info.price);
        const Icon = ICONS[item.type] || Fish;
        return (
          <div key={item.type} className="bg-white/95 backdrop-blur-md rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-lg transition-colors hover:border-slate-300">
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-sun/10 text-sun shrink-0">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <p className="font-display font-black text-[10px] sm:text-base uppercase tracking-tight leading-none truncate">{info.label}</p>
                  <p className="text-primary font-black text-xs sm:text-lg flex flex-row items-baseline gap-1 whitespace-nowrap mt-0.5 overflow-hidden">
                    {item.quantity >= 1 
                      ? (
                        <span className="flex items-center gap-1 flex-nowrap shrink-0">
                          <span className="opacity-70 text-[8px] sm:text-xs leading-none">{formatCurrency(basePrice)} x {item.quantity} =</span>
                          <span className="leading-none">{formatCurrency(basePrice * item.quantity)}</span>
                        </span>
                      )
                      : <span className="text-[8px] sm:text-sm leading-none opacity-60 font-medium">{formatCurrency(basePrice)}{item.type === 'futebol-sabao' ? ' p/ pes.' : ''}</span>}
                  </p>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                <QuantityStepper value={item.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
              </div>
            </div>
            
              <div className="mt-4 bg-destructive/5 border border-destructive/20 p-3 rounded-xl">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-destructive">\u26A0\uFE0F Observa\u00E7\u00E3o:</strong><br />
                  Taxa por molinete do cliente.<br />
                  Equipamentos por conta do cliente (n\u00E3o alugamos/vendemos).<br />
                  Permitido linha 0.50/0.60 sem filamento e anzol sem fisga.
                </p>
              </div>
            
              <div className="mt-4 bg-primary/5 border border-primary/20 p-3 rounded-xl">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-primary">M\u00E1ximo de 4 pessoas por partida.</span><br /><br />
                  <strong className="text-primary">\uD83D\uDCA1 Recomenda\u00E7\u00E3o:</strong><br />
                  Recomendado times de at\u00E9 2 pessoas para cada time.
                </p>
              </div>
          </div>
        );
      })}
    </div>
  );
}
