const { createClient } = require('@supabase/supabase-js');
const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const supabase = createClient(url, key);

async function checkSchema() {
  const { data: ords, error: e1 } = await supabase.from('orders').select('*').limit(1);
  if (e1) console.error("Orders Error:", e1);
  else if (ords.length > 0) console.log("ORDERS cols:", Object.keys(ords[0]));
  else console.log("Orders table empty, can't infer schema easily from anon");

  const { data: bks, error: e2 } = await supabase.from('bookings').select('*').limit(1);
  if (e2) console.error("Bookings Error:", e2);
  else if (bks.length > 0) console.log("BOOKINGS cols:", Object.keys(bks[0]));
}

checkSchema();
