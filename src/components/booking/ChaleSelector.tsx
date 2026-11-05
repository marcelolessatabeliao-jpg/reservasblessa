import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, 
  Coffee, 
  Clock, 
  Users, 
  Sparkles, 
  Calendar, 
  Lock, 
  Flame, 
  CalendarDays,
  CheckCircle2,
  Plus,
  Minus,
  RefreshCw,
  Sun,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { 
  ChaleBooking, 
  ChalePackageType, 
  CHALE_PACKAGES, 
  CHALE_RULES, 
  CHALE_UNITS,
  calculateChaleTotal,
  formatCurrency,
  isOperatingDay,
  isHolidayDate,
  isChaleCheckInDay,
  isChaleCheckOutDay,
  calculateStayPricing
} from '@/lib/booking-types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useServices } from '@/hooks/useServices';
import { getBookedChaleIds } from '@/lib/booking-service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  chale: ChaleBooking;
  onUpdate: (updates: Partial<ChaleBooking>) => void;
  visitDate?: Date | null;
  onUpdateVisitDate?: (date: Date | null) => void;
  disabledChaleIds?: number[];
}

interface ChaleReservationDetail {
  chaleId: number;
  checkIn: string; // 'yyyy-MM-dd'
  checkOut: string; // 'yyyy-MM-dd'
}

