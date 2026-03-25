
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function testBookings() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: { 
      'apikey': ANON_KEY, 
      'Authorization': `Bearer ${ANON_KEY}`, 
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ name: 'TESTE Legacy', visit_date: '2026-03-30', total_amount: 10.00 })
  });
  if (res.ok) {
     const data = await res.json();
     console.log('Bookings insertion SUCESS! Columns:', Object.keys(data[0]));
  } else {
     console.log('Bookings failed:', await res.text());
  }
}
testBookings();
