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
  orderItemsInput?: OrderItemInput[],
  initialStatus: string = 'awaiting_payment',
  existingOrderId: string | null = null
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
  
  let finalOrderId = existingOrderId;
  let confirmationCode: string | null = null;

  // 2. Integration: Save to orders and order_items tables (MASTER DATA)
  try {
    const orderPayload: any = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_cpf: entry.cpf || null,
      visit_date: visitDateStr,
      total_amount: totalAmount,
      status: initialStatus,
      notes: totalAmount > 0 ? 'Reserva online - 10% de desconto aplicado' : null,
      updated_at: new Date().toISOString()
    };

    if (userId) orderPayload.user_id = userId;

    if (finalOrderId) {
      // UPDATE existing order
      console.log('🔄 Atualizando pedido existente:', finalOrderId);
      const { data: orderData, error: orderError } = await (supabase as any)
        .from('orders')
        .update(orderPayload)
        .eq('id', finalOrderId)
        .select('id, confirmation_code') 
        .single();

      if (orderError) throw orderError;
      confirmationCode = orderData.confirmation_code;

      // Limpar itens antigos para evitar duplicatas nos itens
      await (supabase as any).from('order_items').delete().eq('order_id', finalOrderId);
      await (supabase as any).from('quad_reservations').delete().eq('order_id', finalOrderId);
      await (supabase as any).from('kiosk_reservations').delete().eq('order_id', finalOrderId);

    } else {
      // INSERT new order
      console.log('* Criando novo pedido');
      const { data: orderData, error: orderError } = await (supabase as any)
        .from('orders')
        .insert(orderPayload)
        .select('id, confirmation_code') 
        .single();

      if (orderError) throw orderError;
      finalOrderId = orderData.id;
      confirmationCode = orderData.confirmation_code;
    }

    if (finalOrderId) {
      let orderItems: any[] = [];
      
      if (orderItemsInput && orderItemsInput.length > 0) {
        orderItems = orderItemsInput.map(item => ({
          ...item,
          order_id: finalOrderId
        }));
      } else {
        // Fallback mapping if input is missing
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
                       a.isMember ? 'Associado Lessa Club' :
                       a.isCounterPayment ? 'Entrada no Balcão' :
                       a.isBirthday ? 'Lessa Aniversariante Pass' : 'Adulto';
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: label,
            quantity: a.quantity || 1, 
            unit_price: (a.age >= 60 || a.isPCD || a.isBirthday || a.isMember || a.isCounterPayment) ? 0 : price
          });
        });

        // 2. Children
        booking.entry.children.forEach((c) => {
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: c.isPCD ? 'Lessa Kids PCD' : 'Lessa Kids',
            quantity: c.quantity || 1, 
            unit_price: 0
          });
        });

        // 3. Kiosks
        booking.kiosks.filter(k => k.quantity > 0).forEach(k => {
          const label = k.type === 'maior' ? 'Grande' : k.type === 'menor' ? 'Médio' : 'Familiar';
          const priceMap: Record<string, number> = { maior: 150, menor: 100, familiar: 75 };
          orderItems.push({ 
            order_id: finalOrderId, 
            product_id: `Quiosque ${label}`,
            quantity: k.quantity, 
            unit_price: priceMap[k.type] ?? 75
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
            metadata: { time_slot: q.time, time: q.time } 
          });
        });

        // 5. Additional Services
        if (booking.additionals && Array.isArray(booking.additionals)) {
          booking.additionals.filter(a => a.quantity > 0).forEach(a => {
            const labelMap: Record<string, string> = { 'soap-football': 'Futebol de Sabão', 'sport-fishing': 'Pesca Esportiva', 'pesca': 'Pesca Esportiva', 'futebol-sabao': 'Futebol de Sabão' };
            const priceMap: Record<string, number> = { 'soap-football': 10, 'sport-fishing': 20, 'pesca': 20, 'futebol-sabao': 10 };
            orderItems.push({
              order_id: finalOrderId,
              product_id: labelMap[a.type] || a.type,
              quantity: a.quantity,
              unit_price: priceMap[a.type] || 0
            });
          });
        }

        // 6. Hospedagem (Chalé)
        if (booking.chale && booking.chale.packageType) {
          const { CHALE_PACKAGES, calculateChaleTotal } = await import('@/lib/booking-types');
          const pkg = CHALE_PACKAGES[booking.chale.packageType];
          if (pkg) {
            const adults = Math.min(2, Math.max(1, booking.chale.adultsCount || 2));
            const kids = booking.chale.childrenCount || 0;
            const chaleTotalPrice = calculateChaleTotal(booking.chale.packageType, adults, kids);
            const visitDateStr = (booking.chale.checkInDate || booking.entry.visitDate)
              ? format(new Date(booking.chale.checkInDate || booking.entry.visitDate!), 'yyyy-MM-dd')
              : null;

            orderItems.push({
              order_id: finalOrderId,
              product_id: `Hospedagem - ${pkg.title}`,
              quantity: 1,
              unit_price: chaleTotalPrice,
              metadata: {
                package_type: pkg.id,
                chale_id: booking.chale.chaleId || null,
                adults: adults,
                children: kids,
                check_in: '15:00',
                check_out: '11:00',
                check_in_date: visitDateStr,
                breakfast: 'Incluso até as 09h',
                guest_names: booking.chale.guestNames || []
              }
            });
          }
        }

        // 7. Camping
        if (booking.camping && booking.camping.peopleCount > 0) {
          orderItems.push({
            order_id: finalOrderId,
            product_id: 'Área de Camping',
            quantity: booking.camping.peopleCount,
            unit_price: 100
          });
        }
      }

      if (orderItems.length > 0) {
        await (supabase as any).from('order_items').insert(orderItems);
      }
    }
  } catch (err: any) {
    console.error('Master sync process failed:', err);
    throw new Error(`Erro Crítico no Sistema: ${err.message || 'Falha ao sincronizar dados'}`); 
  }

  // 3. Save quad reservations for slot tracking
  try {
    const activeQuads = booking.quads.filter(q => q.quantity > 0 && q.time);
    if (activeQuads.length > 0 && finalOrderId) {
      const quadReservations = activeQuads.map(q => {
        const validDate = q.date || entry.visitDate;
        return {
          order_id: finalOrderId,
          quad_type: q.type,
          reservation_date: format(new Date(validDate!), 'yyyy-MM-dd'),
          time_slot: q.time!,
          quantity: q.quantity,
        };
      });

      await (supabase.from('quad_reservations') as any).insert(quadReservations);
    }
  } catch (err) {
    console.warn('Failed to save quad reservations:', err);
  }

  // 4. Save kiosk reservations for availability tracking
  try {
    const activeKiosks = booking.kiosks.filter(k => k.quantity > 0);
    if (activeKiosks.length > 0 && finalOrderId) {
      const kioskReservations: any[] = [];
      activeKiosks.forEach(k => {
        const validDate = k.date || entry.visitDate;
        if (k.selectedIds && k.selectedIds.length > 0) {
          k.selectedIds.forEach(kioskId => {
            kioskReservations.push({
              order_id: finalOrderId,
              kiosk_id: kioskId,
              kiosk_type: k.type,
              reservation_date: format(new Date(validDate!), 'yyyy-MM-dd'),
              quantity: 1
            });
          });
        } else {
          kioskReservations.push({
            order_id: finalOrderId,
            kiosk_type: k.type,
            reservation_date: format(new Date(validDate!), 'yyyy-MM-dd'),
            quantity: k.quantity
          });
        }
      });

      await (supabase.from('kiosk_reservations') as any).insert(kioskReservations);
    }
  } catch (err) {
    console.warn('Failed to save kiosk reservations:', err);
  }

  return { 
    id: finalOrderId || '', 
    confirmationCode: confirmationCode || 'PENDENTE',
    orderId: finalOrderId 
  };
}

