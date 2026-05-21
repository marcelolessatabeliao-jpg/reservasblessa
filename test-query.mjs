import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function test() {
  const orderId = '410ef4a0-d23e-435a-a74b-0dde692de2ff';
  
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId);
  console.log("ORDER:", order, orderErr);

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  console.log("ORDER ITEMS:", items, itemsErr);

  const { data: reservations, error: resErr } = await supabase
    .from('kiosk_reservations')
    .select('*')
    .eq('order_id', orderId);
  console.log("KIOSK RESERVATIONS:", reservations, resErr);

  const { data: bookings, error: bookErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('confirmation_code', order?.[0]?.confirmation_code || '');
  console.log("BOOKINGS BY CONFIRMATION CODE:", bookings, bookErr);

  const { data: bookingsByName, error: nameErr } = await supabase
    .from('bookings')
    .select('*')
    .ilike('name', '%Vitória Kunrath%');
  console.log("BOOKINGS BY NAME:", bookingsByName, nameErr);
}
test();