export function ChaleSelector({ 
  chale, 
  onUpdate, 
  visitDate, 
  onUpdateVisitDate,
  disabledChaleIds = [] 
}: Props) {
  const { getPrice } = useServices();
  const [selectedChaleUnit, setSelectedChaleUnit] = useState<number | null>(chale.chaleId || null);
  const [bookedChaleIds, setBookedChaleIds] = useState<number[]>([]);
  const [existingReservations, setExistingReservations] = useState<ChaleReservationDetail[]>([]);
  const [isLoadingBooked, setIsLoadingBooked] = useState<boolean>(false);
  const [isCheckInCalendarOpen, setIsCheckInCalendarOpen] = useState<boolean>(false);
  const [isCheckOutCalendarOpen, setIsCheckOutCalendarOpen] = useState<boolean>(false);

  // Data âncora inicial
  const anchorDate = useMemo(() => {
    return chale.checkInDate || visitDate || new Date();
  }, [chale.checkInDate, visitDate]);

  // Cálculo de quinta, sexta, sábado, domingo e segunda de referência
  const { refThursday, refFriday, refSaturday, refSunday, refMonday } = useMemo(() => {
    const anchor = new Date(anchorDate);
    const day = anchor.getDay(); // 0 Dom, 1 Seg, 2 Ter, 3 Qua, 4 Qui, 5 Sex, 6 Sáb
    let thursday = new Date(anchor);
    if (day === 4) {
      // já é quinta
    } else if (day === 5) {
      thursday = addDays(anchor, -1);
    } else if (day === 6) {
      thursday = addDays(anchor, -2);
    } else if (day === 0) {
      thursday = addDays(anchor, -3);
    } else if (day === 1) {
      thursday = addDays(anchor, -4);
    } else {
      const diff = (4 - day + 7) % 7;
      thursday = addDays(anchor, diff);
    }
    thursday.setHours(9, 0, 0, 0);

    const friday = addDays(thursday, 1);
    friday.setHours(14, 0, 0, 0);

    const saturday = addDays(thursday, 2);
    saturday.setHours(14, 0, 0, 0);

    const sunday = addDays(thursday, 3);
    sunday.setHours(12, 0, 0, 0);

    const monday = addDays(thursday, 4);
    monday.setHours(12, 0, 0, 0);

    return { 
      refThursday: thursday, 
      refFriday: friday, 
      refSaturday: saturday, 
      refSunday: sunday,
      refMonday: monday
    };
  }, [anchorDate]);

  // Garantir pacote padrão se ainda não definido
  useEffect(() => {
    if (!chale.packageType || !chale.checkInDate) {
      onUpdate({
        packageType: 'combo-2n-sex-dom',
        checkInDate: refFriday,
        checkOutDate: refSunday,
        includeSundayDayUse: true,
        adultsCount: 2,
        childrenCount: 0
      });
    }
  }, [chale.packageType, refFriday, refSunday]);

  // Datas ativas
  const checkInActive = useMemo(() => {
    if (chale.checkInDate) return new Date(chale.checkInDate);
    return refFriday;
  }, [chale.checkInDate, refFriday]);

  const checkOutActive = useMemo(() => {
    if (chale.checkOutDate) return new Date(chale.checkOutDate);
    return refSunday;
  }, [chale.checkOutDate, refSunday]);

  const formattedDate = format(checkInActive, 'yyyy-MM-dd');

  // Buscar chalés ocupados
  useEffect(() => {
    async function loadAvailability() {
      setIsLoadingBooked(true);
      try {
        const ids = await getBookedChaleIds(formattedDate);
        setBookedChaleIds(ids);

        const { data } = await supabase
          .from('orders')
          .select('id, visit_date, order_items(product_id, metadata), status')
          .neq('status', 'cancelled');

        const list: ChaleReservationDetail[] = [];
        if (data) {
          data.forEach((order: any) => {
            const items = order.order_items || [];
            const orderDate = order.visit_date;
            items.forEach((item: any) => {
              const pid = (item.product_id || '').toLowerCase();
              if (pid.includes('chale') || pid.includes('chalé')) {
                const cId = Number(item.metadata?.chale_id);
                const cIn = item.metadata?.check_in_date || orderDate;
                const cOut = item.metadata?.check_out_date || cIn;
                if (!isNaN(cId) && cId > 0 && cIn) {
                  list.push({ chaleId: cId, checkIn: cIn, checkOut: cOut });
                }
              }
            });
          });
        }
        setExistingReservations(list);
      } catch (err) {
        console.error('Erro ao carregar disponibilidade dos chalés:', err);
      } finally {
        setIsLoadingBooked(false);
      }
    }

    loadAvailability();

    const channel = supabase.channel('chale-map-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadAvailability();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadAvailability();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [formattedDate]);

  // Lista de chalés selecionados (suporte a múltiplos chalés na mesma reserva)
  const selectedChaleUnits: number[] = useMemo(() => {
    if (chale.chaleIds && Array.isArray(chale.chaleIds) && chale.chaleIds.length > 0) {
      return chale.chaleIds;
    }
    if (chale.chaleId) {
      return [chale.chaleId];
    }
    return [1];
  }, [chale.chaleIds, chale.chaleId]);

  const chaletsCount = selectedChaleUnits.length;

  // Mapa de ocupação por chalé ('casal' = 2 adultos, 'individual' = 1 adulto)
  const chaleOccupancies: Record<number, 'casal' | 'individual'> = useMemo(() => {
    const map: Record<number, 'casal' | 'individual'> = {};
    const existing = chale.chaleOccupancies || {};
    selectedChaleUnits.forEach(id => {
      map[id] = existing[id] || 'casal';
    });
    return map;
  }, [chale.chaleOccupancies, selectedChaleUnits]);

  // Contagem total de adultos com base na escolha individual de cada chalé
  const currentAdults = useMemo(() => {
    return selectedChaleUnits.reduce((acc, id) => {
      return acc + (chaleOccupancies[id] === 'individual' ? 1 : 2);
    }, 0);
  }, [selectedChaleUnits, chaleOccupancies]);

  // Alternar ocupação de um chalé específico
  const handleToggleChaleMode = (chaleId: number, mode: 'casal' | 'individual') => {
    const nextMap = { ...chaleOccupancies, [chaleId]: mode };
    const nextAdults = selectedChaleUnits.reduce((acc, id) => acc + (nextMap[id] === 'individual' ? 1 : 2), 0);
    const curNames = chale.guestNames || [];
    const names = Array.from({ length: nextAdults + (chale.childrenCount || 0) }, (_, idx) => curNames[idx] || '');
    onUpdate({
      chaleOccupancies: nextMap,
      adultsCount: nextAdults,
      guestNames: names
    });
  };

  // Cálculo da estadia e regras em tempo real
  const stayPricing = useMemo(() => {
    return calculateStayPricing(checkInActive, checkOutActive);
  }, [checkInActive, checkOutActive]);

  // Calcula a data máxima de saída (segunda-feira subsequente da mesma estadia)
  const maxWeekendOutDate = useMemo(() => {
    const inDate = new Date(checkInActive);
    inDate.setHours(0, 0, 0, 0);
    const day = inDate.getDay(); // 4=Qui, 5=Sex, 6=Sáb, 0=Dom
    let daysToMonday = 1;
    if (day === 4) daysToMonday = 4;
    else if (day === 5) daysToMonday = 3;
    else if (day === 6) daysToMonday = 2;
    else if (day === 0) daysToMonday = 1;

    const monday = addDays(inDate, daysToMonday);
    monday.setHours(23, 59, 59, 999);
    
    // Se terça seguinte for feriado, permite até terça
    const tuesday = addDays(monday, 1);
    tuesday.setHours(23, 59, 59, 999);
    if (isHolidayDate(tuesday)) {
      return tuesday;
    }
    return monday;
  }, [checkInActive]);

  // Alterar data de entrada via calendário
  const handleSelectCheckInDate = (newInDate: Date) => {
    const day = newInDate.getDay();
    newInDate.setHours(day === 4 ? 9 : 14, 0, 0, 0);

    let defaultPkg: ChalePackageType = 'combo-2n-sex-dom';
    let outDate = addDays(newInDate, 1);
    outDate.setHours(12, 0, 0, 0);

    if (day === 5) {
      defaultPkg = 'combo-2n-sex-dom';
      outDate = addDays(newInDate, 2);
      outDate.setHours(12, 0, 0, 0);
    } else if (day === 4) {
      defaultPkg = 'combo-3n-qui-dom';
      outDate = addDays(newInDate, 3);
      outDate.setHours(12, 0, 0, 0);
    } else if (day === 6) {
      defaultPkg = 'diaria-sab-dom';
      outDate = addDays(newInDate, 1);
      outDate.setHours(12, 0, 0, 0);
    } else if (day === 0) {
      defaultPkg = 'diaria-dom-seg';
      outDate = addDays(newInDate, 1);
      outDate.setHours(12, 0, 0, 0);
    }

    onUpdate({
      packageType: defaultPkg,
      checkInDate: newInDate,
      checkOutDate: outDate,
      includeSundayDayUse: true
    });

    if (onUpdateVisitDate) {
      onUpdateVisitDate(newInDate);
    }
    setIsCheckInCalendarOpen(false);
  };

  // Alterar data de saída via calendário
  const handleSelectCheckOutDate = (newOutDate: Date) => {
    newOutDate.setHours(12, 0, 0, 0);
    const inDate = checkInActive;
    
    if (newOutDate <= inDate) {
      newOutDate = addDays(inDate, 1);
      newOutDate.setHours(12, 0, 0, 0);
    }

    const inDay = inDate.getDay();
    const outDay = newOutDate.getDay();
    const diffNights = Math.round(Math.abs(newOutDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));

    let pkgType: ChalePackageType = '1-diaria';
    if (inDay === 5 && outDay === 0 && diffNights === 2) {
      pkgType = 'combo-2n-sex-dom';
    } else if (inDay === 4 && outDay === 0 && diffNights === 3) {
      pkgType = 'combo-3n-qui-dom';
    } else if (inDay === 5 && outDay === 1 && diffNights === 3) {
      pkgType = 'combo-3n-sex-seg';
    } else if (inDay === 4 && outDay === 1 && diffNights === 4) {
      pkgType = 'combo-4n-qui-seg';
    } else if (inDay === 5 && outDay === 6) {
      pkgType = 'diaria-sex-sab';
    } else if (inDay === 6 && outDay === 0) {
      pkgType = 'diaria-sab-dom';
    } else if (inDay === 4 && outDay === 5) {
      pkgType = 'diaria-qui-sex';
    } else if (inDay === 0 && outDay === 1) {
      pkgType = 'diaria-dom-seg';
    } else if (diffNights >= 2) {
      pkgType = 'combo-2n-sex-dom';
    }

    onUpdate({
      packageType: pkgType,
      checkOutDate: newOutDate,
      includeSundayDayUse: true
    });
    setIsCheckOutCalendarOpen(false);
  };

  // Atalhos Rápidos com seleção direta dos 4 Combos e Diárias
  const handleSelectStayPreset = (preset: 
    | 'combo-2n-sex-dom' 
    | 'combo-3n-qui-dom' 
    | 'combo-3n-sex-seg' 
    | 'combo-4n-qui-seg' 
    | 'diaria-sex-sab' 
    | 'diaria-sab-dom'
  ) => {
    let inDate = new Date(refFriday);
    let outDate = new Date(refSunday);
    let pkgType: ChalePackageType = 'combo-2n-sex-dom';

    if (preset === 'combo-2n-sex-dom') {
      inDate = new Date(refFriday);
      inDate.setHours(14, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-2n-sex-dom';
    } else if (preset === 'combo-3n-qui-dom') {
      inDate = new Date(refThursday);
      inDate.setHours(9, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-3n-qui-dom';
    } else if (preset === 'combo-3n-sex-seg') {
      inDate = new Date(refFriday);
      inDate.setHours(14, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-3n-sex-seg';
    } else if (preset === 'combo-4n-qui-seg') {
      inDate = new Date(refThursday);
      inDate.setHours(9, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-4n-qui-seg';
    } else if (preset === 'diaria-sex-sab') {
      inDate = new Date(refFriday);
      inDate.setHours(14, 0, 0, 0);
      outDate = new Date(refSaturday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-sex-sab';
    } else if (preset === 'diaria-sab-dom') {
      inDate = new Date(refSaturday);
      inDate.setHours(14, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-sab-dom';
    }

    onUpdate({
      packageType: pkgType,
      checkInDate: inDate,
      checkOutDate: outDate,
      includeSundayDayUse: true
    });
    if (onUpdateVisitDate) onUpdateVisitDate(inDate);
  };

  // Toggle de seleção de múltiplos chalés
  const handleToggleUnitSelection = (unitId: number, isOccupied: boolean) => {
    if (isOccupied) {
      toast({
        title: "Chalé Ocupado",
        description: `O Chalé ${String(unitId).padStart(2, '0')} já possui reserva confirmada para este período. Por favor, escolha outro chalé livre.`,
        variant: "destructive"
      });
      return;
    }

    let updated: number[];
    if (selectedChaleUnits.includes(unitId)) {
      if (selectedChaleUnits.length === 1) {
        toast({
          title: "Chalé Obrigatório",
          description: "Ao menos 1 chalé deve permanecer selecionado na sua reserva.",
        });
        return;
      }
      updated = selectedChaleUnits.filter(id => id !== unitId);
    } else {
      updated = [...selectedChaleUnits, unitId].sort((a, b) => a - b);
    }

    const nextOccupancies = { ...chaleOccupancies };
    if (!nextOccupancies[unitId]) {
      nextOccupancies[unitId] = 'casal';
    }
    const nextAdults = updated.reduce((acc, id) => acc + (nextOccupancies[id] === 'individual' ? 1 : 2), 0);
    const curNames = chale.guestNames || [];
    const nextNames = Array.from({ length: nextAdults + (chale.childrenCount || 0) }, (_, idx) => curNames[idx] || '');

    setSelectedChaleUnit(updated[0]);
    onUpdate({
      chaleId: updated[0],
      chaleIds: updated,
      chaleOccupancies: nextOccupancies,
      adultsCount: nextAdults,
      guestNames: nextNames
    });

    toast({
      title: updated.includes(unitId) ? "Chalé Adicionado!" : "Chalé Removido",
      description: `${updated.length} chalé(s) na reserva: ${updated.map(id => `Chalé ${String(id).padStart(2, '0')}`).join(', ')}.`,
    });
  };

  // Redefinir as datas para o padrão (Combo Sex a Dom)
  const handleResetDates = () => {
    const inDate = new Date(refFriday);
    inDate.setHours(14, 0, 0, 0);
    const outDate = new Date(refSunday);
    outDate.setHours(12, 0, 0, 0);
    onUpdate({
      packageType: 'combo-2n-sex-dom',
      checkInDate: inDate,
      checkOutDate: outDate,
      includeSundayDayUse: true
    });
    if (onUpdateVisitDate) onUpdateVisitDate(inDate);
    setIsCheckInCalendarOpen(false);
    setIsCheckOutCalendarOpen(false);
    toast({
      title: "Datas Redefinidas",
      description: "As datas foram redefinidas para o Combo Sexta a Domingo padrão.",
    });
  };

  // Atualizar nome de hóspede
  const handleUpdateGuestName = (index: number, name: string) => {
    const totalSlots = currentAdults + (chale.childrenCount || 0);
    const currentNames = [...(chale.guestNames || [])];
    while (currentNames.length < totalSlots) {
      currentNames.push('');
    }
    currentNames[index] = name;
    onUpdate({ guestNames: currentNames });
  };

  // Apenas os chalés operacionais (Chalés 01 a 05)
  const readyUnits = useMemo(() => {
    return CHALE_UNITS.slice(0, 5);
  }, []);

  // Status de ocupação para cada chalé
  const getUnitStatus = (unitId: number) => {
    const isBookedDirectly = bookedChaleIds.includes(unitId) || disabledChaleIds.includes(unitId);
    const existing = existingReservations.find(r => r.chaleId === unitId);
    if (isBookedDirectly || existing) {
      return {
        isOccupied: true,
        badge: 'Ocupado',
        subtext: existing ? `Até ${format(new Date(existing.checkOut), 'dd/MM')}` : 'Reservado',
        color: 'bg-red-600 text-white border-red-700'
      };
    }
    return {
      isOccupied: false,
      badge: 'Livre',
      subtext: `Disponível para entrada às ${stayPricing.checkInHour}`,
      color: 'bg-emerald-600 text-white border-emerald-700'
    };
  };

  // Identificação do período ativo para os botões de atalho
  const inDay = checkInActive.getDay();
  const outDay = checkOutActive.getDay();
  const diffNights = Math.round(Math.abs(checkOutActive.getTime() - checkInActive.getTime()) / (1000 * 60 * 60 * 24));

  const isComboSexDomActive = (inDay === 5 && outDay === 0 && diffNights === 2) || chale.packageType === 'combo-2n-sex-dom';
  const isComboQuiDomActive = (inDay === 4 && outDay === 0 && diffNights === 3) || chale.packageType === 'combo-3n-qui-dom';
  const isComboSexSegActive = (inDay === 5 && outDay === 1 && diffNights === 3) || chale.packageType === 'combo-3n-sex-seg';
  const isComboQuiSegActive = (inDay === 4 && outDay === 1 && diffNights === 4) || chale.packageType === 'combo-4n-qui-seg';
  const isDiariaSexSabActive = (inDay === 5 && outDay === 6 && diffNights === 1) || chale.packageType === 'diaria-sex-sab';
  const isDiariaSabDomActive = (inDay === 6 && outDay === 0 && diffNights === 1) || chale.packageType === 'diaria-sab-dom';

  // Rótulo descritivo do pacote ativo
  const selectedPackageLabel = useMemo(() => {
    if (isComboSexDomActive) return 'Combo 2 Noites — Sexta a Domingo (10% OFF)';
    if (isComboQuiDomActive) return 'Combo 3 Noites — Quinta a Domingo (10% OFF)';
    if (isComboSexSegActive) return 'Combo 3 Noites — Sexta a Segunda (10% OFF)';
    if (isComboQuiSegActive) return 'Combo 4 Noites — Quinta a Segunda (Maior Estadia — 10% OFF)';
    if (isDiariaSexSabActive) return 'Diária Avulsa — Sexta para Sábado';
    if (isDiariaSabDomActive) return 'Diária Avulsa — Sábado para Domingo';
    if (inDay === 4 && outDay === 5) return 'Diária Avulsa — Quinta para Sexta';
    if (inDay === 0 && outDay === 1) return 'Diária Avulsa — Domingo para Segunda';
    return `Hospedagem Personalizada (${stayPricing.nightsCount} Noite${stayPricing.nightsCount > 1 ? 's' : ''})`;
  }, [isComboSexDomActive, isComboQuiDomActive, isComboSexSegActive, isComboQuiSegActive, isDiariaSexSabActive, isDiariaSabDomActive, inDay, outDay, stayPricing.nightsCount]);

  // Cálculo do total ativo com ocupação por chalé
  const calculatedTotal = calculateChaleTotal(
    chale.packageType || 'combo-2n-sex-dom',
    currentAdults,
    chale.childrenCount || 0,
    getPrice,
    chale.includeSundayDayUse,
    chaletsCount,
    checkInActive,
    checkOutActive,
    chaleOccupancies,
    selectedChaleUnits,
    chale.childrenAges
  );

  const childrenAges = chale.childrenAges || [];

  // Mapa de crianças por chalé individual
  const chaleKidsMap: Record<number, ('under11' | '12plus')[]> = useMemo(() => {
    const map: Record<number, ('under11' | '12plus')[]> = {};
    if (chale.chaleKids) {
      selectedChaleUnits.forEach(id => {
        if (Array.isArray(chale.chaleKids?.[id])) {
          map[id] = [...chale.chaleKids[id]];
        }
      });
      return map;
    }
    // Fallback inicial distribuindo childrenAges entre os chalés
    const allAges = [...(chale.childrenAges || [])];
    let cursor = 0;
    selectedChaleUnits.forEach(id => {
      const kidsForId: ('under11' | '12plus')[] = [];
      for (let k = 0; k < 2 && cursor < allAges.length; k++) {
        kidsForId.push(allAges[cursor++]);
      }
      map[id] = kidsForId;
    });
    return map;
  }, [chale.chaleKids, chale.childrenAges, selectedChaleUnits]);

  const syncChaleKids = (newMap: Record<number, ('under11' | '12plus')[]>) => {
    const flattenedAges: ('under11' | '12plus')[] = [];
    selectedChaleUnits.forEach(id => {
      if (newMap[id]) {
        flattenedAges.push(...newMap[id]);
      }
    });
    const nextKids = flattenedAges.length;
    const curNames = [...(chale.guestNames || [])];
    const nextNames = Array.from({ length: currentAdults + nextKids }, (_, idx) => curNames[idx] || '');
    onUpdate({
      chaleKids: newMap,
      childrenCount: nextKids,
      childrenAges: flattenedAges,
      guestNames: nextNames
    });
  };

  const handleAddKidToChale = (chaleId: number) => {
    const curKids = chaleKidsMap[chaleId] || [];
    if (curKids.length >= 2) return;
    const newMap = {
      ...chaleKidsMap,
      [chaleId]: [...curKids, 'under11']
    };
    syncChaleKids(newMap);
  };

  const handleRemoveKidFromChale = (chaleId: number) => {
    const curKids = chaleKidsMap[chaleId] || [];
    if (curKids.length <= 0) return;
    const newMap = {
      ...chaleKidsMap,
      [chaleId]: curKids.slice(0, -1)
    };
    syncChaleKids(newMap);
  };

  const handleUpdateChaleChildAge = (chaleId: number, kidIdx: number, age: 'under11' | '12plus') => {
    const curKids = [...(chaleKidsMap[chaleId] || [])];
    if (kidIdx < curKids.length) {
      curKids[kidIdx] = age;
      const newMap = {
        ...chaleKidsMap,
        [chaleId]: curKids
      };
      syncChaleKids(newMap);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. DESTAQUE COMERCIAL: COMBOS COM 10% OFF */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 p-0.5 shadow-md">
        <div className="rounded-[0.9rem] bg-emerald-950 px-4 py-3 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="p-2 bg-amber-400 text-slate-950 rounded-xl font-black shrink-0 hidden sm:inline-flex">
              <Flame className="w-4 h-4 fill-slate-950" />
            </span>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  🔥 Destaque Comercial • Combos com 10% de Desconto
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                Soma das diárias com <strong>10% OFF automático</strong>, <strong>café das 7h às 9h</strong> e <strong>Day Use incluso no parque!</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-amber-300 font-bold block uppercase">Combo Sex a Dom (2 Noites)</span>
              <span className="text-base sm:text-lg font-black text-amber-400 font-sans">
                R$ 639 <span className="text-[10px] text-white/70">ind.</span> · R$ 729 <span className="text-[10px] text-white/70">casal</span>
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => handleSelectStayPreset('combo-2n-sex-dom')}
              className={cn(
                "h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                isComboSexDomActive
                  ? "bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-md"
                  : "bg-amber-400 hover:bg-amber-500 text-slate-950"
              )}
            >
              {isComboSexDomActive ? '✓ Ativo' : 'Aproveitar'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border-2 border-emerald-100 p-5 sm:p-7 shadow-sm space-y-6">
        
        {/* ROW 1: CALENDÁRIO COM DIAS DE ENTRADA E SAÍDA + ATALHOS RÁPIDOS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-emerald-700" />
              Selecione as Datas de Entrada e Saída da Hospedagem:
            </span>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="hidden md:inline text-[11px] font-bold text-emerald-800">
                Check-in: {stayPricing.checkInHour} · Check-out: às 12h (Domingo Day Use até 17h)
              </span>
              <button
                type="button"
                onClick={handleResetDates}
                className="text-[10px] font-black uppercase text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                title="Redefinir para o Combo Sexta a Domingo padrão"
              >
                <RefreshCw className="w-3 h-3" /> Limpar / Redefinir Datas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* CAMPO DE ENTRADA */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-900 block uppercase tracking-tight">
                📅 Dia de Entrada (Check-in às {stayPricing.checkInHour}):
              </label>
              
              <Popover open={isCheckInCalendarOpen} onOpenChange={setIsCheckInCalendarOpen}>
                <PopoverTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full h-12 rounded-2xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between px-4 shadow-sm cursor-pointer transition-all select-none group"
                  >
                    <div className="flex items-center gap-2 text-slate-950 font-black">
                      <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-slate-950 font-black text-xs sm:text-sm">
                        {format(checkInActive, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-black text-slate-950 bg-amber-400 group-hover:bg-amber-500 px-2.5 py-1 rounded-lg shadow-xs shrink-0">
                      Alterar Entrada
                    </span>
                  </div>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0 rounded-3xl border-2 border-emerald-600 bg-white shadow-2xl overflow-hidden" align="start">
                  <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-3 sm:p-3.5 border-b border-emerald-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
                          <Calendar className="w-4 h-4" />
                        </span>
                        <div>
                          <h5 className="font-sans font-black text-xs sm:text-sm text-white uppercase tracking-tight">
                            Calendário de Reservas
                          </h5>
                          <p className="text-[10px] text-emerald-200">
                            Balneário Família Lessa
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 shadow-sm">
                        10% OFF
                      </Badge>
                    </div>
                  </div>

                  <div className="p-2 bg-white text-slate-900 flex justify-center">
                    <CalendarUI
                      mode="single"
                      selected={checkInActive}
                      onSelect={(d) => {
                        if (d) handleSelectCheckInDate(d);
                      }}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return d < today || !isChaleCheckInDay(d);
                      }}
                      className="p-1 pointer-events-auto"
                      locale={ptBR}
                    />
                  </div>

                  <div className="bg-emerald-950 text-white p-2.5 sm:p-3 border-t border-emerald-800/80 space-y-2 text-[10px] font-bold">
                    <div className="flex items-start gap-1.5 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-tight">Entradas: Quinta, Sexta, Sábado e Domingo</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-tight">Check-in às 14h (Quintas em combos às 09h)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleResetDates();
                        setIsCheckInCalendarOpen(false);
                      }}
                      className="w-full mt-1 py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Limpar / Redefinir Datas
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* CAMPO DE SAÍDA */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-900 block uppercase tracking-tight">
                📅 Dia de Saída ({stayPricing.hasSunday ? 'Check-out chalé 12h • Parque até 17h' : 'Check-out às 12h'}):
              </label>

              <Popover open={isCheckOutCalendarOpen} onOpenChange={setIsCheckOutCalendarOpen}>
                <PopoverTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full h-12 rounded-2xl border-2 border-amber-500 bg-white hover:bg-amber-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between px-4 shadow-sm cursor-pointer transition-all select-none group"
                  >
                    <div className="flex items-center gap-2 text-slate-950 font-black">
                      <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-slate-950 font-black text-xs sm:text-sm">
                        {format(checkOutActive, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-black text-slate-950 bg-amber-400 group-hover:bg-amber-500 px-2.5 py-1 rounded-lg shadow-xs shrink-0">
                      Alterar Saída
                    </span>
                  </div>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0 rounded-3xl border-2 border-amber-400 bg-white shadow-2xl overflow-hidden" align="end">
                  <div className="bg-gradient-to-br from-emerald-950 via-[#042817] to-slate-950 text-white p-3 sm:p-3.5 border-b border-amber-400/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-amber-400 text-slate-950 rounded-lg">
                          <Calendar className="w-4 h-4" />
                        </span>
                        <div>
                          <h5 className="font-sans font-black text-xs sm:text-sm text-white uppercase tracking-tight">
                            Calendário de Reservas
                          </h5>
                          <p className="text-[10px] text-emerald-200">
                            Balneário Família Lessa
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 shadow-sm">
                        Saída
                      </Badge>
                    </div>
                  </div>

                  <div className="p-2 bg-white text-slate-900 flex justify-center">
                    <CalendarUI
                      mode="single"
                      selected={checkOutActive}
                      onSelect={(d) => {
                        if (d) handleSelectCheckOutDate(d);
                      }}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isAfterCheckIn = d > checkInActive;
                        const isWithinWeekend = d <= maxWeekendOutDate;
                        const isValidOperating = isChaleCheckOutDay(d);
                        return d < today || !isAfterCheckIn || !isWithinWeekend || !isValidOperating;
                      }}
                      className="p-1 pointer-events-auto"
                      locale={ptBR}
                    />
                  </div>

                  <div className="bg-emerald-950 text-white p-2.5 sm:p-3 border-t border-emerald-800/80 space-y-2 text-[10px] font-bold">
                    <div className="flex items-start gap-1.5 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-tight">Apenas dias deste final de semana (Sex, Sáb, Dom e Seg)</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-tight">Check-out às 12h · Domingo: Day Use no parque incluso até 17h</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleResetDates();
                        setIsCheckOutCalendarOpen(false);
                      }}
                      className="w-full mt-1 py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Limpar / Redefinir Datas
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS EM FLEX-WRAP COM EMOJIS VISÍVEIS (NUNCA CORTA OU SOME) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-black uppercase text-slate-800 block">
              Atalhos Rápidos de Combos & Diárias (Clique para selecionar):
            </span>

            <div className="flex flex-wrap items-center gap-2 py-1">
              {/* Combo 2 Noites - Sex a Dom */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('combo-2n-sex-dom')}
                className={cn(
                  "h-10 px-3.5 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isComboSexDomActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                🔥 Sex a Dom (2 Noites — 10% OFF)
              </button>

              {/* Combo 3 Noites - Qui a Dom */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('combo-3n-qui-dom')}
                className={cn(
                  "h-10 px-3.5 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isComboQuiDomActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                🌴 Qui a Dom (3 Noites — 10% OFF)
              </button>

              {/* Combo 3 Noites - Sex a Seg */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('combo-3n-sex-seg')}
                className={cn(
                  "h-10 px-3.5 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isComboSexSegActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                🚀 Sex a Seg (3 Noites — 10% OFF)
              </button>

              {/* Combo 4 Noites - Qui a Seg */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('combo-4n-qui-seg')}
                className={cn(
                  "h-10 px-3.5 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isComboQuiSegActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                👑 Qui a Seg (4 Noites — 10% OFF)
              </button>

              {/* Diária Sex a Sáb */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('diaria-sex-sab')}
                className={cn(
                  "h-10 px-3 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isDiariaSexSabActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                📅 Sexta a Sábado (1 Diária)
              </button>

              {/* Diária Sáb a Dom */}
              <button
                type="button"
                onClick={() => handleSelectStayPreset('diaria-sab-dom')}
                className={cn(
                  "h-10 px-3 rounded-xl font-black text-xs transition-all border-2 flex items-center justify-center cursor-pointer shadow-xs select-none",
                  isDiariaSabDomActive
                    ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                    : "bg-white text-slate-950 border-slate-300 hover:bg-amber-100 hover:text-slate-950 hover:border-amber-400"
                )}
              >
                ☀️ Sábado a Domingo (1 Diária)
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2: SELEÇÃO DO(S) CHALÉ(S) NO TOPO (ENTRE DATAS E OCUPAÇÃO) */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Home className="w-4 h-4 text-emerald-700" />
                Selecione o(s) Chalé(s) Desejado(s) para sua Reserva:
              </span>
              <p className="text-[11px] text-emerald-800 font-bold">
                Você pode selecionar 1 ou mais chalés para acomodar amigos ou familiares na mesma reserva!
              </p>
            </div>
            <span className="text-[11px] font-black text-slate-950 bg-amber-400 border border-amber-500 px-3 py-1 rounded-xl shadow-xs self-start sm:self-auto">
              ✓ {chaletsCount} {chaletsCount === 1 ? 'Chalé Selecionado' : 'Chalés Selecionados'}: {selectedChaleUnits.map(id => `Chalé ${String(id).padStart(2, '0')}`).join(', ')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {readyUnits.map((unit) => {
              const isUnitSelected = selectedChaleUnits.includes(unit.id);
              const status = getUnitStatus(unit.id);
              const isOccupied = status.isOccupied;

              return (
                <div
                  key={unit.id}
                  onClick={() => handleToggleUnitSelection(unit.id, isOccupied)}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between min-h-[125px] select-none shadow-md",
                    isOccupied
                      ? "opacity-50 bg-[#1f1315] border-red-900/60 cursor-not-allowed text-red-200"
                      : isUnitSelected
                        ? "bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-xl scale-[1.03] cursor-pointer ring-2 ring-amber-400/50"
                        : "bg-gradient-to-b from-[#063321] to-[#032014] text-white border-emerald-700/60 hover:border-amber-400 hover:shadow-lg hover:scale-[1.02] cursor-pointer group"
                  )}
                >
                  <div className={cn(
                    "absolute -top-2.5 -right-2 font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md border flex items-center gap-1 z-10",
                    isOccupied
                      ? "bg-red-600 text-white border-red-500"
                      : isUnitSelected
                        ? "bg-slate-950 text-amber-300 border-slate-800"
                        : "bg-emerald-500 text-emerald-950 border-emerald-300"
                  )}>
                    {isOccupied ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : isUnitSelected ? (
                      <CheckCircle2 className="w-2.5 h-2.5 text-amber-300" />
                    ) : (
                      <Clock className="w-2.5 h-2.5" />
                    )}
                    {isOccupied ? status.badge : isUnitSelected ? 'SELECIONADO ✓' : status.badge}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn(
                        "font-black text-sm uppercase tracking-tight block font-sans",
                        isOccupied ? "text-red-300" : isUnitSelected ? "text-slate-950" : "text-white group-hover:text-amber-300"
                      )}>
                        Chalé {String(unit.id).padStart(2, '0')}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block tracking-wider",
                      isOccupied
                        ? "bg-red-950/60 text-red-300 border border-red-800/40"
                        : isUnitSelected
                          ? "bg-slate-950 text-amber-300"
                          : "bg-emerald-900/90 text-emerald-200 border border-emerald-700/60"
                    )}>
                      Alvenaria Tradicional
                    </span>
                  </div>

                  <div className="pt-2">
                    <span className={cn(
                      "text-[10px] font-bold block",
                      isOccupied
                        ? "text-red-300/80"
                        : isUnitSelected
                          ? "text-slate-950 font-black"
                          : "text-emerald-300"
                    )}>
                      {isOccupied ? status.subtext : isUnitSelected ? '✓ Incluso na reserva (clique p/ remover)' : '+ Clique para adicionar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 3: CONFIGURAÇÃO AGRUPADA POR CHALÉ (MODALIDADE + ADICIONAL DE CRIANÇAS LADO A LADO) */}
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-700" />
              Configuração por Chalé (Ocupação & Crianças):
            </span>
            <span className="bg-amber-100 text-amber-950 border border-amber-300 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-md shadow-2xs">
              {currentAdults} Adultos · {chale.childrenCount || 0} Crianças · {chaletsCount} Chalé{chaletsCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-3">
            {selectedChaleUnits.map((chaleId) => {
              const isChaleCasal = chaleOccupancies[chaleId] !== 'individual';
              const kidsList = chaleKidsMap[chaleId] || [];
              const kidsCount = kidsList.length;

              return (
                <div
                  key={`chale-group-card-${chaleId}`}
                  className="bg-slate-50 p-3.5 sm:p-4 rounded-3xl border-2 border-slate-200 shadow-xs space-y-3"
                >
                  {/* Cabeçalho do Chalé */}
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-black text-xs">
                        {String(chaleId).padStart(2, '0')}
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase text-slate-950 block">
                          Chalé {String(chaleId).padStart(2, '0')} • Alvenaria Tradicional
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800">
                          {isChaleCasal ? 'Casal (2 Adultos)' : 'Individual (1 Adulto)'}
                          {kidsCount > 0 ? ` + ${kidsCount} Criança(s)` : ' · Sem crianças'}
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 shadow-2xs">
                      {isChaleCasal ? '👥 Casal' : '👤 Individual'}
                    </Badge>
                  </div>

                  {/* Lado a Lado: Ocupação do Chalé e Adicionais de Crianças */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                    {/* Lado Esquerdo: Ocupação (Casal vs Individual) */}
                    <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[10.5px] font-black uppercase text-slate-700 block">
                          Modalidade de Ocupação:
                        </span>
                        <span className="text-[9.5px] text-slate-500 font-bold block mt-0.5">
                          {isChaleCasal ? 'Acomoda até 2 adultos' : 'Acomoda 1 adulto'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleChaleMode(chaleId, 'casal')}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-center transition-all border-2 cursor-pointer select-none",
                            isChaleCasal
                              ? "bg-amber-400 text-slate-950 border-amber-500 shadow-xs font-black"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <span className="font-black text-xs">👥 Casal</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleChaleMode(chaleId, 'individual')}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-center transition-all border-2 cursor-pointer select-none",
                            !isChaleCasal
                              ? "bg-amber-400 text-slate-950 border-amber-500 shadow-xs font-black"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <span className="font-black text-xs">👤 Individual</span>
                        </button>
                      </div>
                    </div>

                    {/* Lado Direito: Adicional de Crianças para este Chalé */}
                    <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10.5px] font-black uppercase text-slate-700 block">
                            👶 Crianças neste Chalé (Filhos):
                          </span>
                          <span className="text-[9.5px] text-emerald-800 font-bold block mt-0.5">
                            Até 11 anos: R$ 50 · 12+ anos: R$ 100 (Máx: 2)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={kidsCount <= 0}
                            onClick={() => handleRemoveKidFromChale(chaleId)}
                            className="w-8 h-8 rounded-xl font-black bg-white border-2 border-slate-300 text-slate-950 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <span className="w-6 text-center font-black text-sm text-slate-950">
                            {kidsCount}
                          </span>
                          <button
                            type="button"
                            disabled={kidsCount >= 2}
                            onClick={() => handleAddKidToChale(chaleId)}
                            className="w-8 h-8 rounded-xl font-black bg-white border-2 border-slate-300 text-slate-950 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>

                      {/* Se houver crianças neste chalé, mostra o seletor de idade da criança aqui mesmo */}
                      {kidsCount > 0 ? (
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                          {kidsList.map((kAge, kidIdx) => (
                            <div key={`chale-${chaleId}-kid-${kidIdx}`} className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-black text-slate-800">
                                Criança {kidIdx + 1}:
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChaleChildAge(chaleId, kidIdx, 'under11')}
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-black transition-all border cursor-pointer",
                                    kAge === 'under11'
                                      ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  )}
                                >
                                  Até 11 anos (+ R$ 50)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChaleChildAge(chaleId, kidIdx, '12plus')}
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-[10px] font-black transition-all border cursor-pointer",
                                    kAge === '12plus'
                                      ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  )}
                                >
                                  12+ anos (+ R$ 100)
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          Nenhum adicional de criança neste chalé.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AVISO IMPORTANTE: OCUPANDO TODA A LARGURA (FULL WIDTH) ABAIXO DOS CHALÉS */}
          <div className="w-full bg-amber-50/90 border-2 border-amber-300 p-3.5 sm:p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-950 leading-relaxed shadow-xs mt-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block uppercase text-xs text-amber-900 tracking-wider mb-0.5">
                ⚠️ Importante sobre Adicional de Crianças:
              </span>
              <span>
                O adicional de crianças é <strong>exclusivo e permitido apenas para filhos</strong> dos hóspedes (limite máximo de até 2 crianças por chalé). É <strong>obrigatório levar e apresentar documento oficial de identificação</strong> (RG ou Certidão de Nascimento) na recepção/check-in para comprovação do parentesco. Todos os adicionais são pagos conforme a faixa etária.
              </span>
            </div>
          </div>
        </div>

        {/* ROW 4: NOMES DOS HÓSPEDES PARA CHECK-IN */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              <span>✍️</span> Nomes dos Hóspedes para Check-in na Portaria:
            </span>
            <span className="text-[10px] font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {currentAdults} Adulto(s) {chaletsCount > 1 ? `(${chaletsCount} chalés)` : ''} {chale.childrenCount ? `+ ${chale.childrenCount} Criança(s)` : ''}
            </span>
          </div>

          <div className="space-y-3">
            {selectedChaleUnits.map((chaleId, unitIdx) => {
              const isChaleCasal = chaleOccupancies[chaleId] !== 'individual';
              // Calcula offset de índice de nomes de adultos
              let baseAdultIdx = 0;
              for (let i = 0; i < unitIdx; i++) {
                baseAdultIdx += chaleOccupancies[selectedChaleUnits[i]] === 'individual' ? 1 : 2;
              }
              const kidsForThisChale = chaleKidsMap[chaleId] || [];
              let baseKidOffset = 0;
              for (let i = 0; i < unitIdx; i++) {
                baseKidOffset += (chaleKidsMap[selectedChaleUnits[i]] || []).length;
              }

              return (
                <div key={`chale-group-${chaleId}`} className="bg-slate-50/80 p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-300 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs sm:text-sm font-black uppercase text-emerald-950 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-emerald-700" />
                      Chalé {String(chaleId).padStart(2, '0')} · {isChaleCasal ? 'Casal (2 Adultos)' : 'Individual (1 Adulto)'}
                    </span>
                    <Badge className="bg-emerald-900 text-amber-300 font-black text-[9px] uppercase px-2 py-0.5">
                      Alvenaria
                    </Badge>
                  </div>

                  {/* Adultos deste chalé */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-slate-900 block">
                        Adulto 1 - Titular do Chalé {String(chaleId).padStart(2, '0')}:
                      </label>
                      <Input
                        placeholder={`Nome completo do titular...`}
                        value={(chale.guestNames && chale.guestNames[baseAdultIdx]) || ''}
                        onChange={(e) => handleUpdateGuestName(baseAdultIdx, e.target.value)}
                        className="bg-white border-2 border-slate-300 h-10 rounded-xl text-xs font-bold text-slate-900 focus-visible:ring-emerald-600 shadow-xs"
                      />
                    </div>

                    {isChaleCasal && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-slate-900 block">
                          Adulto 2 - Acompanhante do Chalé {String(chaleId).padStart(2, '0')}:
                        </label>
                        <Input
                          placeholder={`Nome completo do acompanhante...`}
                          value={(chale.guestNames && chale.guestNames[baseAdultIdx + 1]) || ''}
                          onChange={(e) => handleUpdateGuestName(baseAdultIdx + 1, e.target.value)}
                          className="bg-white border-2 border-slate-300 h-10 rounded-xl text-xs font-bold text-slate-900 focus-visible:ring-emerald-600 shadow-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Crianças deste chalé específico agrupadas junto aos titulares */}
                  {kidsForThisChale.length > 0 && (
                    <div className="pt-2.5 mt-2 border-t border-amber-200/80 space-y-2 bg-amber-50/50 p-2.5 rounded-xl border">
                      <span className="text-[11px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                        <span>👶</span> Crianças do Chalé {String(chaleId).padStart(2, '0')} (Filhos):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {kidsForThisChale.map((age, kIdx) => {
                          const kidSlotIdx = currentAdults + baseKidOffset + kIdx;
                          const ageLabel = age === '12plus' ? '12 anos ou mais (+ R$ 100)' : 'Até 11 anos (+ R$ 50)';
                          return (
                            <div key={`chale-${chaleId}-kid-${kIdx}`} className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-800 block">
                                Criança {kIdx + 1} do Chalé {String(chaleId).padStart(2, '0')} · {ageLabel}:
                              </label>
                              <Input
                                placeholder={`Nome completo da criança ${kIdx + 1}...`}
                                value={(chale.guestNames && chale.guestNames[kidSlotIdx]) || ''}
                                onChange={(e) => handleUpdateGuestName(kidSlotIdx, e.target.value)}
                                className="bg-white border-2 border-amber-300 h-10 rounded-xl text-xs font-bold text-slate-900 focus-visible:ring-amber-500 shadow-xs"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 5: BENEFÍCIOS DO PACOTE & REGRAS OFICIAIS */}
        <div className="bg-gradient-to-br from-emerald-950 via-[#032817] to-slate-950 text-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-600 shadow-lg space-y-3">
          <div className="flex items-center gap-2 border-b border-emerald-800/80 pb-2.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-sans font-black text-xs sm:text-sm uppercase tracking-wide text-amber-400">
              Benefícios Inclusos na Hospedagem:
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-900/60 border border-emerald-700/60 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Café da Manhã Incluso</span>
              </div>
              <p className="text-[11px] text-emerald-100 font-bold">
                Servido das 07h às 09h nas manhãs de sexta, sábado e domingo.
              </p>
              {stayPricing.hasMondayOut && (
                <p className="text-[10px] text-amber-300/90 font-medium">
                  *Segunda-feira o balneário estará fechado e não haverá café da manhã.
                </p>
              )}
            </div>

            <div className="bg-emerald-900/60 border border-emerald-700/60 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Day Use de Domingo Incluso</span>
              </div>
              <p className="text-[11px] text-emerald-100 font-bold">
                Check-out do chalé às 12h • Acesso livre ao parque até as 17h!
              </p>
              <p className="text-[10px] text-emerald-200/90">
                Piscinas, cachoeiras e área de lazer inclusas sem nenhum custo adicional.
              </p>
            </div>

            <div className="bg-emerald-900/60 border border-emerald-700/60 p-3 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Horários de Estadia</span>
              </div>
              <p className="text-[11px] text-emerald-100 font-bold">
                Check-in às {stayPricing.checkInHour} · Check-out às 12h
              </p>
              {stayPricing.hasMondayOut ? (
                <p className="text-[10px] text-amber-300/90 font-medium">
                  Saída na segunda organizada previamente na recepção.
                </p>
              ) : (
                <p className="text-[10px] text-emerald-200/90">
                  Recepção disponível para atendimento exclusivo.
                </p>
              )}
            </div>
          </div>

          {/* Resumo da Hospedagem Selecionada com valor e desconto */}
          <div className="bg-emerald-900/90 rounded-2xl p-3.5 sm:p-4 border border-emerald-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-white shadow-inner mt-2">
            <div className="space-y-0.5 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                  ✓ Resumo da Hospedagem Selecionada
                </span>
                {stayPricing.discountPct > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-md font-sans">
                    10% OFF APLICADO
                  </span>
                )}
              </div>
              <h4 className="font-sans font-black text-base sm:text-lg text-white">
                {selectedPackageLabel}
              </h4>
              <p className="text-xs text-emerald-200 font-medium">
                {format(checkInActive, "dd/MM (EEEE)", { locale: ptBR })} às {stayPricing.checkInHour} ➔ {format(checkOutActive, "dd/MM (EEEE)", { locale: ptBR })} às 12h · {currentAdults} Adulto(s) {chaletsCount > 1 ? `(${chaletsCount} chalés)` : ''} {chale.childrenCount ? `+ ${chale.childrenCount} Criança(s)` : ''}
              </p>
            </div>

            <div className="text-center sm:text-right shrink-0">
              <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                {stayPricing.discountPct > 0 ? (
                  <span>De <span className="line-through text-emerald-400/80">{formatCurrency(stayPricing.totalCasalGross * chaletsCount)}</span> com 10% OFF:</span>
                ) : (
                  'Valor Total da Hospedagem:'
                )}
              </span>
              <span className="font-sans font-black text-2xl sm:text-3xl text-amber-400">
                {formatCurrency(calculatedTotal)}
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
