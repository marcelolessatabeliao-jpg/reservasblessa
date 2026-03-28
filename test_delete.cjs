const { createClient } = require('@supabase/supabase-js');
const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const supabase = createClient(url, key);

async function testDelete() {
  console.log("Checking bookings...");
  const { data: bks, error: bksErr } = await supabase.from('bookings').select('id, name').limit(1);
  if (bksErr) console.error("Error fetching bookings:", bksErr);
  else if (bks.length > 0) {
    const b = bks[0];
    console.log(`Trying to delete booking: ${b.id} (${b.name})`);
    const { error: delErr } = await supabase.from('bookings').delete().eq('id', b.id);
    if (delErr) {
       console.error("DELETE FAILED:", delErr);
       if (delErr.code === '23503') console.log("HINT: Foreign key constraint violation. Some other table references this record.");
    } else {
       console.log("DELETE SUCCESSFUL!");
    }
  }

  console.log("\nChecking orders...");
  const { data: ords, error: ordsErr } = await supabase.from('orders').select('id, customer_name').limit(1);
  if (ordsErr) console.error("Error fetching orders:", ordsErr);
  else if (ords.length > 0) {
    const o = ords[0];
    console.log(`Trying to delete order: ${o.id} (${o.customer_name})`);
    const { error: delErr } = await supabase.from('orders').delete().eq('id', o.id);
    if (delErr) {
       console.error("DELETE FAILED:", delErr);
    } else {
       console.log("DELETE SUCCESSFUL!");
    }
  }
}

testDelete();
