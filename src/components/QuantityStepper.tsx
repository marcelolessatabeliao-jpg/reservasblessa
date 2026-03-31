import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantityStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  theme?: 'default' | 'dark';
  size?: 'sm' | 'default' | 'lg';
}

export function QuantityStepper({ value, onChange, min = 0, max = 99, disabled = false, theme = 'default', size = 'default' }: QuantityStepperProps) {
  const isDark = theme === 'dark';
  
  const dim = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-7 w-7 sm:h-9 sm:w-9';
  const iconDim = size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-3 w-3 sm:h-3.5 sm:w-3.5';
  const textDim = size === 'sm' ? 'text-xs w-3' : size === 'lg' ? 'text-lg sm:text-xl w-8 sm:w-10' : 'text-sm sm:text-base w-5 sm:w-7';

  return (
    <div className={`flex items-center gap-1 shrink-0 overflow-visible ${size === 'lg' ? 'sm:gap-3' : 'sm:gap-2'}`}>
      <Button
        variant="outline"
        className={`${dim} rounded-full border-2 shadow-sm shrink-0 transition-colors p-0 flex items-center justify-center ${
          isDark 
            ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' 
            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
        }`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Minus className={`${iconDim} stroke-[3]`} />
      </Button>
      
      <span className={`font-display font-black text-center tabular-nums ${textDim} ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}>
        {value}
      </span>
      
      <Button
        variant="outline"
        className={`${dim} rounded-full border-2 shadow-sm shrink-0 transition-colors p-0 flex items-center justify-center ${
          isDark
            ? 'bg-white border-white text-emerald-900 hover:bg-white/90'
            : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
        }`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <Plus className={`${iconDim} stroke-[3]`} />
      </Button>
    </div>
  );
}
