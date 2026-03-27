const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function testRLS() {
  const { data: bks } = await supabase.from('payments').select('id, order_id').limit(1);
  if (bks && bks.length > 0) {
    console.log("Found payment:", bks[0].id);
    const { data: delItem, error } = await supabase.from('payments').delete().eq('id', bks[0].id).select();
    console.log("Delete payments return:", delItem, error);
  } else {
    console.log("No payments.");
  }
}
testRLS();
