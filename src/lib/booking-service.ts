import { supabase } from '@/integrations/supabase/client';
import { BookingState } from '@/lib/booking-types';
import { format } from 'date-fns';

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_redeemed?: boolean;
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

  // 1. Prepare Customer Data
  const visitDateStr = format(new Date(entry.visitDate), 'yyyy-MM-dd');
  const customerName = entry.name.trim().slice(0, 200);
  const customerPhone = entry.phone?.trim()?.slice(0, 20) || null;
  
  let finalOrderId = null;
  let confirmationCode: string | null = null;

  // 2. Integration: Save to orders and order_items tables (MASTER DATA)
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
      .select('id, confirmation_code') 
      .single();

    if (orderError) {
       console.warn('Master orders insert failed, retrying without extended columns...', orderError);
       delete orderPayload.customer_phone;
       delete orderPayload.visit_date;
       
       const { data: retryData, error: retryError } = await (supabase as any)
         .from('orders')
         .insert(orderPayload)
         .select('id, confirmation_code')
         .single();
       
       if (retryError) throw retryError;
       orderData = retryData;
    }

    if (orderData) {
      finalOrderId = orderData.id;
      confirmationCode = orderData.confirmation_code;
      
      let orderItems: any[] = [];
      
      if (orderItemsInput && orderItemsInput.length > 0) {
        orderItems = orderItemsInput.map(item => ({
          ...item,
          order_id: finalOrderId,
          is_redeemed: false
        }));
      } else {
        // Fallback mapping if input is missing - Capture everything!
        const isSunday = booking.entry.dayOfWeek === 'domingo';
        
        // 1. Adults
        booking.entry.adults.forEach((a) => {
          const price = ((a.isTeacher || a.isStudent || a.isServer || (a as any).isBloodDonor || a.takeDonation) && !isSunday) ? 25 : 50;
          const label = a.isPCD ? 'Lessa Inclusão' : 
                       a.age >= 60 ? 'Lessa Vitalício' : 
                       a.isTeacher ? 'Lessa Professor Pass' :
                       (a as any).isBloodDonor ? 'Lessa Doador Pass' :
                       a.isStudent ? 'Lessa Estudante Pass' :
                       a.isServer ? 'Lessa Servidor Pass' :
                       a.isBirthday ? 'Lessa Aniversariante Pass' : 'Adulto';
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: label,
            quantity: a.quantity || 1, 
            unit_price: (a.age >= 60 || a.isPCD || a.isBirthday) ? 0 : price,
            is_redeemed: false
          });
        });

        // 2. Children
        booking.entry.children.forEach((c) => {
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: c.isPCD ? 'Lessa Kids PCD' : 'Lessa Kids',
            quantity: c.quantity || 1, 
            unit_price: 0,
            is_redeemed: false
          });
        });

        // 3. Kiosks
        booking.kiosks.filter(k => k.quantity > 0).forEach(k => {
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: `Quiosque ${k.type === 'maior' ? 'Maior' : 'Menor'}`,
            quantity: k.quantity, 
            unit_price: k.type === 'maior' ? 100 : 75,
            is_redeemed: false
          });
        });

        // 4. Quads
        booking.quads.filter(q => q.quantity > 0).forEach(q => {
          const baseMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
          const labelMap: Record<string, string> = { individual: 'Individual', dupla: 'Dupla', 'adulto-crianca': 'Adulto + Criança' };
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: `Quadriciclo ${labelMap[q.type]}`,
            quantity: q.quantity, 
            unit_price: baseMap[q.type] || 0,
            is_redeemed: false
          });
        });
      }

      if (orderItems.length > 0) {
        console.log('Inserting order items:', orderItems.length);
        const { error: itemsErr } = await (supabase as any).from('order_items').insert(orderItems);
        if (itemsErr) {
          console.error('CRITICAL: Error inserting order items:', itemsErr);
          // Don't throw, let the order survive but log it
        }
      }
    }
  } catch (err: any) {
    console.error('Master sync process failed:', err);
    throw new Error(`Erro Crítico no Sistema: ${err.message || 'Falha ao sincronizar dados'}`); 
  }

  // 3. Save quad reservations for slot tracking
  try {
    const activeQuads = booking.quads.filter(q => q.quantity > 0 && q.date && q.time);
    if (activeQuads.length > 0 && finalOrderId) {
      const quadReservations = activeQuads.map(q => ({
        order_id: finalOrderId,
        quad_type: q.type,
        reservation_date: format(new Date(q.date!), 'yyyy-MM-dd'),
        time_slot: q.time!,
        quantity: q.quantity,
      }));

      const { error: qErr } = await (supabase.from('quad_reservations') as any).insert(quadReservations);
      if (qErr) console.error('Error in quad_reservations sync:', qErr);
    }
  } catch (err) {
    console.warn('Failed to save quad reservations (non-critical):', err);
  }

  // 4. Save kiosk reservations for availability tracking
  try {
    const activeKiosks = booking.kiosks.filter(k => k.quantity > 0 && k.date);
    if (activeKiosks.length > 0 && finalOrderId) {
      const kioskReservations = activeKiosks.map(k => ({
        order_id: finalOrderId,
        kiosk_type: k.type,
        reservation_date: format(new Date(k.date!), 'yyyy-MM-dd'),
        quantity: k.quantity
      }));

      const { error: kErr } = await (supabase.from('kiosk_reservations') as any).insert(kioskReservations);
      if (kErr) console.error('Error in kiosk_reservations sync:', kErr);
    }
  } catch (err) {
    console.warn('Failed to save kiosk reservations (non-critical):', err);
  }

  return { 
    id: finalOrderId || '', 
    confirmationCode: confirmationCode || 'PENDENTE',
    orderId: finalOrderId 
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