export async function getAllQuadAvailabilities(date: string): Promise<Record<string, number>> {
  try {
    const fetchPromise = (supabase
      .from('quad_reservations') as any)
      .select('time_slot, quantity, orders!inner(status)')
      .eq('reservation_date', date);

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1800)
    );

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);

    const result: Record<string, number> = {};
    if (error || !data) return result;

    const confirmedStatuses = ['paid', 'pago', 'confirmed', 'confirmado', 'checked-in', 'completed'];

    data.forEach((r: any) => {
      const status = (r.orders?.status || '').toLowerCase();
      if (confirmedStatuses.includes(status)) {
        result[r.time_slot] = (result[r.time_slot] || 0) + (Number(r.quantity) || 0);
      }
    });

    return result;
  } catch {
    return {};
  }
}

export async function getQuadAvailability(date: string, timeSlot: string): Promise<number> {
  try {
    const fetchPromise = (supabase
      .from('quad_reservations') as any)
      .select('quantity, orders!inner(status)')
      .eq('reservation_date', date)
      .eq('time_slot', timeSlot);

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1800)
    );

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (error || !data) return 0;

    const confirmedStatuses = ['paid', 'pago', 'confirmed', 'confirmado', 'checked-in', 'completed'];

    return data
      .filter((r: any) => {
        const status = (r.orders?.status || '').toLowerCase();
        return confirmedStatuses.includes(status);
      })
      .reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

