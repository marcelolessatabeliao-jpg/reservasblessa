import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function checkDuplicates() {
  const { data: reservations, error } = await supabase
    .from('kiosk_reservations')
    .select('id, order_id, kiosk_id, reservation_date');
  
  if (error) {
    console.error("Error fetching reservations:", error);
    return;
  }

  // Group by order_id
  const byOrder = {};
  reservations.forEach(r => {
    if (!r.order_id) return;
    if (!byOrder[r.order_id]) byOrder[r.order_id] = [];
    byOrder[r.order_id].push(r);
  });

  console.log("Checking orders with multiple kiosk reservations:");
  for (const [orderId, resList] of Object.entries(byOrder)) {
    if (resList.length > 1) {
      console.log(`Order ID: ${orderId}`);
      resList.forEach(r => {
        console.log(`  Reservation ID: ${r.id}, Kiosk ID: ${r.kiosk_id}, Date: ${r.reservation_date}`);
      });
      // Let's also check the order items for this order
      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_id')
        .eq('order_id', orderId);
      console.log("  Order items:", items);
    }
  }
}

checkDuplicates();
