import React, { useState, useEffect } from 'react';
import { Home, AlertTriangle, CalendarIcon, Loader2, Check, Users, MapPin, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { KioskItem, KIOSK_INFO, formatCurrency, isOperatingDay } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getBookedKioskIds, getGlobalSetting } from '@/lib/booking-service';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KioskPhotoButton } from './KioskPhotoPopup';


interface Props {
  kiosks: KioskItem[];
  onUpdate: (index: number, updates: Partial<KioskItem>) => void;
}

// Physical kiosk definitions matching the real layout
const KIOSK_MAP = [
  { id: 1,  type: 'maior'    as const, label: 'Quiosque 01', capacity: 'Até 25 pessoas', row: 'bottom',   icon: '🏠' },
  { id: 2,  type: 'menor'    as const, label: 'Quiosque 02', capacity: 'Até 15 pessoas', row: 'top',      icon: '🏡' },
  { id: 3,  type: 'menor'    as const, label: 'Quiosque 03', capacity: 'Até 15 pessoas', row: 'top',      icon: '🏡' },
  { id: 4,  type: 'menor'    as const, label: 'Quiosque 04', capacity: 'Até 15 pessoas', row: 'top',      icon: '🏡' },
  { id: 5,  type: 'menor'    as const, label: 'Quiosque 05', capacity: 'Até 15 pessoas', row: 'top',      icon: '🏡' },
  { id: 6,  type: 'familiar' as const, label: 'Quiosque 06', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 7,  type: 'familiar' as const, label: 'Quiosque 07', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 8,  type: 'familiar' as const, label: 'Quiosque 08', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 9,  type: 'familiar' as const, label: 'Quiosque 09', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 10, type: 'familiar' as const, label: 'Quiosque 10', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 11, type: 'familiar' as const, label: 'Quiosque 11', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
  { id: 12, type: 'familiar' as const, label: 'Quiosque 12', capacity: 'Até 5 pessoas',  row: 'familiar', icon: '⛺' },
];

export function KioskSelector({ kiosks, onUpdate }: Props) {
  const { getPrice, isLoading } = useServices();
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [disableKiosks, setDisableKiosks] = useState(false);
  const [disabledKioskTypes, setDisabledKioskTypes] = useState<string[]>([]);
  const [disabledKioskIds, setDisabledKioskIds] = useState<number[]>([]);
  const [showKioskRules, setShowKioskRules] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const allKiosksBlocked = await getGlobalSetting('disable_kiosks', false);
      const blockedKioskTypes = await getGlobalSetting('disabled_kiosk_types', []);
      const blockedKioskIds = await getGlobalSetting('disabled_kiosk_ids', []);
      
      setDisableKiosks(!!allKiosksBlocked);
      if (Array.isArray(blockedKioskTypes)) setDisabledKioskTypes(blockedKioskTypes);
      if (Array.isArray(blockedKioskIds)) setDisabledKioskIds(blockedKioskIds.map(Number));
    }
    loadSettings();
  }, []);

  const checkDate = kiosks[0]?.date || kiosks.find(k => k.date)?.date;

  // Collect all currently selected IDs from all kiosk items (maior=0, menor=1, familiar=2)
  const allSelectedIds: number[] = [
    ...(kiosks[0]?.selectedIds || []),
    ...(kiosks[1]?.selectedIds || []),
    ...(kiosks[2]?.selectedIds || []),
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

    if (!checkDate) return;

    const channel = supabase.channel('kiosk-map-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_reservations' }, () => {
        fetchBooked();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchBooked();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkDate]);

  const handleToggleKiosk = (kioskDef: typeof KIOSK_MAP[0]) => {
    if (!checkDate) {
      toast({ title: 'Selecione a data primeiro', description: 'Escolha a data de visita na seção acima antes de selecionar os quiosques.', variant: 'destructive' });
      return;
    }

    const isDisabledByAdmin = disableKiosks || disabledKioskIds.includes(kioskDef.id) || disabledKioskTypes.includes(kioskDef.type);
    if (bookedIds.includes(kioskDef.id) || isDisabledByAdmin) {
      toast({ title: 'Quiosque Indisponível', description: `${kioskDef.label} está indisponível no momento.`, variant: 'destructive' });
      return;
    }

    // kiosk index: 0=maior, 1=menor, 2=familiar
    const kioskIndex = kioskDef.type === 'maior' ? 0 : kioskDef.type === 'menor' ? 1 : 2;
    const currentItem = kiosks[kioskIndex];
    const currentSelected = currentItem?.selectedIds || [];

    let newSelected: number[];
    if (currentSelected.includes(kioskDef.id)) {
      newSelected = currentSelected.filter(id => id !== kioskDef.id);
    } else {
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

  const maiorPrice    = getPrice('kiosk_maior',    KIOSK_INFO.maior.price);
  const menorPrice    = getPrice('kiosk_menor',    KIOSK_INFO.menor.price);
  const familiarPrice = getPrice('kiosk_familiar', KIOSK_INFO.familiar.price);

  const totalSelected = allSelectedIds.length;
  const totalPrice = allSelectedIds.reduce((sum, id) => {
    const def = KIOSK_MAP.find(k => k.id === id);
    if (!def) return sum;
    if (def.type === 'maior')    return sum + maiorPrice;
    if (def.type === 'menor')    return sum + menorPrice;
    return sum + familiarPrice;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-emerald-950 text-amber-400 border-2 border-amber-400 rounded-2xl shadow-sm shrink-0">
          <Home className="h-5 w-5" />
        </div>
        <h3 className="font-gliker text-xl sm:text-2xl text-emerald-950">
          Quiosques para churrasco e confraternização
        </h3>
      </div>

      {/* Map Container */}
      <div className="relative bg-white rounded-[2rem] border-2 border-emerald-300 p-4 sm:p-6 shadow-xl overflow-hidden space-y-4">

        {/* Map Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wider block">
                Posicionamento no Balneário
              </span>
              <span className="text-[10px] text-emerald-700/80 font-medium">
                Escolha o quiosque de sua preferência clicando no número
              </span>
            </div>
          </div>
          {isFetching && (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-[10px] font-black uppercase">Atualizando...</span>
            </div>
          )}
        </div>

        {/* Legend + Ver fotos dos quiosques entre a legenda e a data */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-600 shadow-xs" />
              <span className="text-[11px] font-black text-emerald-950 uppercase tracking-tight">Disponível</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-500 shadow-xs" />
              <span className="text-[11px] font-black text-slate-950 uppercase tracking-tight">Selecionado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-200 border border-rose-400" />
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-tight">Reservado</span>
            </div>
          </div>

          {/* Botão popup de fotos posicionado entre os status e a data */}
          <KioskPhotoButton className="px-3.5 py-1.5 text-xs bg-white border-2 border-emerald-500 text-emerald-950 font-black hover:bg-emerald-950 hover:text-amber-300 hover:border-emerald-950 shadow-xs" />

          {/* Date display */}
          {checkDate && (
            <div className="flex items-center gap-1.5 bg-emerald-950 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-400">
              <CalendarIcon className="h-3 w-3 text-amber-400" />
              <span>{format(checkDate, "dd/MM/yyyy (EEE)", { locale: ptBR })}</span>
            </div>
          )}
        </div>

        {/* ═══ KIOSK MAP LAYOUT ═══ */}
        <div className="space-y-3">
          {disableKiosks && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 p-4 rounded-2xl text-center">
              <span className="text-sm font-black text-red-700 uppercase">
                Todos os quiosques estão indisponíveis no momento para novas reservas
              </span>
            </div>
          )}

          {/* Top row: Quiosques 02-05 (médios) */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {KIOSK_MAP.filter(k => k.row === 'top').map(kioskDef => {
              const isDisabledByAdmin = disableKiosks || disabledKioskIds.includes(kioskDef.id) || disabledKioskTypes.includes(kioskDef.type);
              const isBooked = bookedIds.includes(kioskDef.id) || isDisabledByAdmin;
              const isSelected = allSelectedIds.includes(kioskDef.id);
              const price = menorPrice;

              return (
                <button
                  key={kioskDef.id}
                  onClick={() => handleToggleKiosk(kioskDef)}
                  disabled={isBooked && !isSelected}
                  className={cn(
                    "relative flex flex-col items-center justify-center p-2 sm:p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer group min-h-[108px] sm:min-h-[125px]",
                    isBooked && !isSelected && "bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed",
                    isSelected && "bg-amber-400 border-amber-500 text-slate-950 shadow-xl scale-[1.03] ring-2 ring-amber-400/30",
                    !isBooked && !isSelected && "bg-emerald-50/60 border-emerald-400/80 hover:border-amber-400 hover:bg-emerald-100/70 hover:scale-[1.02] shadow-sm text-emerald-950",
                  )}
                >
                  {/* Best Choice Badge for 02 and 05 */}
                  {(kioskDef.id === 2 || kioskDef.id === 5) && (
                    <div className={cn(
                      "absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-wider shadow-sm z-10 whitespace-nowrap border",
                      isSelected ? "bg-slate-950 text-amber-300 border-slate-950" : "bg-emerald-700 text-white border-emerald-500"
                    )}>
                      <span className="sm:hidden">🌟 Top</span>
                      <span className="hidden sm:inline">🌟 Melhor Escolha</span>
                    </div>
                  )}

                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-950 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 z-20">
                      <Check className="h-3.5 w-3.5 text-amber-400 stroke-[3]" />
                    </div>
                  )}

                  {isBooked && !isSelected && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 sm:px-2 py-0.5 bg-rose-100 border border-rose-300 rounded-full">
                      <span className="text-[7px] sm:text-[8px] font-black text-rose-700 uppercase">
                        {isDisabledByAdmin ? 'Indisp.' : 'Ocupado'}
                      </span>
                    </div>
                  )}

                  <span className={cn(
                    "text-2xl sm:text-3xl font-black transition-colors font-sans",
                    isSelected ? "text-slate-950" : isBooked ? "text-slate-400" : "text-emerald-950"
                  )}>
                    {String(kioskDef.id).padStart(2, '0')}
                  </span>

                  <div className={cn(
                    "flex items-center gap-0.5 sm:gap-1 mt-1",
                    isSelected ? "text-slate-900 font-bold" : isBooked ? "text-slate-400" : "text-emerald-800"
                  )}>
                    <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                    <span className="text-[8.5px] sm:text-[10px] font-bold whitespace-nowrap">{kioskDef.capacity}</span>
                  </div>

                  <span className={cn(
                    "text-[10px] sm:text-sm font-black mt-1 sm:mt-1.5 px-1.5 sm:px-2.5 py-0.5 rounded-full whitespace-nowrap",
                    isSelected ? "bg-slate-950 text-amber-400 font-black shadow-xs" : isBooked ? "text-slate-400" : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                  )}>
                    <span className="sm:hidden">{formatCurrency(price).replace(',00', '')}</span>
                    <span className="hidden sm:inline">{formatCurrency(price)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quiosque 01 (grande, separado) */}
          {KIOSK_MAP.filter(k => k.row === 'bottom').map(kioskDef => {
            const isDisabledByAdmin = disableKiosks || disabledKioskIds.includes(kioskDef.id) || disabledKioskTypes.includes(kioskDef.type);
            const isBooked = bookedIds.includes(kioskDef.id) || isDisabledByAdmin;
            const isSelected = allSelectedIds.includes(kioskDef.id);
            const price = maiorPrice;

            return (
              <button
                key={kioskDef.id}
                onClick={() => handleToggleKiosk(kioskDef)}
                disabled={isBooked && !isSelected}
                className={cn(
                  "relative w-full flex items-center justify-between gap-2 p-3 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group min-h-[85px] sm:min-h-[105px]",
                  isBooked && !isSelected && "bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed",
                  isSelected && "bg-amber-400 border-amber-500 text-slate-950 shadow-xl scale-[1.01] ring-2 ring-amber-400/30",
                  !isBooked && !isSelected && "bg-emerald-50/60 border-emerald-400/80 hover:border-amber-400 hover:bg-emerald-100/70 shadow-sm text-emerald-950",
                )}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-950 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 z-20">
                    <Check className="h-3.5 w-3.5 text-amber-400 stroke-[3]" />
                  </div>
                )}

                {isBooked && !isSelected && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-rose-100 border border-rose-300 rounded-full">
                    <span className="text-[8px] font-black text-rose-700 uppercase">
                      {isDisabledByAdmin ? 'Indisponível' : 'Ocupado'}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 text-left">
                  <span className={cn(
                    "text-2xl sm:text-4xl font-black transition-colors font-sans shrink-0",
                    isSelected ? "text-slate-950" : isBooked ? "text-slate-400" : "text-emerald-950"
                  )}>
                    {String(kioskDef.id).padStart(2, '0')}
                  </span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className={cn(
                      "text-[10.5px] sm:text-xs font-black uppercase tracking-tight sm:tracking-wider leading-tight",
                      isSelected ? "text-slate-950" : isBooked ? "text-slate-400" : "text-emerald-900"
                    )}>
                      Quiosque Grande — Estrutura Completa
                    </span>
                    <div className={cn(
                      "flex items-center gap-1 mt-0.5",
                      isSelected ? "text-slate-900 font-bold" : isBooked ? "text-slate-400" : "text-emerald-800"
                    )}>
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] sm:text-xs font-bold">{kioskDef.capacity}</span>
                    </div>
                  </div>
                </div>

                <span className={cn(
                  "text-sm sm:text-2xl font-black transition-colors px-2.5 sm:px-3 py-1 rounded-xl shrink-0 whitespace-nowrap",
                  isSelected ? "bg-slate-950 text-amber-400 font-black" : isBooked ? "text-slate-400" : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                )}>
                  {formatCurrency(price)}
                </span>
              </button>
            );
          })}

          {/* Quiosques Familiares: 06-12 */}
          <div className="pt-4 border-t border-emerald-200">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <span>⛺</span> Quiosques Familiares — Até 5 pessoas
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2.5 pb-1">
              {KIOSK_MAP.filter(k => k.row === 'familiar').map(kioskDef => {
                const isDisabledByAdmin = disableKiosks || disabledKioskIds.includes(kioskDef.id) || disabledKioskTypes.includes(kioskDef.type);
                const isBooked = bookedIds.includes(kioskDef.id) || isDisabledByAdmin;
                const isSelected = allSelectedIds.includes(kioskDef.id);
                const price = familiarPrice;

                return (
                  <button
                    key={kioskDef.id}
                    onClick={() => handleToggleKiosk(kioskDef)}
                    disabled={isBooked && !isSelected}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-2 sm:p-3.5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group",
                      "w-full min-h-[100px] sm:min-h-[115px]",
                      isBooked && !isSelected && "bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed",
                      isSelected && "bg-amber-400 border-amber-500 text-slate-950 shadow-xl scale-[1.03] ring-2 ring-amber-400/30",
                      !isBooked && !isSelected && "bg-emerald-50/60 border-emerald-400/80 hover:border-amber-400 hover:bg-emerald-100/70 text-emerald-950 shadow-sm",
                    )}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-950 rounded-full flex items-center justify-center shadow-md border-2 border-amber-400 z-20">
                        <Check className="h-3.5 w-3.5 text-amber-400 stroke-[3]" />
                      </div>
                    )}

                    {isBooked && !isSelected && (
                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-rose-100 border border-rose-300 rounded-full">
                        <span className="text-[7px] font-black text-rose-700 uppercase">
                          {isDisabledByAdmin ? 'Indisp.' : 'Ocupado'}
                        </span>
                      </div>
                    )}

                    <span className={cn(
                      "text-xl sm:text-3xl font-black transition-colors font-sans",
                      isSelected ? "text-slate-950" : isBooked ? "text-slate-400" : "text-emerald-950"
                    )}>
                      {String(kioskDef.id).padStart(2, '0')}
                    </span>

                    <div className={cn(
                      "flex items-center gap-0.5 sm:gap-1 mt-1",
                      isSelected ? "text-slate-900 font-bold" : isBooked ? "text-slate-400" : "text-emerald-800"
                    )}>
                      <Users className="h-2.5 w-2.5 shrink-0" />
                      <span className="text-[8px] sm:text-[9px] font-bold whitespace-nowrap">{kioskDef.capacity}</span>
                    </div>

                    <span className={cn(
                      "text-[10px] sm:text-sm font-black mt-1 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap",
                      isSelected ? "bg-slate-950 text-amber-400 font-black shadow-xs" : isBooked ? "text-slate-400" : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                    )}>
                      <span className="sm:hidden">{formatCurrency(price).replace(',00', '')}</span>
                      <span className="hidden sm:inline">{formatCurrency(price)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[9px] text-teal-700/60 font-medium italic">
              * Pia de uso comunitário disponível para os quiosques familiares. (pias próximas aos quiosques do 2 ao 5)
            </p>
          </div>
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
                {allSelectedIds.sort((a, b) => a - b).map(id => `Nº ${String(id).padStart(2, '0')}`).join(', ')}
              </span>
            </div>
            <span className="text-sm sm:text-base font-black text-emerald-900">
              {formatCurrency(totalPrice)}
            </span>
          </div>
        )}

        <p className="mt-3 text-[9px] text-emerald-800/50 font-medium italic text-center w-full">
          * O mapa dos quiosques representa fielmente o posicionamento físico dos mesmos no Balneário.
        </p>
      </div>

      {/* Aba Notável e Expansível: Regras, Condições, Avisos Importantes e O que inclui */}
      <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setShowKioskRules(prev => !prev)}
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900/80 text-white transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-sans font-black text-xs sm:text-sm uppercase tracking-wider text-amber-300">
                  ⚠️ Regras, Condições e O que inclui nos Quiosques
                </span>
                <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  Importante • Leia antes de reservar
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 font-bold mt-0.5">
                Veja itens inclusos (churrasqueira, grelha, mesas) e avisos sobre bebidas, alimentos e regras de reserva.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center justify-center gap-1.5 bg-amber-400 text-slate-950 font-black text-[11px] uppercase px-3.5 py-2 rounded-xl shrink-0 self-end sm:self-center shadow-xs">
            {showKioskRules ? 'Fechar Informações' : 'Ver Regras e O que Inclui'}
            {showKioskRules ? <ChevronUp className="w-4 h-4 stroke-[3]" /> : <ChevronDown className="w-4 h-4 stroke-[3]" />}
          </span>
        </button>

        {showKioskRules && (
          <div className="p-3 sm:p-4 bg-white rounded-xl mt-1 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-2 bg-emerald-50/80 border-2 border-emerald-200 p-3.5 sm:p-4 rounded-xl shadow-xs text-emerald-900 text-xs sm:text-sm">
              <h4 className="font-black text-emerald-950 flex items-center gap-2 uppercase tracking-wide text-xs sm:text-sm">
                <Sparkles className="h-4 w-4 text-emerald-700" /> O que inclui em cada Quiosque?
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 font-medium">
                <li><strong>Quiosque 01 (Grande):</strong> Capacidade para 25 pessoas, separado dos demais. Churrasqueira, pia, grelha, mesas e cadeiras, 1 tomada.</li>
                <li><strong>Quiosques 02 ao 05 (Médios):</strong> Capacidade para até 15 pessoas, um ao lado do outro. Churrasqueira, pia, grelha, mesas e cadeiras, 1 tomada.</li>
                <li><strong>Quiosques 06 ao 12 (Familiares):</strong> Tamanho familiar para até 5 pessoas. Churrasqueira, grelha, 1 mesa e bancos. Pia comunitária próxima aos quiosques.</li>
                <li className="text-red-600 font-black"><strong>Carvão:</strong> Por conta do cliente.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 sm:p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm font-black text-red-900 uppercase tracking-tight">
                  Aviso Importante: Reservas de quiosque não possuem reembolso em caso de desistência.
                </p>
              </div>
              <div className="text-xs text-slate-800 leading-relaxed pl-7 space-y-2">
                <p className="font-bold">
                  <strong>Observação:</strong> As reservas de quiosque não incluem o valor das entradas no balneário, que são adicionadas separadamente. Os valores acima referem-se exclusivamente à locação dos espaços.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-emerald-100/80 rounded-xl border border-emerald-300 text-emerald-950 font-black flex items-center gap-2 text-xs">
                    <Check className="h-4 w-4 text-emerald-700 stroke-[3] shrink-0" />
                    <span>É permitido levar todo tipo de alimento.</span>
                  </div>
                  <div className="p-2.5 bg-red-100/80 rounded-xl border border-red-300 text-red-950 font-black flex items-center gap-2 text-xs">
                    <X className="h-4 w-4 text-red-700 stroke-[3] shrink-0" />
                    <span>Proibido levar quaisquer tipos de bebidas (adquiridas apenas no local).</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
