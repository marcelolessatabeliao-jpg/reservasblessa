import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function test() {
  const orderId = '410ef4a0-d23e-435a-a74b-0dde692de2ff';
  
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId);
    
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
    
  const { data: kioskReservations } = await supabase
    .from('kiosk_reservations')
    .select('*')
    .eq('order_id', orderId);
    
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', orderId);

  console.log("ORDER:");
  console.log(JSON.stringify(order, null, 2));
  console.log("\nORDER ITEMS:");
  console.log(JSON.stringify(orderItems, null, 2));
  console.log("\nKIOSK RESERVATIONS:");
  console.log(JSON.stringify(kioskReservations, null, 2));
  console.log("\nBOOKINGS:");
  console.log(JSON.stringify(bookings, null, 2));
}
test();
