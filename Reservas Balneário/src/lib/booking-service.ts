import { supabase } from '@/integrations/supabase/client';
import { BookingState } from '@/lib/booking-types';
import { format } from 'date-fns';

export interface SaveBookingResult {
  id: string;
  confirmationCode: string;
}

export async function saveBooking(booking: BookingState, totalAmount: number): Promise<SaveBookingResult | null> {
  const { entry } = booking;
  
  if (!entry.name || !entry.visitDate) return null;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      name: entry.name.trim().slice(0, 200),
      phone: entry.phone?.trim().slice(0, 20) || null,
      visit_date: format(entry.visitDate, 'yyyy-MM-dd'),
      adults: entry.adults.length,
      children: entry.children as any,
      has_donation: entry.hasDonation,
      is_associado: entry.isAssociado,
      kiosks: booking.kiosks.filter(k => k.quantity > 0) as any,
      quads: booking.quads.filter(q => q.quantity > 0) as any,
      additionals: booking.additionals.filter(a => a.quantity > 0) as any,
      total_amount: totalAmount,
    })
    .select('id, confirmation_code')
    .single();

  if (error) {
    console.error('Error saving booking:', error);
    return null;
  }

  // Save quad reservations for slot tracking
  const activeQuads = booking.quads.filter(q => q.quantity > 0 && q.date && q.time);
  if (activeQuads.length > 0 && data) {
    const quadReservations = activeQuads.map(q => ({
      booking_id: data.id,
      quad_type: q.type,
      reservation_date: format(q.date!, 'yyyy-MM-dd'),
      time_slot: q.time!,
      quantity: q.quantity,
    }));

    await supabase.from('quad_reservations').insert(quadReservations);
  }

  return data ? { id: data.id, confirmationCode: data.confirmation_code } : null;
}

export async function getQuadAvailability(date: string, timeSlot: string): Promise<number> {
  const { data, error } = await supabase
    .from('quad_reservations')
    .select('quantity')
    .eq('reservation_date', date)
    .eq('time_slot', timeSlot);

  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + r.quantity, 0);
}

export async function getBookingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}
