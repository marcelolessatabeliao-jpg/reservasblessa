import { QuantityStepper } from '@/components/QuantityStepper';
import { AdditionalItem, ADDITIONAL_INFO, formatCurrency } from '@/lib/booking-types';
import { Fish, CircleDot } from 'lucide-react';

const ICONS: Record<string, typeof Fish> = {
  'pesca': Fish,
  'futebol-sabao': CircleDot,
};

interface Props {
  additionals: AdditionalItem[];
  onUpdate: (index: number, updates: Partial<AdditionalItem>) => void;
}

export function AdditionalSelector({ additionals, onUpdate }: Props) {
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
        const Icon = ICONS[item.type] || Fish;
        return (
          <div key={item.type} className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sun/10 text-sun shrink-0">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm sm:text-base">{info.label}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{info.description}</p>
                  <p className="text-primary font-bold text-base sm:text-lg">
                    {item.quantity >= 1 
                      ? `${formatCurrency(info.price)} x ${item.quantity} = ${formatCurrency(info.price * item.quantity)}` 
                      : `${formatCurrency(info.price)}${item.type === 'futebol-sabao' ? ' por pessoa' : ''}`}
                  </p>
                </div>
              </div>
              <QuantityStepper value={item.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
            </div>
            
            {item.type === 'pesca' && (
              <div className="mt-4 bg-destructive/5 border border-destructive/20 p-3 rounded-xl">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-destructive">⚠️ Observação:</strong><br />
                  Taxa por molinete do cliente.<br />
                  Equipamentos por conta do cliente (não alugamos/vendemos).<br />
                  Permitido linha 0.50/0.60 sem filamento e anzol sem fisga.
                </p>
              </div>
            )}
            
            {item.type === 'futebol-sabao' && (
              <div className="mt-4 bg-primary/5 border border-primary/20 p-3 rounded-xl">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-primary">Mínimo de 6 pessoas por partida.</span><br /><br />
                  <strong className="text-primary">💡 Recomendação:</strong><br />
                  Recomendado times de até 8 pessoas para cada time.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