export async function getBookedKioskIds(date: string): Promise<number[]> {
  try {
    const fetchPromise = (supabase
      .from('kiosk_reservations') as any)
      .select('id, kiosk_id, kiosk_type, orders!inner(status)')
      .eq('reservation_date', date)
      .order('id', { ascending: true });

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1800)
    );

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (error || !data) return [];

  // Apenas reservas pagas e confirmadas bloqueiam o quiosque
  // Reservas pendentes NÃO bloqueiam - apenas pagos e confirmados
  const blockedStatuses = [
    'paid', 'pago', 
    'confirmed', 'confirmado', 
    'checked-in', 'completed'
  ];

  const blockedReservations = data.filter((r: any) => {
    const status = (r.orders?.status || '').toLowerCase();
    return blockedStatuses.includes(status);
  });

  const bookedIds: number[] = [];

  // 1. First, add all specific IDs
  blockedReservations.forEach((r: any) => {
    const id = Number(r.kiosk_id);
    if (!isNaN(id) && id > 0) {
      bookedIds.push(id);
    }
  });

  // 2. Handle generic 'MAIOR' or 'MENOR' bookings
  // MAIOR is always ID 1 (unless 6, 7, 8 are used, but they are also 'maior')
  // MENOR starts from ID 2
  const genericMaiores = blockedReservations.filter((r: any) => r.kiosk_id === 'MAIOR' || (r.kiosk_id === null && r.kiosk_type === 'maior'));
  const genericMenores = blockedReservations.filter((r: any) => r.kiosk_id === 'MENOR' || (r.kiosk_id === null && r.kiosk_type === 'menor'));

  // Assign Maiores to ID 1
  for (const _ of genericMaiores) {
    if (!bookedIds.includes(1)) {
      bookedIds.push(1);
    }
  }

  // Assign Menores to IDs 2, 3, 4, 5
  for (const _ of genericMenores) {
    for (const menorId of [2, 3, 4, 5]) {
      if (!bookedIds.includes(menorId)) {
        bookedIds.push(menorId);
        break;
      }
    }
  }

  // Handle generic 'FAMILIAR' bookings -> IDs 6-12
  const genericFamiliares = blockedReservations.filter((r: any) => r.kiosk_id === 'FAMILIAR' || (r.kiosk_id === null && r.kiosk_type === 'familiar'));
  for (const _ of genericFamiliares) {
    for (const familiarId of [6, 7, 8, 9, 10, 11, 12]) {
      if (!bookedIds.includes(familiarId)) {
        bookedIds.push(familiarId);
        break;
      }
    }
  }

  // Retorna IDs únicos para evitar duplicidade visual
  return Array.from(new Set(bookedIds));
} catch {
  return [];
}
}

export function isChaleBlockedForRange(
  blockedDates: string[] | undefined,
  checkIn: string,
  checkOut?: string | null
): boolean {
  if (!Array.isArray(blockedDates) || blockedDates.length === 0 || !checkIn) return false;
  if (!checkOut || checkOut <= checkIn) {
    return blockedDates.includes(checkIn);
  }
  return blockedDates.some((d) => d >= checkIn && d < checkOut);
}

export async function getChaleBlockedDatesMap(): Promise<Record<number, string[]>> {
  try {
    const raw = await getGlobalSetting('chale_blocked_dates', {});
    const normalized: Record<number, string[]> = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      Object.entries(raw).forEach(([k, val]) => {
        const id = Number(k);
        if (!isNaN(id) && id > 0 && Array.isArray(val)) {
          const clean = Array.from(
            new Set(val.map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
          ).sort();
          if (clean.length > 0) normalized[id] = clean;
        }
      });
    }
    return normalized;
  } catch (err) {
    console.warn('Erro ao carregar datas bloqueadas por chalé:', err);
    return {};
  }
}

