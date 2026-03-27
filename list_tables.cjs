const { createClient } = require('@supabase/supabase-js');
async function check() {
  const r = await fetch('https://lcymbetnnuokrijynmjm.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');
  const schema = await r.json();
  console.log('TABLES FOUND:', Object.keys(schema.definitions));
}
check();
