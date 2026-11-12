import { ChaleTermsModal, ChaleTermsFullContent, CHALE_TERMS_VERSION } from './ChaleTermsModal';
import { CheckCircle, FileText, Printer, ShieldCheck } from 'lucide-react';
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
  AlertTriangle,
  ChevronDown,
  ChevronUp
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
import { getBookedChaleIds, getGlobalSetting } from '@/lib/booking-service';
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

class ChaleErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ChaleSelector error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border-2 border-red-200 p-6 rounded-3xl text-center space-y-3">
          <p className="text-sm font-black text-red-800 uppercase">
            Ops! Ocorreu um problema ao carregar os chalés.
          </p>
          <p className="text-xs text-red-600 font-mono bg-white p-3 rounded-xl border border-red-200 text-left overflow-auto max-h-40">
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </p>
          <Button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
            }}
            className="bg-emerald-800 text-white font-bold h-10 px-4 rounded-xl hover:bg-emerald-900 cursor-pointer"
          >
            Tentar Novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ChaleSelectorInner({ 
  chale, 
  onUpdate, 
  visitDate, 
  onUpdateVisitDate,
  disabledChaleIds = [] 
}: Props) {
  const { getPrice } = useServices();
  const [selectedChaleUnit, setSelectedChaleUnit] = useState<number | null>(chale.chaleId || null);
  const [bookedChaleIds, setBookedChaleIds] = useState<number[]>([]);
  const [maintenanceChaleIds, setMaintenanceChaleIds] = useState<number[]>([6, 7, 8, 9, 10, 11, 12]);
  const [existingReservations, setExistingReservations] = useState<ChaleReservationDetail[]>([]);
  const [isLoadingBooked, setIsLoadingBooked] = useState<boolean>(false);
  const [isCheckInCalendarOpen, setIsCheckInCalendarOpen] = useState<boolean>(false);
  const [isCheckOutCalendarOpen, setIsCheckOutCalendarOpen] = useState<boolean>(false);
  const [shortcutCategory, setShortcutCategory] = useState<'combos' | 'diarias' | null>(null);
  const [isTermsExpanded, setIsTermsExpanded] = useState<boolean>(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);

  // Data âncora inicial (Hospedagem liberada a partir de 19/11/2026)
  const anchorDate = useMemo(() => {
    const minHosp = new Date('2026-11-19T00:00:00');
    let candidate = chale.checkInDate || visitDate || new Date();
    if (new Date(candidate) < minHosp) {
      candidate = minHosp;
    }
    return candidate;
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
    friday.setHours(15, 0, 0, 0);

    const saturday = addDays(thursday, 2);
    saturday.setHours(15, 0, 0, 0);

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

  // Garantir pacote padrão se ainda não definido ou se a data estiver antes de 19/11/2026
  useEffect(() => {
    const minHosp = new Date('2026-11-19T00:00:00');
    const isBeforeMin = chale.checkInDate && new Date(chale.checkInDate) < minHosp;
    if (!chale.packageType || !chale.checkInDate || isBeforeMin) {
      onUpdate({
        packageType: 'combo-2n-sex-dom',
        checkInDate: refFriday,
        checkOutDate: refSunday,
        includeSundayDayUse: true,
        chaleId: null,
        chaleIds: [],
        adultsCount: 0,
        childrenCount: 0,
        childrenAges: [],
        chaleKids: {}
      });
    }
  }, [chale.packageType, chale.checkInDate, refFriday, refSunday]);

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

  // Buscar chalés ocupados e bloqueios de manutenção
  useEffect(() => {
    async function loadAvailability() {
      setIsLoadingBooked(true);
      try {
        const [ids, disabledIds] = await Promise.all([
          getBookedChaleIds(formattedDate),
          getGlobalSetting('disabled_chale_ids', [6, 7, 8, 9, 10, 11, 12])
        ]);
        setBookedChaleIds(ids);
        setMaintenanceChaleIds(
          Array.isArray(disabledIds)
            ? disabledIds.map(Number).filter((n) => !isNaN(n))
            : [6, 7, 8, 9, 10, 11, 12]
        );

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

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadAvailability();
      }
    };
    window.addEventListener('focus', loadAvailability);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const channel = supabase.channel('chale-map-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadAvailability();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadAvailability();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {
        loadAvailability();
      })
      .subscribe();

    return () => {
      window.removeEventListener('focus', loadAvailability);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      supabase.removeChannel(channel);
    };
  }, [formattedDate]);

  // Lista de chalés selecionados (nenhum chalé pré-selecionado inicialmente)
  const selectedChaleUnits: number[] = useMemo(() => {
    if (chale.chaleIds && Array.isArray(chale.chaleIds) && chale.chaleIds.length > 0) {
      return chale.chaleIds;
    }
    if (chale.chaleId) {
      return [chale.chaleId];
    }
    return [];
  }, [chale.chaleIds, chale.chaleId]);

  const chaletsCount = selectedChaleUnits.length;

  // Remover automaticamente chalés selecionados que foram bloqueados para manutenção ou reservados
  useEffect(() => {
    if (selectedChaleUnits.length === 0) return;
    const blockedSet = new Set([...bookedChaleIds, ...maintenanceChaleIds, ...disabledChaleIds]);
    const validSelected = selectedChaleUnits.filter(id => !blockedSet.has(id));
    if (validSelected.length !== selectedChaleUnits.length) {
      setSelectedChaleUnit(validSelected[0] || null);
      if (validSelected.length === 0) {
        onUpdate({
          chaleId: null,
          chaleIds: [],
          chaleOccupancies: {},
          adultsCount: 0,
          childrenCount: 0,
          childrenAges: [],
          chaleKids: {},
          guestNames: []
        });
      } else {
        onUpdate({
          chaleId: validSelected[0],
          chaleIds: validSelected
        });
      }
    }
  }, [bookedChaleIds, maintenanceChaleIds, disabledChaleIds, selectedChaleUnits]);

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
    newInDate.setHours(day === 4 ? 9 : 15, 0, 0, 0);

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
    } else if (inDay === 4 && outDay === 6 && diffNights === 2) {
      pkgType = 'combo-2n-qui-sab';
    } else if (inDay === 6 && outDay === 1 && diffNights === 2) {
      pkgType = 'combo-2n-sab-seg';
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

    const updatedInDate = new Date(inDate);
    if (inDay === 4) {
      updatedInDate.setHours(diffNights >= 2 ? 9 : 15, 0, 0, 0);
    }

    onUpdate({
      packageType: pkgType,
      checkInDate: updatedInDate,
      checkOutDate: newOutDate,
      includeSundayDayUse: true
    });
    setIsCheckOutCalendarOpen(false);
  };

  // Atalhos Rápidos com seleção direta dos Combos e Diárias
  const handleSelectStayPreset = (preset: 
    | 'combo-2n-sex-dom' 
    | 'combo-2n-qui-sab'
    | 'combo-2n-sab-seg'
    | 'combo-3n-qui-dom' 
    | 'combo-3n-sex-seg' 
    | 'combo-4n-qui-seg' 
    | 'diaria-qui-sex'
    | 'diaria-sex-sab' 
    | 'diaria-sab-dom'
    | 'diaria-dom-seg'
  ) => {
    let inDate = new Date(refFriday);
    let outDate = new Date(refSunday);
    let pkgType: ChalePackageType = 'combo-2n-sex-dom';

    if (preset === 'combo-2n-sex-dom') {
      inDate = new Date(refFriday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-2n-sex-dom';
    } else if (preset === 'combo-2n-qui-sab') {
      inDate = new Date(refThursday);
      inDate.setHours(9, 0, 0, 0);
      outDate = new Date(refSaturday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-2n-qui-sab';
    } else if (preset === 'combo-2n-sab-seg') {
      inDate = new Date(refSaturday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-2n-sab-seg';
    } else if (preset === 'combo-3n-qui-dom') {
      inDate = new Date(refThursday);
      inDate.setHours(9, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-3n-qui-dom';
    } else if (preset === 'combo-3n-sex-seg') {
      inDate = new Date(refFriday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-3n-sex-seg';
    } else if (preset === 'combo-4n-qui-seg') {
      inDate = new Date(refThursday);
      inDate.setHours(9, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'combo-4n-qui-seg';
    } else if (preset === 'diaria-qui-sex') {
      inDate = new Date(refThursday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refFriday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-qui-sex';
    } else if (preset === 'diaria-sex-sab') {
      inDate = new Date(refFriday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refSaturday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-sex-sab';
    } else if (preset === 'diaria-sab-dom') {
      inDate = new Date(refSaturday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refSunday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-sab-dom';
    } else if (preset === 'diaria-dom-seg') {
      inDate = new Date(refSunday);
      inDate.setHours(15, 0, 0, 0);
      outDate = new Date(refMonday);
      outDate.setHours(12, 0, 0, 0);
      pkgType = 'diaria-dom-seg';
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
  const handleToggleUnitSelection = (unitId: number, isOccupied: boolean, isMaintenance: boolean = false) => {
    if (isOccupied) {
      toast({
        title: isMaintenance ? "Chalé em Manutenção" : "Chalé Ocupado",
        description: isMaintenance
          ? `O Chalé ${String(unitId).padStart(2, '0')} está temporariamente bloqueado para manutenção. Por favor, escolha outro chalé livre.`
          : `O Chalé ${String(unitId).padStart(2, '0')} já possui reserva confirmada para este período. Por favor, escolha outro chalé livre.`,
        variant: "destructive"
      });
      return;
    }

    let updated: number[];
    if (selectedChaleUnits.includes(unitId)) {
      updated = selectedChaleUnits.filter(id => id !== unitId);
    } else {
      updated = [...selectedChaleUnits, unitId].sort((a, b) => a - b);
    }

    if (updated.length === 0) {
      setSelectedChaleUnit(null);
      onUpdate({
        chaleId: null,
        chaleIds: [],
        chaleOccupancies: {},
        adultsCount: 0,
        childrenCount: 0,
        childrenAges: [],
        chaleKids: {},
        guestNames: []
      });
      toast({
        title: "Chalé Removido",
        description: "Nenhum chalé selecionado no momento. Clique em um chalé livre para selecionar.",
      });
      return;
    }

    const nextOccupancies: Record<number, 'casal' | 'individual'> = {};
    updated.forEach(id => {
      nextOccupancies[id] = chaleOccupancies[id] || 'casal';
    });
    const nextKidsMap: Record<number, ('under11' | '12plus')[]> = {};
    const nextAges: ('under11' | '12plus')[] = [];
    updated.forEach(id => {
      const kList = chale.chaleKids?.[id] || [];
      nextKidsMap[id] = kList;
      nextAges.push(...kList);
    });
    const nextAdults = updated.reduce((acc, id) => acc + (nextOccupancies[id] === 'individual' ? 1 : 2), 0);
    const curNames = chale.guestNames || [];
    const nextNames = Array.from({ length: nextAdults + nextAges.length }, (_, idx) => curNames[idx] || '');

    setSelectedChaleUnit(updated[0]);
    onUpdate({
      chaleId: updated[0],
      chaleIds: updated,
      chaleOccupancies: nextOccupancies,
      chaleKids: nextKidsMap,
      childrenCount: nextAges.length,
      childrenAges: nextAges,
      adultsCount: nextAdults,
      guestNames: nextNames
    });

    toast({
      title: updated.includes(unitId) ? "Chalé Selecionado!" : "Chalé Removido",
      description: `${updated.length} chalé(s) na reserva: ${updated.map(id => `Chalé ${String(id).padStart(2, '0')}`).join(', ')}.`,
    });
  };

  // Redefinir as datas para o padrão (Combo Sex a Dom - a partir de 19/11/2026)
  const handleResetDates = () => {
    const minHosp = new Date('2026-11-19T00:00:00');
    let inDate = new Date(refFriday);
    if (inDate < minHosp) {
      inDate = new Date('2026-11-20T15:00:00');
    } else {
      inDate.setHours(15, 0, 0, 0);
    }
    const outDate = addDays(inDate, 2);
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
    const isMaintenance = maintenanceChaleIds.includes(unitId) || disabledChaleIds.includes(unitId);
    if (isMaintenance) {
      return {
        isOccupied: true,
        isMaintenance: true,
        badge: 'Manutenção',
        subtext: 'Bloqueado p/ manutenção',
        color: 'bg-amber-500 text-slate-950 border-amber-400'
      };
    }
    const isBookedDirectly = bookedChaleIds.includes(unitId);
    const existing = existingReservations.find(r => r.chaleId === unitId);
    if (isBookedDirectly || existing) {
      let subtext = 'Reservado';
      if (existing?.checkOut) {
        try {
          const d = new Date(existing.checkOut);
          if (!isNaN(d.getTime())) {
            subtext = `Até ${format(d, 'dd/MM')}`;
          }
        } catch {}
      }
      return {
        isOccupied: true,
        isMaintenance: false,
        badge: 'Ocupado',
        subtext,
        color: 'bg-red-600 text-white border-red-700'
      };
    }
    return {
      isOccupied: false,
      isMaintenance: false,
      badge: 'Livre',
      subtext: `Disponível para entrada às ${stayPricing?.checkInHour || '15h'}`,
      color: 'bg-emerald-600 text-white border-emerald-700'
    };
  };

  // Identificação do período ativo para os botões de atalho
  const inDay = checkInActive.getDay();
  const outDay = checkOutActive.getDay();
  const diffNights = Math.round(Math.abs(checkOutActive.getTime() - checkInActive.getTime()) / (1000 * 60 * 60 * 24));

  const isComboSexDomActive = inDay === 5 && outDay === 0 && diffNights === 2;
  const isComboQuiSabActive = inDay === 4 && outDay === 6 && diffNights === 2;
  const isComboSabSegActive = inDay === 6 && outDay === 1 && diffNights === 2;
  const isComboQuiDomActive = inDay === 4 && outDay === 0 && diffNights === 3;
  const isComboSexSegActive = inDay === 5 && outDay === 1 && diffNights === 3;
  const isComboQuiSegActive = inDay === 4 && outDay === 1 && diffNights === 4;
  const isDiariaSexSabActive = inDay === 5 && outDay === 6 && diffNights === 1;
  const isDiariaSabDomActive = inDay === 6 && outDay === 0 && diffNights === 1;

  // Rótulo descritivo do pacote ativo
  const selectedPackageLabel = useMemo(() => {
    if (isComboSexDomActive) return 'Combo 2 Noites — Sexta a Domingo (10% OFF)';
    if (isComboQuiSabActive) return 'Combo 2 Noites — Quinta a Sábado (10% OFF)';
    if (isComboSabSegActive) return 'Combo 2 Noites — Sábado a Segunda (10% OFF)';
    if (isComboQuiDomActive) return 'Combo 3 Noites — Quinta a Domingo (10% OFF)';
    if (isComboSexSegActive) return 'Combo 3 Noites — Sexta a Segunda (10% OFF)';
    if (isComboQuiSegActive) return 'Combo 4 Noites — Quinta a Segunda (Maior Estadia — 10% OFF)';
    if (inDay === 4 && outDay === 5 && diffNights === 1) return 'Diária Avulsa — Quinta para Sexta (Entrada 15h)';
    if (inDay === 5 && outDay === 6 && diffNights === 1) return 'Diária Avulsa — Sexta para Sábado';
    if (inDay === 6 && outDay === 0 && diffNights === 1) return 'Diária Avulsa — Sábado para Domingo';
    if (inDay === 0 && outDay === 1 && diffNights === 1) return 'Diária Avulsa — Domingo para Segunda';
    return `Hospedagem Personalizada (${stayPricing.nightsCount} Noite${stayPricing.nightsCount > 1 ? 's' : ''})`;
  }, [isComboSexDomActive, isComboQuiSabActive, isComboSabSegActive, isComboQuiDomActive, isComboSexSegActive, isComboQuiSegActive, inDay, outDay, diffNights, stayPricing.nightsCount]);

  // Cálculo do total ativo com ocupação por chalé (apenas quando houver chalé selecionado)
  const calculatedTotal = chaletsCount > 0
    ? calculateChaleTotal(
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
      )
    : 0;

  // Valor bruto (sem desconto) de acordo com a modalidade (individual ou casal) de cada chalé selecionado
  const selectedGrossTotal = useMemo(() => {
    if (chaletsCount === 0) return 0;
    let gross = 0;
    selectedChaleUnits.forEach(id => {
      const isCasal = (chaleOccupancies[id] || 'casal') !== 'individual';
      gross += isCasal ? stayPricing.totalCasalGross : stayPricing.totalIndividualGross;
    });
    const kidsList = chale.childrenAges || [];
    kidsList.forEach(age => {
      const rate = age === '12plus' ? 100 : 50;
      gross += rate * Math.max(1, stayPricing.nightsCount);
    });
    return gross;
  }, [selectedChaleUnits, chaleOccupancies, chaletsCount, stayPricing.totalCasalGross, stayPricing.totalIndividualGross, stayPricing.nightsCount, chale.childrenAges]);

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
    const newMap: Record<number, ('under11' | '12plus')[]> = {
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
                R$ 639 <span className="text-[10px] text-white/70">ind.</span> · R$ 819 <span className="text-[10px] text-white/70">casal</span>
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
          <div className="border-b border-slate-100 pb-2.5">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5 whitespace-nowrap">
              <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
              Selecione as Datas de Entrada e Saída da Hospedagem:
            </span>
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
                    className="w-full h-12 rounded-2xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between px-3 sm:px-4 gap-1.5 shadow-sm cursor-pointer transition-all select-none group"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 text-slate-950 font-black min-w-0">
                      <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-slate-950 font-black text-[11px] sm:text-sm truncate">
                        {format(checkInActive, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-[9.5px] sm:text-[10px] uppercase font-black text-slate-950 bg-amber-400 group-hover:bg-amber-500 px-2 sm:px-2.5 py-1 rounded-lg shadow-xs shrink-0 whitespace-nowrap">
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
                        const day = new Date(d);
                        day.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const minHosp = new Date('2026-11-19T00:00:00');
                        return day < today || day < minHosp || !isChaleCheckInDay(day);
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
                      <span className="leading-tight">Check-in às 15h (Combos na quinta às 09h)</span>
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
                    className="w-full h-12 rounded-2xl border-2 border-amber-500 bg-white hover:bg-amber-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-between px-3 sm:px-4 gap-1.5 shadow-sm cursor-pointer transition-all select-none group"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 text-slate-950 font-black min-w-0">
                      <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-slate-950 font-black text-[11px] sm:text-sm truncate">
                        {format(checkOutActive, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-[9.5px] sm:text-[10px] uppercase font-black text-slate-950 bg-amber-400 group-hover:bg-amber-500 px-2 sm:px-2.5 py-1 rounded-lg shadow-xs shrink-0 whitespace-nowrap">
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
                        const day = new Date(d);
                        day.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const minHosp = new Date('2026-11-19T00:00:00');
                        const inDayStart = new Date(checkInActive);
                        inDayStart.setHours(0, 0, 0, 0);
                        const maxOutStart = new Date(maxWeekendOutDate);
                        maxOutStart.setHours(0, 0, 0, 0);
                        const isAfterCheckIn = day > inDayStart;
                        const isWithinWeekend = day <= maxOutStart;
                        const isValidOperating = isChaleCheckOutDay(day);
                        return day < today || day < minHosp || !isAfterCheckIn || !isWithinWeekend || !isValidOperating;
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

          {/* ATALHOS RÁPIDOS: CATEGORIAS EXPANSÍVEIS (COMBOS PROMOCIONAIS vs DIÁRIAS AVULSAS) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-emerald-950 via-[#042817] to-slate-950 p-3 sm:p-3.5 rounded-2xl border-2 border-amber-400/80 shadow-md">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-amber-400 text-sm">⚡</span> Atalhos Rápidos de Seleção:
              </span>

              {/* As duas opções em destaque com cores fortes e texto entre parênteses na linha de baixo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setShortcutCategory(prev => prev === 'combos' ? null : 'combos')}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-all cursor-pointer select-none flex items-center justify-between gap-3 border-2 shadow-md",
                    shortcutCategory === 'combos'
                      ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-slate-950 border-white ring-2 ring-amber-300 scale-[1.02]"
                      : "bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 border-amber-300"
                  )}
                  title="Clique para ver ou ocultar os combos com 10% OFF"
                >
                  <div className="flex flex-col items-start text-left leading-tight">
                    <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
                      🔥 Combos Promocionais
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-950 text-amber-300 px-2 py-0.5 rounded-md mt-1">
                      (10% OFF)
                    </span>
                  </div>
                  {shortcutCategory === 'combos' ? (
                    <ChevronUp className="w-4 h-4 text-slate-950 stroke-[3] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-950 stroke-[3] shrink-0" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShortcutCategory(prev => prev === 'diarias' ? null : 'diarias')}
                  className={cn(
                    "px-4 py-2 rounded-xl transition-all cursor-pointer select-none flex items-center justify-between gap-3 border-2 shadow-md",
                    shortcutCategory === 'diarias'
                      ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white border-amber-300 ring-2 ring-amber-300 scale-[1.02]"
                      : "bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white border-emerald-400"
                  )}
                  title="Clique para ver ou ocultar as diárias avulsas de 1 noite"
                >
                  <div className="flex flex-col items-start text-left leading-tight">
                    <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
                      📅 Diárias Avulsas
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md mt-1">
                      (1 Noite)
                    </span>
                  </div>
                  {shortcutCategory === 'diarias' ? (
                    <ChevronUp className="w-4 h-4 text-amber-300 stroke-[3] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-amber-300 stroke-[3] shrink-0" />
                  )}
                </button>
              </div>
            </div>

            {/* SE CATEGORIA COMBOS EXPANDIDA */}
            {shortcutCategory === 'combos' && (
              <div className="space-y-2.5 p-3 sm:p-4 bg-amber-50/50 rounded-3xl border-2 border-amber-300/80 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                    <span>🔥</span> Escolha um dos 6 Combos Promocionais (10% de Desconto Exato):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShortcutCategory(null)}
                    className="text-[10px] font-black uppercase text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg cursor-pointer transition-all shadow-2xs"
                  >
                    ✕ Fechar Expansão
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* 1. Combo Sex a Dom (2 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-2n-sex-dom')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboSexDomActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">🔥 Sex a Dom</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(2 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 639 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 819 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 2. Combo Qui a Sáb (2 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-2n-qui-sab')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboQuiSabActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">🌿 Qui a Sáb</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(2 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 522 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 702 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 3. Combo Sáb a Seg (2 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-2n-sab-seg')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboSabSegActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">☀️ Sáb a Seg</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(2 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 531 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 711 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 4. Combo Qui a Dom (3 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-3n-qui-dom')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboQuiDomActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">🌴 Qui a Dom</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(3 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 855 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 1.125 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 5. Combo Sex a Seg (3 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-3n-sex-seg')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboSexSegActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">🚀 Sex a Seg</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(3 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 837 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 1.107 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 6. Combo Qui a Seg (4 Noites) */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('combo-4n-qui-seg')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isComboQuiSegActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col leading-tight">
                        <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">👑 Qui a Seg</span>
                        <span className="font-black text-[10.5px] uppercase text-emerald-950 mt-0.5 whitespace-nowrap">(4 Noites)</span>
                      </div>
                      <span className="text-[10px] bg-slate-950 text-amber-300 font-black px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">10% OFF</span>
                    </div>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 1.053 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 1.413 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* SE CATEGORIA DIÁRIAS EXPANDIDA */}
            {shortcutCategory === 'diarias' && (
              <div className="space-y-2.5 p-3 sm:p-4 bg-amber-50/50 rounded-3xl border-2 border-amber-300/80 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                  <span className="text-[11px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                    <span>📅</span> Escolha uma das 4 Diárias Avulsas (1 Noite):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShortcutCategory(null)}
                    className="text-[10px] font-black uppercase text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg cursor-pointer transition-all shadow-2xs"
                  >
                    ✕ Fechar Expansão
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* 1. Diária Quinta a Sexta */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('diaria-qui-sex')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      inDay === 4 && outDay === 5 && diffNights === 1
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">📅 Quinta a Sexta</span>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 240 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 340 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 2. Diária Sexta a Sábado */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('diaria-sex-sab')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isDiariaSexSabActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">📅 Sexta a Sábado</span>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 340 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 440 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 3. Diária Sábado a Domingo */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('diaria-sab-dom')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      isDiariaSabDomActive
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">☀️ Sábado a Domingo</span>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 370 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 470 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>

                  {/* 4. Diária Domingo a Segunda */}
                  <button
                    type="button"
                    onClick={() => handleSelectStayPreset('diaria-dom-seg')}
                    className={cn(
                      "p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-xs select-none flex flex-col justify-between gap-2",
                      inDay === 0 && outDay === 1 && diffNights === 1
                        ? "bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 font-black shadow-md scale-[1.02]"
                        : "bg-white text-slate-950 border-slate-300 hover:border-amber-400 hover:bg-amber-50/50"
                    )}
                  >
                    <span className="font-black text-xs uppercase text-slate-950 whitespace-nowrap">🌙 Domingo a Segunda</span>
                    <div className="pt-2 border-t border-slate-950/15 flex items-center justify-between text-xs font-black">
                      <span className="text-slate-950">R$ 220 <span className="text-[10.5px] text-slate-900 font-extrabold">ind.</span></span>
                      <span className="text-slate-950">R$ 320 <span className="text-[10.5px] text-slate-900 font-extrabold">casal</span></span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: SELEÇÃO DO(S) CHALÉ(S) NO TOPO (ENTRE DATAS E OCUPAÇÃO) */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5 sm:whitespace-nowrap">
                <Home className="w-4 h-4 text-emerald-700 shrink-0" />
                Selecione o(s) Chalé(s) Desejado(s) para sua Reserva:
              </span>
              {chaletsCount > 0 && (
                <span className="text-[10.5px] sm:text-[11px] font-black text-slate-950 bg-amber-400 border border-amber-500 px-2.5 sm:px-3 py-1 rounded-xl shadow-xs shrink-0 max-w-full truncate">
                  ✓ {chaletsCount} {chaletsCount === 1 ? 'Chalé Selecionado' : 'Chalés Selecionados'}: {selectedChaleUnits.map(id => `Chalé ${String(id).padStart(2, '0')}`).join(', ')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-800 font-bold sm:whitespace-nowrap leading-snug">
              Você pode selecionar 1 ou mais chalés para acomodar amigos ou familiares na mesma reserva!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {readyUnits.map((unit) => {
              const isUnitSelected = selectedChaleUnits.includes(unit.id);
              const status = getUnitStatus(unit.id);
              const isOccupied = status.isOccupied;
              const isMaintenance = status.isMaintenance;

              return (
                <div
                  key={unit.id}
                  onClick={() => handleToggleUnitSelection(unit.id, isOccupied, isMaintenance)}
                  className={cn(
                    "p-3 sm:p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between min-h-[115px] sm:min-h-[125px] select-none shadow-md",
                    isMaintenance
                      ? "opacity-65 bg-[#241b0b] border-amber-700/70 cursor-not-allowed text-amber-200"
                      : isOccupied
                        ? "opacity-50 bg-[#1f1315] border-red-900/60 cursor-not-allowed text-red-200"
                        : isUnitSelected
                          ? "bg-gradient-to-br from-amber-400 via-amber-300 to-amber-500 text-slate-950 border-amber-200 shadow-xl scale-[1.03] cursor-pointer ring-2 ring-amber-400/50"
                          : "bg-gradient-to-b from-[#063321] to-[#032014] text-white border-emerald-700/60 hover:border-amber-400 hover:shadow-lg hover:scale-[1.02] cursor-pointer group"
                  )}
                >
                  <div className={cn(
                    "absolute -top-2.5 -right-2 font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md border flex items-center gap-1 z-10",
                    isMaintenance
                      ? "bg-amber-400 text-slate-950 border-amber-300"
                      : isOccupied
                        ? "bg-red-600 text-white border-red-500"
                        : isUnitSelected
                          ? "bg-slate-950 text-amber-300 border-slate-800"
                          : "bg-emerald-500 text-emerald-950 border-emerald-300"
                  )}>
                    {isMaintenance ? (
                      <AlertTriangle className="w-2.5 h-2.5" />
                    ) : isOccupied ? (
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
                        isMaintenance ? "text-amber-300" : isOccupied ? "text-red-300" : isUnitSelected ? "text-slate-950" : "text-white group-hover:text-amber-300"
                      )}>
                        Chalé {String(unit.id).padStart(2, '0')}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block tracking-wider",
                      isMaintenance
                        ? "bg-amber-950/70 text-amber-300 border border-amber-700/50"
                        : isOccupied
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
                      isMaintenance
                        ? "text-amber-300/90"
                        : isOccupied
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
          {readyUnits.every((unit) => getUnitStatus(unit.id).isOccupied) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Todos os chalés estão indisponíveis ou bloqueados para manutenção no momento.</span>
            </div>
          )}
        </div>

        {/* ROW 3: CONFIGURAÇÃO AGRUPADA POR CHALÉ (MODALIDADE + ADICIONAL DE CRIANÇAS LADO A LADO) */}
        <div id="chale-guests-section" className="space-y-4 pt-3 border-t border-slate-100">
          {chaletsCount > 0 && (
            <>
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
            {selectedChaleUnits.map((chaleId, unitIdx) => {
              const isChaleCasal = chaleOccupancies[chaleId] !== 'individual';
              const kidsList = chaleKidsMap[chaleId] || [];
              const kidsCount = kidsList.length;

              const stayNights = Math.max(1, stayPricing?.nightsCount || 1);
              const isComboStay = stayNights >= 2;
              const kidUnder11Price = isComboStay ? (stayNights * 45) : (stayNights * 50);
              const kid12PlusPrice = isComboStay ? (stayNights * 90) : (stayNights * 100);

              // Preço específico deste chalé (adulto conforme ocupação casal/individual + crianças deste chalé)
              const chaleAdultPrice = isChaleCasal ? stayPricing.totalCasal : stayPricing.totalIndividual;
              const chaleKidsPrice = kidsList.reduce((acc, age) => {
                return acc + (age === '12plus' ? kid12PlusPrice : kidUnder11Price);
              }, 0);
              const thisChaleTotal = chaleAdultPrice + chaleKidsPrice;

              // Calculate adult index for this chalet
              const baseAdultIdx = selectedChaleUnits.slice(0, unitIdx).reduce((acc, prevId) => {
                return acc + (chaleOccupancies[prevId] === 'individual' ? 1 : 2);
              }, 0);

              // Calculate kid offset for this chalet
              const baseKidOffset = selectedChaleUnits.slice(0, unitIdx).reduce((acc, prevId) => {
                return acc + (chaleKidsMap[prevId]?.length || 0);
              }, 0);

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
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Total deste chalé</span>
                        <span className="font-sans font-black text-sm text-emerald-950 block">
                          {formatCurrency(thisChaleTotal)}
                        </span>
                      </div>
                      <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase px-2 py-0.5 shadow-2xs">
                        {isChaleCasal ? '👥 Casal' : '👤 Individual'}
                      </Badge>
                    </div>
                  </div>

                  {/* Lado a Lado: Ocupação do Chalé e Adicionais de Crianças */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                    {/* Lado Esquerdo: Ocupação (Casal vs Individual) */}
                    <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[10.5px] font-black uppercase text-slate-700 block">
                          Modalidade de Ocupação:
                        </span>
                        <span className="text-[9.5px] text-slate-800 font-bold block mt-0.5">
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
                            Até 11 anos: R$ {kidUnder11Price} · 12+ anos: R$ {kid12PlusPrice} ({stayNights} noite{stayNights > 1 ? 's' : ''})
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
                            <div key={`chale-${chaleId}-kid-${kidIdx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                              <span className="text-[10px] font-black text-slate-800 shrink-0">
                                Criança {kidIdx + 1}:
                              </span>
                              <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChaleChildAge(chaleId, kidIdx, 'under11')}
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition-all border cursor-pointer text-center whitespace-nowrap",
                                    kAge === 'under11'
                                      ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  )}
                                >
                                  Até 11 anos (+ R$ {kidUnder11Price})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChaleChildAge(chaleId, kidIdx, '12plus')}
                                  className={cn(
                                    "px-2 py-1 rounded-lg text-[9.5px] sm:text-[10px] font-black transition-all border cursor-pointer text-center whitespace-nowrap",
                                    kAge === '12plus'
                                      ? "bg-amber-400 text-slate-950 border-amber-500 shadow-2xs"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                  )}
                                >
                                  12+ anos (+ R$ {kid12PlusPrice})
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

                  {/* NOMES DOS HÓSPEDES DESTE CHALÉ (ADULTOS E CRIANÇAS) DENTRO DO MESMO CARD */}
                  <div data-chale-names-box="true" className="pt-3 border-t border-emerald-100 space-y-2.5 bg-emerald-50/40 p-3 sm:p-3.5 rounded-xl border border-emerald-200/70">
                    <span className="text-[11px] font-black uppercase text-emerald-950 flex items-center gap-1.5">
                      <span>✍️</span> Hóspedes do Chalé {String(chaleId).padStart(2, '0')}:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-800 block">
                          Adulto 1 - Titular do Chalé {String(chaleId).padStart(2, '0')}:
                        </label>
                        <Input
                          placeholder="Nome completo do titular..."
                          value={(chale.guestNames && chale.guestNames[baseAdultIdx]) || ''}
                          onChange={(e) => handleUpdateGuestName(baseAdultIdx, e.target.value)}
                          className="bg-white border-2 border-slate-300 h-10 rounded-xl text-xs font-bold text-slate-900 focus-visible:ring-emerald-600 shadow-xs"
                        />
                      </div>

                      {isChaleCasal && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-800 block">
                            Adulto 2 - Acompanhante do Chalé {String(chaleId).padStart(2, '0')}:
                          </label>
                          <Input
                            placeholder="Nome completo do acompanhante..."
                            value={(chale.guestNames && chale.guestNames[baseAdultIdx + 1]) || ''}
                            onChange={(e) => handleUpdateGuestName(baseAdultIdx + 1, e.target.value)}
                            className="bg-white border-2 border-slate-300 h-10 rounded-xl text-xs font-bold text-slate-900 focus-visible:ring-emerald-600 shadow-xs"
                          />
                        </div>
                      )}

                      {kidsList.length > 0 && (
                        <div className="col-span-1 sm:col-span-2 space-y-2 pt-2 border-t border-amber-200/80">
                          <span className="text-[10px] font-black uppercase text-amber-950 block">
                            👶 Crianças deste chalé ({kidsList.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {kidsList.map((age, kIdx) => {
                              const kidSlotIdx = currentAdults + baseKidOffset + kIdx;
                              const ageLabel = age === '12plus' ? `12+ anos (+ R$ ${kid12PlusPrice})` : `Até 11 anos (+ R$ ${kidUnder11Price})`;
                              return (
                                <div key={`chale-${chaleId}-kid-name-${kIdx}`} className="space-y-1">
                                  <label className="text-[11px] font-bold text-slate-800 block">
                                    Criança {kIdx + 1} ({ageLabel}):
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
                  </div>

                </div>
              );
            })}
              </div>
            </>
          )}

          {/* AVISO IMPORTANTE: OCUPANDO TODA A LARGURA (FULL WIDTH) ABAIXO DOS CHALÉS */}
          <div className="w-full bg-amber-50/90 border-2 border-amber-300 p-3.5 sm:p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-950 leading-relaxed shadow-xs mt-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block uppercase text-xs text-amber-900 tracking-wider mb-0.5">
                ⚠️ Importante sobre Adicional de Crianças:
              </span>
              <span className="font-bold">
                O adicional de crianças é exclusivo e permitido apenas para filhos dos hóspedes
              </span>
            </div>
          </div>
        </div>

        {/* ROW 5: RESUMO DA HOSPEDAGEM SELECIONADA (DETALHADO COM MODALIDADE E ADICIONAIS) */}
        <div className="bg-gradient-to-br from-emerald-950 via-[#032817] to-slate-950 text-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-600 shadow-lg">
          <div className="bg-emerald-900/90 rounded-2xl p-3.5 sm:p-4 border border-emerald-700 flex flex-col gap-3 text-white shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  {format(checkInActive, "dd/MM (EEEE)", { locale: ptBR })} às {stayPricing.checkInHour} ➔ {format(checkOutActive, "dd/MM (EEEE)", { locale: ptBR })} às 12h
                  {chaletsCount > 0 ? ` · ${chaletsCount} Chalé${chaletsCount > 1 ? 's' : ''} · ${currentAdults} Adulto(s)${chale.childrenCount ? ` + ${chale.childrenCount} Criança(s)` : ''}` : ' · Nenhum chalé selecionado'}
                </p>
              </div>

              <div className="text-center sm:text-right shrink-0">
                {chaletsCount > 0 ? (
                  <>
                    <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                      {stayPricing.discountPct > 0 ? (
                        <span>De <span className="line-through text-emerald-400/80">{formatCurrency(selectedGrossTotal)}</span> com 10% OFF:</span>
                      ) : (
                        'Valor Total da Hospedagem:'
                      )}
                    </span>
                    <span className="font-sans font-black text-2xl sm:text-3xl text-amber-400">
                      {formatCurrency(calculatedTotal)}
                    </span>
                  </>
                ) : (
                  <div className="bg-emerald-950/80 border border-emerald-700/80 px-3 py-2 rounded-xl text-left sm:text-right space-y-0.5">
                    <span className="text-[10px] font-black uppercase text-amber-300 block">Valores de Referência do Período:</span>
                    <span className="text-xs font-bold text-emerald-100 block">
                      👤 Individual: {stayPricing.discountPct > 0 ? <><span className="line-through opacity-70">{formatCurrency(stayPricing.totalIndividualGross)}</span> <strong className="text-amber-400">{formatCurrency(stayPricing.totalIndividual)}</strong></> : <strong className="text-amber-400">{formatCurrency(stayPricing.totalIndividual)}</strong>}
                    </span>
                    <span className="text-xs font-bold text-emerald-100 block">
                      👥 Casal: {stayPricing.discountPct > 0 ? <><span className="line-through opacity-70">{formatCurrency(stayPricing.totalCasalGross)}</span> <strong className="text-amber-400">{formatCurrency(stayPricing.totalCasal)}</strong></> : <strong className="text-amber-400">{formatCurrency(stayPricing.totalCasal)}</strong>}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhamento de Modalidade e Adicionais por Chalé Selecionado */}
            {chaletsCount > 0 && (
              <div className="pt-2.5 border-t border-emerald-700/80 space-y-1.5 text-xs">
                {selectedChaleUnits.map((id) => {
                  const isCasal = (chaleOccupancies[id] || 'casal') !== 'individual';
                  const kidsForThis = chaleKidsMap[id] || [];
                  const stayNights = Math.max(1, stayPricing.nightsCount || 1);
                  const isComboStay = stayNights >= 2;
                  const adultGross = isCasal ? stayPricing.totalCasalGross : stayPricing.totalIndividualGross;
                  const adultNet = isCasal ? stayPricing.totalCasal : stayPricing.totalIndividual;

                  return (
                    <div key={`summary-chale-${id}`} className="bg-emerald-950/70 border border-emerald-800/80 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-amber-300 uppercase">
                          🏡 Chalé {String(id).padStart(2, '0')}:
                        </span>
                        <span className="font-bold text-white">
                          Modalidade {isCasal ? 'Casal (2 Adultos)' : 'Individual (1 Adulto)'}:{' '}
                          {isComboStay ? (
                            <span>
                              De <span className="line-through text-emerald-300/70">{formatCurrency(adultGross)}</span> por <strong className="text-amber-300">{formatCurrency(adultNet)}</strong>
                            </span>
                          ) : (
                            <strong className="text-amber-300">{formatCurrency(adultNet)}</strong>
                          )}
                        </span>
                        {kidsForThis.length > 0 ? (
                          <span className="font-bold text-emerald-200">
                            · Adicionais ({kidsForThis.length} Criança{kidsForThis.length > 1 ? 's' : ''}):{' '}
                            {kidsForThis.map((age, kIdx) => {
                              const kGross = (age === '12plus' ? 100 : 50) * stayNights;
                              const kNet = (age === '12plus' ? (isComboStay ? 90 : 100) : (isComboStay ? 45 : 50)) * stayNights;
                              const label = age === '12plus' ? '12+ anos' : 'até 11 anos';
                              return (
                                <span key={kIdx}>
                                  {kIdx > 0 ? ' + ' : ''}1 Criança ({label}):{' '}
                                  {isComboStay ? (
                                    <span>De <span className="line-through text-emerald-300/70">{formatCurrency(kGross)}</span> por <strong className="text-amber-300">{formatCurrency(kNet)}</strong></span>
                                  ) : (
                                    <strong className="text-amber-300">{formatCurrency(kNet)}</strong>
                                  )}
                                </span>
                              );
                            })}
                          </span>
                        ) : (
                          <span className="text-emerald-300/80 font-medium">· Sem adicionais de crianças</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ROW 6: CAIXA DE ASSINATURA DOS TERMOS DE HOSPEDAGEM (Abaixo do Resumo da Hospedagem Selecionada) */}
        <div
          id="chale-terms-box"
          className={cn(
            "rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-[#041f12] to-slate-950 text-white border-2 transition-all shadow-xl space-y-4",
            chale.termsAccepted
              ? "border-amber-400 ring-2 ring-amber-400/20"
              : "border-emerald-600"
          )}
        >
          {/* TOPO: Confirmação da Reserva + Botão para Expandir / Ler Termos */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/15 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={cn("w-5 h-5 shrink-0", chale.termsAccepted ? "text-emerald-400" : "text-amber-400")} />
              <span className="text-xs sm:text-sm font-black text-white">
                Confirmação da reserva
              </span>
              {chale.termsAccepted && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  ✓ Aceito
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsTermsExpanded(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-1.5 rounded-full transition-all cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              {isTermsExpanded ? 'Ocultar Termos Completos' : 'Ler Termos Completos'}
            </button>
          </div>

          {/* CHECKBOX E DECLARAÇÃO LEGAL (APENAS A LINHA DE ACEITE) */}
          <label className="flex items-center gap-3 cursor-pointer select-none group py-1">
            <input
              type="checkbox"
              checked={Boolean(chale.termsAccepted)}
              onChange={(e) => {
                const checked = e.target.checked;
                onUpdate({
                  termsAccepted: checked,
                  termsAcceptedAt: checked ? new Date().toISOString() : null,
                  termsVersion: CHALE_TERMS_VERSION
                });
              }}
              className="w-5 h-5 rounded-md border-2 border-amber-400 accent-amber-400 cursor-pointer shrink-0"
            />
            <p className="font-bold text-white text-xs sm:text-sm group-hover:text-amber-200 transition-colors">
              Li e aceito os{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsTermsExpanded(prev => !prev);
                }}
                className="font-black text-amber-300 underline underline-offset-2 hover:text-amber-200 inline cursor-pointer"
              >
                Termos e Condições de Hospedagem do Balneário Lessa
              </button>
              .
            </p>
          </label>

          {/* ABA EXPANSÍVEL: LEIA O TERMO COMPLETO (VISUALIZAÇÃO COMPLETA DIRETO NA PÁGINA) */}
          {isTermsExpanded && (
            <div className="pt-3 border-t border-white/15 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-2 bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-700/60 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Regulamento Completo de Hospedagem ({CHALE_TERMS_VERSION})
                </span>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="text-[10px] font-bold text-white/90 hover:text-white underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3" /> Abrir em Janela / Imprimir
                </button>
              </div>

              <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 border-2 border-emerald-300 max-h-96 overflow-y-auto shadow-inner text-xs sm:text-sm">
                <ChaleTermsFullContent />
              </div>
            </div>
          )}
        </div>

        {/* Modal complementar se quiser ver em tela cheia / imprimir */}
        <ChaleTermsModal
          open={isTermsModalOpen}
          onOpenChange={setIsTermsModalOpen}
          onAccept={() => {
            onUpdate({
              termsAccepted: true,
              termsAcceptedAt: new Date().toISOString(),
              termsVersion: CHALE_TERMS_VERSION
            });
          }}
        />

      </div>

    </div>
  );
}

export function ChaleSelector(props: Props) {
  return (
    <ChaleErrorBoundary>
      <ChaleSelectorInner {...props} />
    </ChaleErrorBoundary>
  );
}
