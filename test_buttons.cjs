const { createClient } = require('@supabase/supabase-js');
const url = "https://lcymbetnnuokrijynmjm.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";
const supabase = createClient(url, key);

async function testButtons() {
   // 1. Create a dummy booking to test on
   console.log("Creating dummy booking...");
   const { data: bData, error: bErr } = await supabase.from('bookings').insert({
     customer_name: "Test User",
     visit_date: "2026-04-10",
     adults: 2,
     status: 'pending'
   }).select('*').single();

   if (bErr) throw new Error("Insert failed: " + JSON.stringify(bErr));
   console.log("Created:", bData.id);

   // 2. Test EFETIVAR (update status)
   console.log("Testing EFETIVAR...");
   const { error: e1 } = await supabase.from('bookings').update({ status: 'paid' }).eq('id', bData.id);
   if (e1) console.error("EFETIVAR FAILED:", e1);
   else console.log("EFETIVAR OK");

   // 3. Test MEMORIAL (add note)
   console.log("Testing NOTES...");
   const { error: e2 } = await supabase.from('bookings').update({ notes: 'Some note' }).eq('id', bData.id);
   if (e2) console.error("NOTES FAILED:", e2);
   else console.log("NOTES OK");

   // 4. Test REAGENDAR
   console.log("Testing REAGENDAR...");
   const { error: e3 } = await supabase.from('bookings').update({ visit_date: '2026-05-01' }).eq('id', bData.id);
   if (e3) console.error("REAGENDAR FAILED:", e3);
   else console.log("REAGENDAR OK");

   // 5. Test EXCLUIR
   console.log("Testing DELETE...");
   const { error: e4 } = await supabase.from('bookings').delete().eq('id', bData.id);
   if (e4) console.error("DELETE FAILED:", e4);
   else console.log("DELETE OK");
}
testButtons().catch(console.error);
