import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function QuantityStepper({ value, onChange, min = 0, max = 99, disabled = false }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-3 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 sm:h-10 sm:w-10 rounded-full border-primary/30 shrink-0"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
      <span className="font-display font-bold text-sm sm:text-lg w-5 sm:w-8 text-center tabular-nums">{value}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 sm:h-10 sm:w-10 rounded-full border-primary/30 shrink-0"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
    </div>
  );
}
