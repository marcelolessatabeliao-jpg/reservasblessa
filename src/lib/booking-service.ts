import { supabase } from '@/integrations/supabase/client';
import { BookingState } from '@/lib/booking-types';
import { format } from 'date-fns';

export interface SaveBookingResult {
  id: string;
  confirmationCode: string;
}

export async function saveBooking(booking: BookingState, totalAmount: number, userId?: string | null): Promise<SaveBookingResult | null> {
  const { entry } = booking;
  
  if (!entry.name || !entry.visitDate) return null;

  // 1. Save to legacy bookings table
  const { data: bookingData, error: bookingError } = await (supabase
    .from('bookings') as any)
    .insert({
      name: entry.name.trim().slice(0, 200),
      phone: entry.phone?.trim().slice(0, 20) || null,
      visit_date: format(entry.visitDate, 'yyyy-MM-dd'),
      adults: entry.adults.length,
      children: entry.children as any,
      total_amount: totalAmount,
    })
    .select('id, confirmation_code')
    .single();

  if (bookingError) {
    console.error('Error saving booking:', bookingError);
    return null;
  }

  // 2. Integration: Save to orders and order_items tables
  try {
    const { data: orderData, error: orderError } = await (supabase
      .from('orders') as any)
      .insert({
        user_id: userId || null,
        customer_name: entry.name, // Link name directly for guests
        total_amount: totalAmount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (!orderError && orderData) {
      const orderItems: any[] = [];
      
      // Map booking items to order items with descriptive names
      booking.entry.adults.forEach((a, i) => {
        orderItems.push({ 
          order_id: orderData.id, 
          product_id: a.isPCD ? 'Day Use - Inclusão' : a.isTeacher ? 'Day Use - Professor' : 'Day Use - Adulto',
          quantity: a.quantity || 1, 
          unit_price: 30 
        });
      });

      booking.entry.children.forEach((c, i) => {
        orderItems.push({ 
          order_id: orderData.id, 
          product_id: 'Day Use - Criança',
          quantity: c.quantity || 1, 
          unit_price: 0 
        });
      });

      booking.kiosks.filter(k => k.quantity > 0).forEach(k => {
        orderItems.push({ 
          order_id: orderData.id, 
          product_id: `Quiosque - ${k.type === 'menor' ? 'Menor' : 'Maior'}`, 
          quantity: k.quantity, 
          unit_price: k.type === 'menor' ? 75 : 100 
        });
      });

      booking.quads.filter(q => q.quantity > 0).forEach(q => {
        orderItems.push({ 
          order_id: orderData.id, 
          product_id: `Quadriciclo - ${q.type}`, 
          quantity: q.quantity, 
          unit_price: 80 
        });
      });

      if (orderItems.length > 0) {
        await (supabase.from('order_items') as any).insert(orderItems);
      }
    }
  } catch (err) {
    console.warn('Failed to save order/items:', err);
  }


  // Save quad reservations for slot tracking
  const activeQuads = booking.quads.filter(q => q.quantity > 0 && q.date && q.time);
  if (activeQuads.length > 0 && bookingData) {
    const quadReservations = activeQuads.map(q => ({
      booking_id: bookingData.id,
      quad_type: q.type,
      reservation_date: format(q.date!, 'yyyy-MM-dd'),
      time_slot: q.time!,
      quantity: q.quantity,
    }));

    await (supabase.from('quad_reservations') as any).insert(quadReservations);
  }

  return bookingData ? { id: bookingData.id, confirmationCode: bookingData.confirmation_code } : null;
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
