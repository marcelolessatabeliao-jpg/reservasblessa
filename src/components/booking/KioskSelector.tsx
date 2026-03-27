import { Home, AlertTriangle, CalendarIcon, Loader2 } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { KioskItem, KIOSK_INFO, formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getKioskAvailability } from '@/lib/booking-service';
import { toast } from '@/hooks/use-toast';

interface Props {
  kiosks: KioskItem[];
  onUpdate: (index: number, updates: Partial<KioskItem>) => void;
}

export function KioskSelector({ kiosks, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary/10 text-secondary shrink-0">
          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl">2. Quiosques</h3>
      </div>

      {kiosks.map((kiosk, i) => {
        const info = KIOSK_INFO[kiosk.type];
        const basePrice = getPrice(`kiosk_${kiosk.type}`, info.price);
        
        return (
          <div key={kiosk.type} className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-sm sm:text-base">{info.label}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{info.capacity} - {info.available} {info.available === 1 ? 'unidade' : 'unidades'}</p>
                <p className="text-primary font-bold text-base sm:text-lg">
                  {kiosk.quantity > 1 
                    ? `${formatCurrency(basePrice)} x ${kiosk.quantity} = ${formatCurrency(basePrice * kiosk.quantity)}` 
                    : formatCurrency(basePrice)}
                </p>
              </div>
              <QuantityStepper value={kiosk.quantity} onChange={(q) => onUpdate(i, { quantity: q })} max={info.available} />
            </div>
            
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-3">
              Inclui: churrasqueira, pia, grelha, mesas e cadeiras
            </div>

            {kiosk.quantity > 0 && (
              <div className="pt-3 border-t">
                 <div className="flex items-center gap-2 bg-primary/5 px-4 h-12 rounded-2xl border border-primary/10 shadow-sm">
                   <CalendarIcon className="h-4 w-4 text-primary" />
                   <div>
                     <p className="text-[10px] font-black uppercase text-primary/60 tracking-wider leading-none mb-1">Data Sincronizada</p>
                     <p className="font-black text-sm text-primary uppercase leading-none">
                       {kiosk.date ? format(kiosk.date, "dd/MM/yyyy (EEE)", { locale: ptBR }) : "--/--/----"}
                     </p>
                   </div>
                 </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-2 bg-destructive/5 border border-destructive/20 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-bold text-foreground">
            Reservas de quiosque não possuem reembolso em caso de desistência.
          </p>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed pl-6 sm:pl-7">
          <strong>Observação:</strong> As reservas não incluem o valor das entradas, que continuam sendo pagas à parte na chegada.<br /> 
          Os valores acima referem-se exclusivamente à locação dos espaços.
        </p>
      </div>
    </div>
  );
}
