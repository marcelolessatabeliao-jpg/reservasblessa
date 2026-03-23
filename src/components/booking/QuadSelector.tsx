import { Bike, Tag, CalendarIcon, Loader2 } from 'lucide-react';
import { QuantityStepper } from '@/components/QuantityStepper';
import { QuadItem, QUAD_LABELS, QUAD_TIMES, getQuadDiscount, formatCurrency, QuadTime, isOperatingDay } from '@/lib/booking-types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';

interface Props {
  quads: QuadItem[];
  onUpdate: (index: number, updates: Partial<QuadItem>) => void;
}

export function QuadSelector({ quads, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary shrink-0">
          <Bike className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl">3. Passeio de Quadriciclo</h3>
      </div>
      
      <div className="bg-sun/10 border border-sun/20 p-3 sm:p-4 rounded-xl mb-4 shadow-sm">
        <p className="text-xs sm:text-sm text-sun-dark font-medium leading-relaxed">
          <strong className="font-black uppercase tracking-wider">⏱️ Duração: 1h30 de passeio</strong> com Desafios com pedras, lama, rio, barrancos, floresta, buracos, poças de água, piscina natural, batistério e uma incrível tirolesa!
        </p>
      </div>

      {quads.map((quad, i) => {
        // Dynamic price from DB, fallback to 150/250/200 if not yet loaded or missing
        const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
        const basePrice = getPrice(`quad_${quad.type}`, fallbackMap[quad.type] || 0);
        const discount = getQuadDiscount(quad.date);
        const finalPrice = basePrice * (1 - discount);

        return (
          <div key={quad.type} className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 p-4 sm:p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-sm sm:text-base">{QUAD_LABELS[quad.type]}</p>
                {quad.type === 'adulto-crianca' && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">(válido para crianças até 11 anos)</p>
                )}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {discount > 0 ? (
                    <>
                      <span className="text-muted-foreground line-through text-xs sm:text-sm">{formatCurrency(basePrice)}</span>
                      <span className="text-primary font-bold text-base sm:text-lg">
                        {quad.quantity > 1 ? `${formatCurrency(finalPrice)} x ${quad.quantity} = ${formatCurrency(finalPrice * quad.quantity)}` : formatCurrency(finalPrice)}
                      </span>
                      <span className="inline-flex items-center gap-0.5 bg-sun/20 text-foreground text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                        <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> -{discount * 100}%
                      </span>
                    </>
                  ) : (
                    <span className="text-primary font-bold text-base sm:text-lg">
                      {quad.quantity > 1 ? `${formatCurrency(basePrice)} x ${quad.quantity} = ${formatCurrency(basePrice * quad.quantity)}` : formatCurrency(basePrice)}
                    </span>
                  )}
                </div>
              </div>
              <QuantityStepper value={quad.quantity} onChange={(q) => onUpdate(i, { quantity: q })} />
            </div>

            {quad.quantity > 0 && (
              <div className="pt-3 border-t flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal flex-1 text-xs sm:text-sm", !quad.date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      {quad.date ? format(quad.date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={quad.date || undefined}
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

                <Select value={quad.time || ''} onValueChange={(v) => onUpdate(i, { time: v as QuadTime })}>
                  <SelectTrigger className="flex-1 text-xs sm:text-sm">
                    <SelectValue placeholder="Horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUAD_TIMES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs sm:text-sm space-y-1">
          <p className="font-medium text-primary">🏷️ Descontos:</p>
          <p className="text-muted-foreground">• Segundas e Sextas: <strong>20% de desconto</strong></p>
          <p className="text-muted-foreground">• Sábado e Domingo: <strong>10% de desconto</strong></p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-[10px] sm:text-xs flex flex-col justify-center">
          <p className="text-muted-foreground leading-relaxed">
            <strong className="text-destructive">⚠️ Obs:</strong> As entradas continuam sendo a parte.<br />
            Os valores são referente apenas às reservas dos quadriciclos.
          </p>
        </div>
      </div>
    </div>
  );
}
