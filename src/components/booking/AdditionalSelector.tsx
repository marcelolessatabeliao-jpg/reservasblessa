import { useState, useEffect } from 'react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { AdditionalItem, ADDITIONAL_INFO, formatCurrency } from '@/lib/booking-types';
import { Fish, CircleDot, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useServices } from '@/hooks/useServices';
import { getGlobalSetting } from '@/lib/booking-service';

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
  const [disabledServices, setDisabledServices] = useState<Record<string, boolean>>({
    'futebol-sabao': false,
    'pesca': false
  });

  useEffect(() => {
    async function loadSettings() {
      const fsBlocked = await getGlobalSetting('disable_futebol_sabao', false);
      const pescaBlocked = await getGlobalSetting('disable_pesca', false);
      setDisabledServices({
        'futebol-sabao': !!fsBlocked,
        'pesca': !!pescaBlocked
      });
    }
    loadSettings();
  }, []);

  useEffect(() => {
    additionals.forEach((item, i) => {
      if (disabledServices[item.type] && item.quantity > 0) {
        onUpdate(i, { quantity: 0 });
      }
    });
  }, [disabledServices, additionals, onUpdate]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-emerald-600 h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-4">
      {additionals.map((item, i) => {
        const info = ADDITIONAL_INFO[item.type];
        const basePrice = getPrice(`add_${item.type}`, info.price);
        const Icon = ICONS[item.type] || Fish;
        const isDisabled = disabledServices[item.type];
        const isSelected = item.quantity > 0;

        return (
          <div 
            key={item.type} 
            className={`bg-white rounded-[2rem] border-2 p-5 sm:p-6 shadow-md transition-all duration-200 ${
              isSelected 
                ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-lg' 
                : 'border-emerald-200 hover:border-emerald-400'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shrink-0 transition-transform ${
                  isSelected ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>

                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-sans font-black text-sm sm:text-base text-emerald-950 uppercase tracking-tight whitespace-normal leading-tight">
                      {info.label}
                    </h4>
                    {isSelected && (
                      <Badge className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.2">
                        {item.quantity} Selecionado{item.quantity > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <p className="text-emerald-900 font-black text-sm sm:text-base flex items-baseline gap-1 mt-0.5">
                    {item.quantity >= 1 ? (
                      <span className="flex items-center gap-1.5 flex-nowrap">
                        <span className="text-muted-foreground text-xs font-medium">
                          {formatCurrency(basePrice)} x {item.quantity} =
                        </span>
                        <span className="text-amber-600 font-black text-base sm:text-lg">
                          {formatCurrency(basePrice * item.quantity)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-emerald-800 font-bold text-xs sm:text-sm">
                        {formatCurrency(basePrice)}{item.type === 'futebol-sabao' ? ' por pessoa' : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                {isDisabled ? (
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl uppercase tracking-wider">
                    Indisponível no momento
                  </span>
                ) : (
                  <div className="bg-emerald-50/80 p-2 rounded-2xl border border-emerald-200">
                    <QuantityStepper value={item.quantity} onChange={(q) => onUpdate(i, { quantity: q })} size="md" />
                  </div>
                )}
              </div>
            </div>
            
            {item.type === 'pesca' && (
              <div className="mt-4 bg-amber-50/80 border border-amber-200 p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs uppercase tracking-tight">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Regras da Pesca Esportiva:</span>
                </div>
                <ul className="text-xs text-amber-900/90 leading-relaxed space-y-1 list-disc list-inside font-medium pl-1">
                  <li>Taxa cobrada por cada vara do cliente (traga seu equipamento).</li>
                  <li>Permitido linha 0.50/0.60 sem filamento e anzol sem fisga.</li>
                  <li>Proibido o uso de iscas artificiais.</li>
                  <li>Peixes: Tambaqui, pirarara, pintado e tucunaré (pesque e solte).</li>
                </ul>
              </div>
            )}
            
            {item.type === 'futebol-sabao' && (
              <div className="mt-4 bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-950 font-black text-xs uppercase tracking-tight">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Informações da Quadra de Sabão:</span>
                </div>
                <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                  Partidas de pura diversão! Recomendado 2 pessoas adultas para cada time ou 3 crianças para cada equipe (máximo 4 a 6 pessoas por partida simultânea).
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