export async function getBookedChaleIds(date?: string | null): Promise<number[]> {
  // Chalés indisponíveis por padrão (6 de alvenaria onde apenas 5 estão disponíveis -> Chalé 06 indisponível; e todos os 6 de vidro 07-12 indisponíveis)
  const defaultUnavailable = [6, 7, 8, 9, 10, 11, 12];
  
  try {
    const [customDisabled, blockedDatesMap] = await Promise.all([
      getGlobalSetting('disabled_chale_ids', defaultUnavailable),
      getChaleBlockedDatesMap()
    ]);
    const bookedIds: number[] = Array.isArray(customDisabled) 
      ? customDisabled.map(Number).filter(n => !isNaN(n)) 
      : [...defaultUnavailable];

    if (!date) return Array.from(new Set(bookedIds));

    // Incluir chalés bloqueados especificamente para esta data
    Object.entries(blockedDatesMap).forEach(([idStr, dates]) => {
      if (dates.includes(date)) {
        const numId = Number(idStr);
        if (!isNaN(numId) && numId > 0) bookedIds.push(numId);
      }
    });

    const blockedStatuses = ['paid', 'pago', 'confirmed', 'confirmado', 'checked-in', 'completed'];

    // Buscar pedidos pagos ou confirmados para checar reservas de chalé na data especificada
    const { data, error } = await (supabase
      .from('orders') as any)
      .select('id, status, visit_date, order_items(id, product_id, metadata)')
      .in('status', blockedStatuses);

    if (!error && Array.isArray(data)) {
      data.forEach((order: any) => {
        const orderDate = order.visit_date ? order.visit_date.split('T')[0] : null;
        (order.order_items || []).forEach((item: any) => {
          const prod = (item.product_id || '').toLowerCase();
          if (prod.includes('chalé') || prod.includes('chale') || prod.includes('hospedagem')) {
            const chaleId = item.metadata?.chale_id;
            const checkIn = item.metadata?.check_in_date || orderDate;
            const checkOut = item.metadata?.check_out_date;

            let isMatching = false;
            if (checkIn && checkOut) {
              isMatching = date >= checkIn && date <= checkOut;
            } else if (orderDate) {
              isMatching = date === orderDate;
            } else {
              isMatching = true;
            }

            if (isMatching && chaleId) {
              const numId = Number(chaleId);
              if (!isNaN(numId) && numId > 0) {
                bookedIds.push(numId);
              }
            }
          }
        });
      });
    }

    return Array.from(new Set(bookedIds));
  } catch (err) {
    console.warn('Erro ao verificar chalés reservados:', err);
    return defaultUnavailable;
  }
}

export async function getKioskAvailability(date: string, type: string): Promise<number> {
  const { data, error } = await (supabase
    .from('kiosk_reservations') as any)
    .select('quantity, orders!inner(status)')
    .eq('reservation_date', date)
    .eq('kiosk_type', type);

  if (error || !data) return 0;

  const confirmedStatuses = ['paid', 'pago', 'confirmed', 'confirmado', 'checked-in', 'completed'];

  return data
    .filter((r: any) => {
      const status = (r.orders?.status || '').toLowerCase();
      return confirmedStatuses.includes(status);
    })
    .reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0);
}

export async function getBookingCount(): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count || 0;
}

export async function getGlobalSetting(key: string, defaultValue: any = null): Promise<any> {
  try {
    const local = typeof window !== 'undefined' ? localStorage.getItem(`setting_${key}`) : null;
    
    const fetchPromise = (supabase.from('site_settings') as any)
      .select('value')
      .eq('key', key)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 1200)
    );

    const { data, error }: any = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (error || !data) {
      if (local !== null) {
        try { return JSON.parse(local); } catch { return local; }
      }
      return defaultValue;
    }
    const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(`setting_${key}`, JSON.stringify(val)); } catch {}
    }
    return val;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    const local = typeof window !== 'undefined' ? localStorage.getItem(`setting_${key}`) : null;
    if (local !== null) {
      try { return JSON.parse(local); } catch { return local; }
    }
    return defaultValue;
  }
}

export async function updateGlobalSetting(key: string, value: any): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(`setting_${key}`, JSON.stringify(value)); } catch {}
      window.dispatchEvent(new CustomEvent('global_setting_updated', { detail: { key, value } }));
    }
    const { error } = await (supabase.from('site_settings') as any)
      .upsert({ key, value, updated_at: new Date().toISOString() });
    
    if (error) {
      console.warn(`[BookingService] Aviso ao sincronizar site_settings.${key} na nuvem (mantido localmente):`, error);
    }
    return true;
  } catch (error) {
    console.error(`Error updating setting ${key}:`, error);
    return true;
  }
}
