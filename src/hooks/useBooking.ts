import { useState, useCallback, useMemo } from 'react';
import {
  BookingState, ChildInfo, AdultInfo, KioskItem, QuadItem, AdditionalItem,
  ChaleBooking, CampingBooking, CHALE_PACKAGES, CAMPING_PRICE_PER_PERSON,
  KIOSK_INFO, ADDITIONAL_INFO,
  getQuadDiscount, calculateEntryTotal, calculateChaleTotal, calculateChaleGrossTotal
} from '@/lib/booking-types';
import { useServices } from '@/hooks/useServices';

const initialState: BookingState = {
  entry: {
    name: '',
    lastName: '',
    phone: '',
    cpf: '',
    email: '',
    visitDate: null,
    adults: [],
    children: [],
    dayOfWeek: 'sabado',
  },
  kiosks: [
    { type: 'maior',    quantity: 0, date: null },
    { type: 'menor',    quantity: 0, date: null },
    { type: 'familiar', quantity: 0, date: null },
  ],
  quads: [
    { type: 'individual', quantity: 0, date: null, time: null },
    { type: 'dupla', quantity: 0, date: null, time: null },
  ],
  additionals: [
    { type: 'pesca', quantity: 0 },
    { type: 'futebol-sabao', quantity: 0 },
  ],
  chale: {
    packageType: null,
    chaleId: null,
    chaleIds: [],
    adultsCount: 0,
    childrenCount: 0,
    checkInDate: null,
    checkOutDate: null,
    notes: '',
  },
  camping: {
    peopleCount: 0,
    date: null,
    notes: '',
  },
};

