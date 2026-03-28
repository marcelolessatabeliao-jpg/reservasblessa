const { createClient } = require('@supabase/supabase-js');
const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const supabase = createClient(url, key);

async function testDeleteAll() {
  // Test bookings
  console.log("=== BOOKINGS ===");
  const { data: bks, error: bksErr } = await supabase.from('bookings').select('id, name, status').order('created_at', { ascending: false });
  if (bksErr) { console.error("Error fetching bookings:", bksErr); }
  else {
    console.log(`Found ${bks.length} bookings`);
    for (const b of bks) {
      console.log(`  Deleting booking: ${b.id} (${b.name}) [${b.status}]`);
      const { error } = await supabase.from('bookings').delete().eq('id', b.id);
      if (error) console.error(`    FAILED:`, error.message, error.code, error.details);
      else console.log(`    OK`);
    }
  }

  // Test orders
  console.log("\n=== ORDERS ===");
  const { data: ords, error: ordsErr } = await supabase.from('orders').select('id, customer_name, status').order('created_at', { ascending: false });
  if (ordsErr) { console.error("Error fetching orders:", ordsErr); }
  else {
    console.log(`Found ${ords.length} orders`);
    for (const o of ords) {
      console.log(`  Deleting order: ${o.id} (${o.customer_name}) [${o.status}]`);
      const { error } = await supabase.from('orders').delete().eq('id', o.id);
      if (error) console.error(`    FAILED:`, error.message, error.code, error.details);
      else console.log(`    OK`);
    }
  }

  // Test kiosk_reservations
  console.log("\n=== KIOSK_RESERVATIONS ===");
  const { data: kiosks, error: ke } = await supabase.from('kiosk_reservations').select('id, kiosk_type, reservation_date');
  if (ke) console.error("Error:", ke);
  else {
    console.log(`Found ${kiosks.length} kiosk reservations`);
    for (const k of kiosks) {
      const { error } = await supabase.from('kiosk_reservations').delete().eq('id', k.id);
      if (error) console.error(`  FAILED: ${k.id}:`, error.message, error.code);
      else console.log(`  OK: ${k.id}`);
    }
  }

  // Test quad_reservations
  console.log("\n=== QUAD_RESERVATIONS ===");
  const { data: quads, error: qe } = await supabase.from('quad_reservations').select('id, quad_type, reservation_date');
  if (qe) console.error("Error:", qe);
  else {
    console.log(`Found ${quads.length} quad reservations`);
    for (const q of quads) {
      const { error } = await supabase.from('quad_reservations').delete().eq('id', q.id);
      if (error) console.error(`  FAILED: ${q.id}:`, error.message, error.code);
      else console.log(`  OK: ${q.id}`);
    }
  }
}

testDeleteAll();
