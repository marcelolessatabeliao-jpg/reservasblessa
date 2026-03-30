import React, { useState, useEffect } from 'react';
import { Home, AlertTriangle, CalendarIcon, Loader2, Check, Users, MapPin, X } from 'lucide-react';
import { KioskItem, KIOSK_INFO, formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getBookedKioskIds } from '@/lib/booking-service';
import { toast } from '@/hooks/use-toast';

interface Props {
  kiosks: KioskItem[];
  onUpdate: (index: number, updates: Partial<KioskItem>) => void;
}

// Physical kiosk definitions matching the real layout
const KIOSK_MAP = [
  { id: 1, type: 'maior' as const, label: 'Quiosque 01', capacity: '20 a 25 pessoas', row: 'bottom', icon: '🏠' },
  { id: 2, type: 'menor' as const, label: 'Quiosque 02', capacity: 'Até 15 pessoas', row: 'top', icon: '🏡' },
  { id: 3, type: 'menor' as const, label: 'Quiosque 03', capacity: 'Até 15 pessoas', row: 'top', icon: '🏡' },
  { id: 4, type: 'menor' as const, label: 'Quiosque 04', capacity: 'Até 15 pessoas', row: 'top', icon: '🏡' },
  { id: 5, type: 'menor' as const, label: 'Quiosque 05', capacity: 'Até 15 pessoas', row: 'top', icon: '🏡' },
];

