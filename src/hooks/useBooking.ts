import { useState, useCallback, useMemo } from 'react';
import {
  BookingState, ChildInfo, AdultInfo, KioskItem, QuadItem, AdditionalItem,
  KIOSK_INFO, ADDITIONAL_INFO,
  getQuadDiscount, calculateEntryTotal,
} from '@/lib/booking-types';
import { useServices } from '@/hooks/useServices';

const initialState: BookingState = {
  entry: {
    name: '',
    phone: '',
    visitDate: null,
    adults: [],
    children: [],
    dayOfWeek: 'sabado',
  },
  kiosks: [
    { type: 'menor', quantity: 0, date: null },
    { type: 'maior', quantity: 0, date: null },
  ],
  quads: [
    { type: 'individual', quantity: 0, date: null, time: null },
    { type: 'dupla', quantity: 0, date: null, time: null },
    { type: 'adulto-crianca', quantity: 0, date: null, time: null },
  ],
  additionals: [
    { type: 'pesca', quantity: 0 },
    { type: 'futebol-sabao', quantity: 0 },
  ],
};

export function useBooking() {
  const [booking, setBooking] = useState<BookingState>(initialState);

  const updateEntry = useCallback((updates: Partial<BookingState['entry']>) => {
    setBooking(prev => ({
      ...prev,
      entry: { ...prev.entry, ...updates },
    }));
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

  const { getPrice, isLoading } = useServices();

  const totals = useMemo(() => {
    if (isLoading) return { entriesTotal: 0, kiosksTotal: 0, quadsTotal: 0, additionalsTotal: 0, total: 0 };
    const entriesTotal = calculateEntryTotal(booking.entry, getPrice);
    
    // Kiosks fallback map
    const kiosksFallback: Record<string, number> = { menor: 75, maior: 100 };
    const kiosksTotal = booking.kiosks.reduce((sum, k) => sum + k.quantity * getPrice(`kiosk_${k.type}`, kiosksFallback[k.type]), 0);
    
    // Quads fallback map
    const quadsFallback: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
    const quadsTotal = booking.quads.reduce((sum, q) => {
      const base = q.quantity * getPrice(`quad_${q.type}`, quadsFallback[q.type]);
      const discount = getQuadDiscount(q.date);
      return sum + base * (1 - discount);
    }, 0);
    
    // Additionals fallback map
    const addsFallback: Record<string, number> = { pesca: 20, 'futebol-sabao': 10 };
    const additionalsTotal = booking.additionals.reduce((sum, a) => sum + a.quantity * getPrice(`add_${a.type}`, addsFallback[a.type]), 0);
    
    return { entriesTotal, kiosksTotal, quadsTotal, additionalsTotal, total: entriesTotal + kiosksTotal + quadsTotal + additionalsTotal };
  }, [booking, getPrice, isLoading]);

  const hasItems = useMemo(() => {
    return booking.entry.adults.length > 0 ||
      booking.entry.children.length > 0 ||
      booking.kiosks.some(k => k.quantity > 0) ||
      booking.quads.some(q => q.quantity > 0) ||
      booking.additionals.some(a => a.quantity > 0);
  }, [booking]);

  return { booking, updateEntry, addAdult, removeAdult, updateAdult, addChild, removeChild, updateChild, updateKiosk, updateQuad, updateAdditional, totals, hasItems, getPrice, isLoading };
}
