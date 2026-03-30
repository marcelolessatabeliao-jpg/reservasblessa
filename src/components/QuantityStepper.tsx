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
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 shadow-sm shrink-0"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
      </Button>
      <span className="font-display font-black text-sm sm:text-lg w-6 sm:w-8 text-center tabular-nums">{value}</span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-emerald-600 border-2 border-emerald-700 text-white hover:bg-emerald-700 hover:border-emerald-800 shadow-sm shrink-0"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
      </Button>
    </div>
  );
}
