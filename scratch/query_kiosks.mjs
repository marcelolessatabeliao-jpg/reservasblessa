import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function test() {
  const { data, error } = await supabase
    .from('kiosk_reservations')
    .select('id, kiosk_id, kiosk_type, reservation_date, order_id, orders(status, customer_name, customer_phone, confirmation_code)')
    .eq('reservation_date', '2026-05-23');
  
  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log("Kiosk reservations for 2026-05-23:");
    console.log(JSON.stringify(data, null, 2));
  }
}
test();