export function useBooking() {
  const [booking, setBooking] = useState<BookingState>(initialState);

  const updateEntry = useCallback((updates: Partial<BookingState['entry']>) => {
    setBooking(prev => {
      const newEntry = { ...prev.entry, ...updates };
      
      // If visitDate changed, sync it to all extras to ensure they match (as requested by user)
      let newKiosks = prev.kiosks;
      let newQuads = prev.quads;
      
      if (updates.visitDate) {
        newKiosks = prev.kiosks.map(k => ({ ...k, date: updates.visitDate }));
        newQuads = prev.quads.map(q => ({ ...q, date: updates.visitDate }));
      }
      
      return {
        ...prev,
        entry: newEntry,
        kiosks: newKiosks,
        quads: newQuads
      };
    });
  }, []);

  const addAdult = useCallback(() => {
    setBooking(prev => ({
      ...prev,
      entry: { ...prev.entry, adults: [...prev.entry.adults, { age: 30, takeDonation: false }] },
    }));
  }, []);

  const removeAdult = useCallback((index: number) => {
    setBooking(prev => ({
      ...prev,
      entry: { ...prev.entry, adults: prev.entry.adults.filter((_, i) => i !== index) },
    }));
  }, []);

  const updateAdult = useCallback((index: number, updates: Partial<AdultInfo>) => {
    setBooking(prev => ({
      ...prev,
      entry: {
        ...prev.entry,
        adults: prev.entry.adults.map((a, i) => i === index ? { ...a, ...updates } : a),
      },
    }));
  }, []);

  const addChild = useCallback(() => {
    setBooking(prev => ({
      ...prev,
      entry: { ...prev.entry, children: [...prev.entry.children, { age: 0, takeDonation: false }] },
    }));
  }, []);

  const removeChild = useCallback((index: number) => {
    setBooking(prev => ({
      ...prev,
      entry: { ...prev.entry, children: prev.entry.children.filter((_, i) => i !== index) },
    }));
  }, []);

  const updateChild = useCallback((index: number, updates: Partial<ChildInfo>) => {
    setBooking(prev => ({
      ...prev,
      entry: {
        ...prev.entry,
        children: prev.entry.children.map((c, i) => i === index ? { ...c, ...updates } : c),
      },
    }));
  }, []);

  const updateKiosk = useCallback((index: number, updates: Partial<KioskItem>) => {
    setBooking(prev => ({
      ...prev,
      kiosks: prev.kiosks.map((k, i) => i === index ? { ...k, ...updates } : k),
    }));
  }, []);

  const setQuads = useCallback((newQuads: QuadItem[]) => {
    setBooking(prev => ({
      ...prev,
      quads: newQuads,
    }));
  }, []);

  const addQuad = useCallback((quad: QuadItem) => {
    setBooking(prev => ({
      ...prev,
      quads: [...prev.quads, quad]
    }));
  }, []);

  const removeQuad = useCallback((index: number) => {
    setBooking(prev => ({
      ...prev,
      quads: prev.quads.filter((_, i) => i !== index)
    }));
  }, []);

  const updateQuad = useCallback((index: number, updates: Partial<QuadItem>) => {
    setBooking(prev => ({
      ...prev,
      quads: prev.quads.map((q, i) => i === index ? { ...q, ...updates } : q),
    }));
  }, []);

  const updateAdditional = useCallback((index: number, updates: Partial<AdditionalItem>) => {
    setBooking(prev => ({
      ...prev,
      additionals: prev.additionals.map((a, i) => i === index ? { ...a, ...updates } : a),
    }));
  }, []);

  const updateChale = useCallback((updates: Partial<ChaleBooking>) => {
    setBooking(prev => {
      const mergedIds = updates.chaleIds !== undefined ? updates.chaleIds : prev.chale.chaleIds;
      const mergedId = updates.chaleId !== undefined ? updates.chaleId : prev.chale.chaleId;
      const chaletsCount = (mergedIds && mergedIds.length > 0)
        ? mergedIds.length
        : (mergedId ? 1 : 0);
      const maxAllowedAdults = chaletsCount * 2;
      const nextAdults = updates.adultsCount !== undefined
        ? (chaletsCount === 0 ? 0 : Math.min(maxAllowedAdults, Math.max(1, updates.adultsCount)))
        : prev.chale.adultsCount;
      return {
        ...prev,
        chale: {
          ...prev.chale,
          ...updates,
          adultsCount: nextAdults
        },
      };
    });
  }, []);

  const resetOptionalServices = useCallback(() => {
    setBooking(prev => {
      const vDate = prev.entry.visitDate || prev.chale.checkInDate || null;
      return {
        ...prev,
        kiosks: [
          { type: 'maior', quantity: 0, date: vDate },
          { type: 'menor', quantity: 0, date: vDate },
          { type: 'familiar', quantity: 0, date: vDate },
        ],
        quads: [
          { type: 'individual', quantity: 0, date: vDate, time: null },
          { type: 'dupla', quantity: 0, date: vDate, time: null },
        ],
        additionals: [
          { type: 'pesca', quantity: 0 },
          { type: 'futebol-sabao', quantity: 0 },
        ]
      };
    });
  }, []);

  const updateCamping = useCallback((updates: Partial<CampingBooking>) => {
    setBooking(prev => ({
      ...prev,
      camping: { ...prev.camping, ...updates },
    }));
  }, []);

  const { getPrice, isLoading } = useServices();

  const totals = useMemo(() => {
    if (isLoading) return { entriesTotal: 0, kiosksTotal: 0, quadsTotal: 0, additionalsTotal: 0, chaleTotal: 0, campingTotal: 0, subtotal: 0, onlineDiscount: 0, total: 0 };
    const entriesTotal = calculateEntryTotal(booking.entry, getPrice);
    
    // Kiosks fallback map
    const kiosksFallback: Record<string, number> = { maior: 150, menor: 100, familiar: 75 };
    const kiosksTotal = booking.kiosks.reduce((sum, k) => sum + k.quantity * getPrice(`kiosk_${k.type}`, kiosksFallback[k.type] ?? 75), 0);
    
    // Quads fallback map (Retomada oficial: Individual R$ 130, Dupla R$ 195)
    // O valor integral entra no subtotal e o desconto de 10% é aplicado no resumo geral
    const quadFallback: Record<string, number> = { individual: 130, dupla: 195, 'adulto-crianca': 195 };
    const quadsTotal = booking.quads.reduce((sum, q) => {
      if (q.quantity <= 0) return sum;
      const base = getPrice(`quad_${q.type}`, quadFallback[q.type] ?? 130);
      return sum + q.quantity * base;
    }, 0);
    
    // Additionals fallback map
    const addsFallback: Record<string, number> = { pesca: 20, 'futebol-sabao': 10 };
    const additionalsTotal = booking.additionals.reduce((sum, a) => sum + a.quantity * getPrice(`add_${a.type}`, addsFallback[a.type]), 0);
    
    // Chalés calculation (somente quando ao menos 1 chalé estiver selecionado)
    let chaleTotal = 0;
    let chaleGrossTotal = 0;
    const selectedChalesCount = (booking.chale.chaleIds && booking.chale.chaleIds.length > 0)
      ? booking.chale.chaleIds.length
      : (booking.chale.chaleId ? 1 : 0);

    if (booking.chale.packageType && selectedChalesCount > 0) {
      const effectiveIds = (booking.chale.chaleIds && booking.chale.chaleIds.length > 0)
        ? booking.chale.chaleIds
        : (booking.chale.chaleId ? [booking.chale.chaleId] : []);
      chaleTotal = calculateChaleTotal(
        booking.chale.packageType,
        booking.chale.adultsCount,
        booking.chale.childrenCount || 0,
        getPrice,
        true,
        selectedChalesCount,
        booking.chale.checkInDate,
        booking.chale.checkOutDate,
        booking.chale.chaleOccupancies,
        effectiveIds,
        booking.chale.childrenAges
      );
      chaleGrossTotal = calculateChaleGrossTotal(
        booking.chale.packageType,
        booking.chale.adultsCount,
        booking.chale.childrenCount || 0,
        selectedChalesCount,
        booking.chale.checkInDate,
        booking.chale.checkOutDate,
        booking.chale.chaleOccupancies,
        effectiveIds,
        booking.chale.childrenAges
      );
    }

    // Camping calculation: R$ 100 por pessoa pagante (crianças até 11 anos e idosos 60+ têm gratuidade)
    const payingCampers = booking.camping.adultsCount !== undefined
      ? booking.camping.adultsCount
      : (booking.camping.peopleCount || 0);
    const campingTotal = payingCampers * getPrice('camping_per_person', CAMPING_PRICE_PER_PERSON);

    // Demais serviços têm 10% de desconto online; chalés já têm a regra oficial (10% nos combos de 2+ noites, 0% nas diárias avulsas)
    const otherGross = Math.round((entriesTotal + kiosksTotal + quadsTotal + additionalsTotal + campingTotal) * 100) / 100;
    const otherDiscount = otherGross > 0 ? Math.round(otherGross * 0.10 * 100) / 100 : 0;
    const chaleDiscount = Math.max(0, Math.round((chaleGrossTotal - chaleTotal) * 100) / 100);

    const subtotal = Math.round((otherGross + chaleGrossTotal) * 100) / 100;
    const onlineDiscount = Math.round((otherDiscount + chaleDiscount) * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - onlineDiscount) * 100) / 100);

    return { 
      entriesTotal, 
      kiosksTotal, 
      quadsTotal, 
      additionalsTotal, 
      chaleTotal,
      campingTotal,
      subtotal, 
      onlineDiscount, 
      total 
    };
  }, [booking, getPrice, isLoading]);

  const hasItems = useMemo(() => {
    return booking.entry.adults.length > 0 ||
      booking.entry.children.length > 0 ||
      booking.kiosks.some(k => k.quantity > 0) ||
      booking.quads.some(q => q.quantity > 0) ||
      booking.additionals.some(a => a.quantity > 0) ||
      (booking.chale.packageType !== null && ((booking.chale.chaleIds && booking.chale.chaleIds.length > 0) || booking.chale.chaleId !== null)) ||
      (booking.camping.peopleCount || 0) > 0;
  }, [booking]);

  return { booking, updateEntry, addAdult, removeAdult, updateAdult, addChild, removeChild, updateChild, updateKiosk, updateQuad, addQuad, removeQuad, setQuads, updateAdditional, updateChale, updateCamping, resetOptionalServices, totals, hasItems, getPrice, isLoading };
}
