
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function selectAny() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?limit=1`, {
    headers: { 'apikey': ANON_KEY }
  });
  if (res.ok) {
     const data = await res.json();
     if (data.length > 0) {
        console.log('Real columns from existing row:', Object.keys(data[0]));
     } else {
        console.log('No rows in orders! Trying a failed select to see allowed columns.');
     }
  }
}
selectAny();
