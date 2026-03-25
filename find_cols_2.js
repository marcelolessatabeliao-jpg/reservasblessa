
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function findCols() {
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { 
      'apikey': ANON_KEY, 
      'Authorization': `Bearer ${ANON_KEY}`, 
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ total_amount: 0.01 })
  });
  if (orderRes.ok) {
     const data = await orderRes.json();
     console.log('Existing columns in orders row:', Object.keys(data[0] || {}));
  } else {
     console.log('Insert failed:', await orderRes.text());
  }
}
findCols();
