
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function checkColumns() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=customer_phone,visit_date&limit=1`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      console.log('Columns existence confirmed! Data:', data);
    } else {
      const err = await res.json();
      console.log('Columns check failed (likely missing):', err);
    }
  } catch (e) {
    console.log('Fetch error:', e);
  }
}

checkColumns();
