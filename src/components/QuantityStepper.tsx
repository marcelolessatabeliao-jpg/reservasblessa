import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  theme?: 'default' | 'dark';
}

export function QuantityStepper({ value, onChange, min = 0, max = 99, disabled = false, theme = 'default' }: QuantityStepperProps) {
  const isDark = theme === 'dark';
  
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 shadow-sm shrink-0 transition-colors ${
          isDark 
            ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' 
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
        }`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
      </Button>
      
      <span className={`font-display font-black text-sm sm:text-lg w-6 sm:w-8 text-center tabular-nums ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}>
        {value}
      </span>
      
      <Button
        variant="outline"
        size="icon"
        className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 shadow-sm shrink-0 transition-colors ${
          isDark
            ? 'bg-white border-white text-emerald-900 hover:bg-white/90'
            : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
        }`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
      </Button>
    </div>
  );
}
