import { supabase } from '@/integrations/supabase/client';
import { BookingState } from '@/lib/booking-types';
import { format } from 'date-fns';

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface SaveBookingResult {
  id: string;
  confirmationCode: string;
  orderId: string | null;
}

export async function saveBooking(
  booking: BookingState, 
  totalAmount: number, 
  userId?: string | null,
  orderItemsInput?: OrderItemInput[]
): Promise<SaveBookingResult | null> {
  const { entry } = booking;
  
  if (!entry.name || !entry.visitDate) {
    console.error('Validation failed: name or visitDate missing');
    return null;
  }

  const visitDateStr = format(new Date(entry.visitDate), 'yyyy-MM-dd');
  const customerName = entry.name.trim().slice(0, 200);
  const customerPhone = entry.phone?.trim()?.slice(0, 20) || null;

  // 1. Save to legacy bookings table (if possible)
  let legacyBookingId: string | null = null;
  let confirmationCode: string | null = null;

  try {
    const { data: bookingData, error: bookingError } = await (supabase
      .from('bookings') as any)
      .insert({
        name: customerName,
        phone: customerPhone,
        visit_date: visitDateStr,
        adults: entry.adults.reduce((acc, a) => acc + (a.quantity || 1), 0),
        children: entry.children as any,
        total_amount: totalAmount,
        status: 'pending'
      })
      .select('id, confirmation_code')
      .single();

    if (bookingError) {
      console.warn('Legacy bookings sync failed (maybe table missing):', bookingError);
    } else if (bookingData) {
      legacyBookingId = bookingData.id;
      confirmationCode = bookingData.confirmation_code;
    }
  } catch (err) {
    console.warn('Error during legacy booking save:', err);
  }

  // 2. Integration: Save to orders and order_items tables (MASTER DATA)
  let finalOrderId = null;
  try {
    const orderPayload: any = {
      user_id: userId || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      visit_date: visitDateStr,
      total_amount: totalAmount,
      status: 'pending'
    };

    let { data: orderData, error: orderError } = await (supabase as any)
      .from('orders')
      .insert(orderPayload)
      .select('id, confirmation_code') // Orders now has confirmation_code via trigger
      .single();

    if (orderError) {
       // Fallback: If columns missing, retry without new ones
       console.warn('master orders sync failed, retrying without new columns:', orderError);
       delete orderPayload.customer_phone;
       delete orderPayload.visit_date;
       
       const { data: retryData, error: retryError } = await (supabase as any)
         .from('orders')
         .insert(orderPayload)
         .select('id')
         .single();
       
       if (retryError) throw retryError;
       orderData = retryData;
    }

    if (orderData) {
      finalOrderId = orderData.id;
      // Use code from order if legacy didn't provide one
      if (!confirmationCode && orderData.confirmation_code) {
        confirmationCode = orderData.confirmation_code;
      }
      
      let orderItems: any[] = [];
      
      if (orderItemsInput && orderItemsInput.length > 0) {
        orderItems = orderItemsInput.map(item => ({
          ...item,
          order_id: orderData.id
        }));
      } else {
        // Legacy fallback mapping
        booking.entry.adults.forEach((a) => {
          orderItems.push({ 
            order_id: orderData.id, 
            product_id: a.isPCD ? 'Day Use - Inclusão' : 'Day Use - Adulto',
            quantity: a.quantity || 1, 
            unit_price: 50
          });
        });
      }

      if (orderItems.length > 0) {
        await (supabase as any).from('order_items').insert(orderItems);
      }
    }
  } catch (err: any) {
    console.warn('Sync with orders table failed, but we will proceed if legacy bookings worked.', err);
    if (!legacyBookingId) {
      throw new Error(`Falha no Sistema de Pedidos: ${err.message || 'Erro desconhecido'}`); 
    }
  }

  // 3. Save quad reservations for slot tracking
  const activeQuads = booking.quads.filter(q => q.quantity > 0 && q.date && q.time);
  if (activeQuads.length > 0 && (legacyBookingId || finalOrderId)) {
    const quadReservations = activeQuads.map(q => ({
      booking_id: legacyBookingId, // Still using legacy ID for FK if possible
      order_id: finalOrderId,      // Potential new FK
      quad_type: q.type,
      reservation_date: format(new Date(q.date!), 'yyyy-MM-dd'),
      time_slot: q.time!,
      quantity: q.quantity,
    }));

    await (supabase.from('quad_reservations') as any).insert(quadReservations);
  }

  // 4. Save kiosk reservations for availability tracking
  const activeKiosks = booking.kiosks.filter(k => k.quantity > 0 && k.date);
  if (activeKiosks.length > 0 && (legacyBookingId || finalOrderId)) {
    const kioskReservations = activeKiosks.map(k => ({
      booking_id: legacyBookingId,
      order_id: finalOrderId,
      kiosk_type: k.type,
      reservation_date: format(new Date(k.date!), 'yyyy-MM-dd'),
      quantity: k.quantity
    }));

    await (supabase.from('kiosk_reservations') as any).insert(kioskReservations);
  }

  // Result: We need at least an orderId or bookingId to continue the process
  if (!finalOrderId && !legacyBookingId) {
    throw new Error('Não foi possível gerar a sua reserva. Tente novamente mais tarde.');
  }

  return { 
    id: legacyBookingId || finalOrderId || '', 
    confirmationCode: confirmationCode || 'PENDENTE',
    orderId: finalOrderId || legacyBookingId 
  };
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

export async function getKioskAvailability(date: string, type: string): Promise<number> {
  const { data, error } = await supabase
    .from('kiosk_reservations')
    .select('quantity')
    .eq('reservation_date', date)
    .eq('kiosk_type', type);

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
