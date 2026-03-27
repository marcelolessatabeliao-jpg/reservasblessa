const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function checkUpdate() {
  const { data: bks } = await supabase.from('orders').select('id, status').limit(1);
  if (bks && bks.length > 0) {
    const originalStatus = bks[0].status;
    console.log("Found order:", bks[0].id, "status:", originalStatus);
    const { data: upd, error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', bks[0].id).select();
    console.log("Update returning data:", upd, "error:", error);
  }
}
checkUpdate();
