import { useState, useCallback, useMemo } from 'react';
import {
  BookingState, ChildInfo, AdultInfo, KioskItem, QuadItem, AdditionalItem,
  KIOSK_INFO, QUAD_PRICES, ADDITIONAL_INFO,
  getQuadDiscount, calculateEntryTotal,
} from '@/lib/booking-types';

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

  const totals = useMemo(() => {
    const entriesTotal = calculateEntryTotal(booking.entry);
    const kiosksTotal = booking.kiosks.reduce((sum, k) => sum + k.quantity * KIOSK_INFO[k.type].price, 0);
    const quadsTotal = booking.quads.reduce((sum, q) => {
      const base = q.quantity * QUAD_PRICES[q.type];
      const discount = getQuadDiscount(q.date);
      return sum + base * (1 - discount);
    }, 0);
    const additionalsTotal = booking.additionals.reduce((sum, a) => sum + a.quantity * ADDITIONAL_INFO[a.type].price, 0);
    return { entriesTotal, kiosksTotal, quadsTotal, additionalsTotal, total: entriesTotal + kiosksTotal + quadsTotal + additionalsTotal };
  }, [booking]);

  const hasItems = useMemo(() => {
    return booking.entry.adults.length > 0 ||
      booking.entry.children.length > 0 ||
      booking.kiosks.some(k => k.quantity > 0) ||
      booking.quads.some(q => q.quantity > 0) ||
      booking.additionals.some(a => a.quantity > 0);
  }, [booking]);

  return { booking, updateEntry, addAdult, removeAdult, updateAdult, addChild, removeChild, updateChild, updateKiosk, updateQuad, updateAdditional, totals, hasItems };
}