export function KioskSelector({ kiosks, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const checkDate = kiosks[0]?.date;

  // Collect all currently selected IDs from both kiosk items
  const allSelectedIds: number[] = [
    ...(kiosks[0]?.selectedIds || []),
    ...(kiosks[1]?.selectedIds || []),
  ];

  useEffect(() => {
    async function fetchBooked() {
      if (!checkDate) return;
      setIsFetching(true);
      try {
        const ids = await getBookedKioskIds(format(checkDate, 'yyyy-MM-dd'));
        setBookedIds(ids);
      } catch (err) {
        console.error("Error fetching booked kiosks:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchBooked();
  }, [checkDate]);

  const handleToggleKiosk = (kioskDef: typeof KIOSK_MAP[0]) => {
    if (!checkDate) {
      toast({ title: 'Selecione a data primeiro', description: 'Escolha a data de visita na seção acima antes de selecionar os quiosques.', variant: 'destructive' });
      return;
    }
    
    if (bookedIds.includes(kioskDef.id)) {
      toast({ title: 'Quiosque Indisponível', description: `${kioskDef.label} já está reservado para esta data.`, variant: 'destructive' });
      return;
    }

    // Find the kiosk array index: 0=menor, 1=maior
    const kioskIndex = kioskDef.type === 'menor' ? 0 : 1;
    const currentItem = kiosks[kioskIndex];
    const currentSelected = currentItem.selectedIds || [];

    let newSelected: number[];
    if (currentSelected.includes(kioskDef.id)) {
      // Deselect
      newSelected = currentSelected.filter(id => id !== kioskDef.id);
    } else {
      // Select
      newSelected = [...currentSelected, kioskDef.id];
    }

    onUpdate(kioskIndex, { 
      quantity: newSelected.length, 
      selectedIds: newSelected 
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-6"><Loader2 className="animate-spin text-primary h-6 w-6" /></div>;
  }

  const menorPrice = getPrice('kiosk_menor', KIOSK_INFO.menor.price);
  const maiorPrice = getPrice('kiosk_maior', KIOSK_INFO.maior.price);

  const totalSelected = allSelectedIds.length;
  const totalPrice = allSelectedIds.reduce((sum, id) => {
    const def = KIOSK_MAP.find(k => k.id === id);
    return sum + (def?.type === 'maior' ? maiorPrice : menorPrice);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary/10 text-secondary shrink-0">
          <Home className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <h3 className="font-sans font-bold text-lg sm:text-xl">2. Quiosques</h3>
      </div>

      {/* Map Container */}
      <div className="relative bg-gradient-to-b from-emerald-100/90 via-green-100/50 to-emerald-100/70 backdrop-blur-md rounded-3xl border-2 border-emerald-600/40 p-4 sm:p-6 shadow-lg overflow-hidden">
        
        {/* Map Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] sm:text-xs font-black text-emerald-800/70 uppercase tracking-widest">
              Mapa dos Quiosques
            </span>
          </div>
          {isFetching && (
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px] font-bold">Verificando...</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-500" />
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800">Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-600 border border-emerald-700" />
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-800">Selecionado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300" />
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-600">Reservado</span>
          </div>
        </div>

        {/* Date display */}
        {checkDate && (
          <div className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-full border border-emerald-400 w-fit mb-4">
            <CalendarIcon className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] sm:text-xs font-bold text-emerald-800 uppercase">
              {format(checkDate, "dd/MM/yyyy (EEE)", { locale: ptBR })}
            </span>
          </div>
        )}

        {/* ═══ KIOSK MAP LAYOUT ═══ */}
        <div className="space-y-3">
          
          {/* Top row: Kiosks 02-05 (menor) */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {KIOSK_MAP.filter(k => k.row === 'top').map(kioskDef => {
              const isBooked = bookedIds.includes(kioskDef.id);
              const isSelected = allSelectedIds.includes(kioskDef.id);
              const price = menorPrice;

              return (
                <button
                  key={kioskDef.id}
                  onClick={() => handleToggleKiosk(kioskDef)}
                  disabled={isBooked && !isSelected}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
                    "min-h-[100px] sm:min-h-[120px]",
                    isBooked && !isSelected && "bg-gray-100 border-gray-400 opacity-60 cursor-not-allowed",
                    isSelected && "bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-600/40 scale-[1.02]",
                    !isBooked && !isSelected && "bg-white/90 border-emerald-500/50 hover:border-emerald-600 hover:bg-emerald-50 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]",
                  )}
                >
                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-emerald-700">
                      <Check className="h-3.5 w-3.5 text-emerald-700 stroke-[3]" />
                    </div>
                  )}
                  
                  {/* Booked badge */}
                  {isBooked && !isSelected && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-100 rounded-full">
                      <span className="text-[8px] font-black text-red-500 uppercase">Reservado</span>
                    </div>
                  )}

                  {/* Kiosk number */}
                  <span className={cn(
                    "text-2xl sm:text-3xl font-black transition-colors",
                    isSelected ? "text-white" : isBooked ? "text-gray-400" : "text-emerald-700"
                  )}>
                    {String(kioskDef.id).padStart(2, '0')}
                  </span>

                  {/* Capacity */}
                  <div className={cn(
                    "flex items-center gap-1 mt-1",
                    isSelected ? "text-emerald-50" : isBooked ? "text-gray-400" : "text-emerald-600/70"
                  )}>
                    <Users className="h-2.5 w-2.5" />
                    <span className="text-[8px] sm:text-[9px] font-bold">{kioskDef.capacity}</span>
                  </div>

                  {/* Price */}
                  <span className={cn(
                    "text-xs sm:text-sm font-black mt-1 transition-colors",
                    isSelected ? "text-white" : isBooked ? "text-gray-400" : "text-emerald-800"
                  )}>
                    {formatCurrency(price)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom: Kiosk 01 (maior) */}
          {KIOSK_MAP.filter(k => k.row === 'bottom').map(kioskDef => {
            const isBooked = bookedIds.includes(kioskDef.id);
            const isSelected = allSelectedIds.includes(kioskDef.id);
            const price = maiorPrice;

            return (
              <button
                key={kioskDef.id}
                onClick={() => handleToggleKiosk(kioskDef)}
                disabled={isBooked && !isSelected}
                className={cn(
                  "relative w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
                  "min-h-[80px] sm:min-h-[100px]",
                  isBooked && !isSelected && "bg-gray-100 border-gray-400 opacity-60 cursor-not-allowed",
                  isSelected && "bg-emerald-600 border-emerald-700 text-white shadow-lg shadow-emerald-600/40 scale-[1.01]",
                  !isBooked && !isSelected && "bg-white/90 border-emerald-500/50 hover:border-emerald-600 hover:bg-emerald-50 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                )}
              >
                {/* Selected check */}
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-emerald-700">
                    <Check className="h-3.5 w-3.5 text-emerald-700 stroke-[3]" />
                  </div>
                )}

                {/* Booked badge */}
                {isBooked && !isSelected && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-100 rounded-full">
                    <span className="text-[8px] font-black text-red-500 uppercase">Reservado</span>
                  </div>
                )}

                {/* Left side: number + label */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className={cn(
                    "text-3xl sm:text-4xl font-black transition-colors",
                    isSelected ? "text-white" : isBooked ? "text-gray-400" : "text-emerald-700"
                  )}>
                    {String(kioskDef.id).padStart(2, '0')}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className={cn(
                      "text-[10px] sm:text-xs font-black uppercase tracking-wider",
                      isSelected ? "text-emerald-100" : isBooked ? "text-gray-400" : "text-emerald-500"
                    )}>
                      Quiosque Maior
                    </span>
                    <div className={cn(
                      "flex items-center gap-1",
                      isSelected ? "text-emerald-50" : isBooked ? "text-gray-400" : "text-emerald-600/70"
                    )}>
                      <Users className="h-3 w-3" />
                      <span className="text-[10px] sm:text-xs font-bold">{kioskDef.capacity}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: price */}
                <span className={cn(
                  "text-lg sm:text-xl font-black transition-colors",
                  isSelected ? "text-white" : isBooked ? "text-gray-400" : "text-emerald-800"
                )}>
                  {formatCurrency(price)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selection summary */}
        {totalSelected > 0 && (
          <div className="mt-4 flex items-center justify-between bg-emerald-700/15 border border-emerald-600/40 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-xs sm:text-sm font-bold text-emerald-800">
                {totalSelected} quiosque{totalSelected > 1 ? 's' : ''} selecionado{totalSelected > 1 ? 's' : ''}:
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-900">
                {allSelectedIds.sort((a,b) => a-b).map(id => `Nº ${String(id).padStart(2,'0')}`).join(', ')}
              </span>
            </div>
            <span className="text-sm sm:text-base font-black text-emerald-900">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        )}
      </div>

      {/* Included items info & Rules */}
      <div className="flex flex-col gap-3">
        {/* Positive Include Row */}
        <div className="flex items-center flex-wrap gap-2 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl shadow-sm">
          <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0">
            <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-emerald-800">
            Inclui: <span className="font-medium text-emerald-700">churrasqueira, pia, grelha, mesas e cadeiras</span>
          </p>
        </div>

        {/* Warning notice & Additional Info */}
        <div className="flex flex-col gap-2 bg-destructive/5 border border-destructive/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm font-bold text-foreground">
              Reservas de quiosque não possuem reembolso em caso de desistência.
            </p>
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed pl-6 sm:pl-7 space-y-2 mt-1">
            <p>
              <strong>Observação:</strong> As reservas não incluem o valor das entradas, que continuam sendo pagas à parte na chegada. Os valores acima referem-se exclusivamente à locação dos espaços.
            </p>
            <div className="flex flex-col gap-1 mt-2 p-2 bg-white/50 rounded-lg border border-slate-100">
              <p className="text-emerald-700 font-bold flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 stroke-[3]" /> É permitido levar todo tipo de alimento.
              </p>
              <p className="text-destructive font-bold flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 stroke-[3]" /> Proibido levar quaisquer tipos de bebidas, apenas sendo adquiridas no local.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
