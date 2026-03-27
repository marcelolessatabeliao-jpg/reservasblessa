const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function testRLSBehavior() {
  const { data: bks } = await supabase.from('order_items').select('id, order_id').limit(1);
  if (bks && bks.length > 0) {
    console.log("Found order_item:", bks[0].id);
    const { data: delItem } = await supabase.from('order_items').delete().eq('id', bks[0].id).select();
    const { data: delQuad } = await supabase.from('quad_reservations').delete().eq('order_id', bks[0].order_id).select();
    console.log("Delete order_items return:", delItem);
    console.log("Delete quad_reservations return:", delQuad);
  } else {
    console.log("No items.");
  }
}
testRLSBehavior();
