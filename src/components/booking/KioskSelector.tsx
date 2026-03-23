import { Home, AlertTriangle, CalendarIcon } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { KioskItem, KIOSK_INFO, formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  kiosks: KioskItem[];
  onUpdate: (index: number, updates: Partial<KioskItem>) => void;
}

export function KioskSelector({ kiosks, onUpdate }: Props) {
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
        return (
          <div key={kiosk.type} className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-sm sm:text-base">{info.label}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{info.capacity} - {info.available} {info.available === 1 ? 'unidade' : 'unidades'}</p>
                <p className="text-primary font-bold text-base sm:text-lg">
                  {kiosk.quantity > 1 
                    ? `${formatCurrency(info.price)} x ${kiosk.quantity} = ${formatCurrency(info.price * kiosk.quantity)}` 
                    : formatCurrency(info.price)}
                </p>
              </div>
              <QuantityStepper value={kiosk.quantity} onChange={(q) => onUpdate(i, { quantity: q })} max={info.available} />
            </div>
            
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-3">
              Inclui: churrasqueira, pia, grelha, mesas e cadeiras
            </div>

            {kiosk.quantity > 0 && (
              <div className="pt-3 border-t">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs sm:text-sm", !kiosk.date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      {kiosk.date ? format(kiosk.date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data da reserva"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={kiosk.date || undefined}
                      onSelect={(d) => onUpdate(i, { date: d || null })}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return d < today || !isOperatingDay(d);
                      }}
                      className="p-3 pointer-events-auto"
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
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
