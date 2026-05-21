import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function clean() {
  const obsoleteId = '5778f474-ff8d-4e3c-be84-b6fb83bdaaf4';
  const { data, error } = await supabase
    .from('kiosk_reservations')
    .delete()
    .eq('id', obsoleteId)
    .select();
  console.log("DELETED:", data, error);
}

clean();
