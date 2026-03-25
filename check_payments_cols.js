
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function checkPaymentsTable() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?limit=1`, {
    headers: { 'apikey': ANON_KEY }
  });
  if (res.ok) {
     const data = await res.json();
     if (data.length > 0) {
        console.log('Real columns from existing row (payments):', Object.keys(data[0]));
     } else {
        console.log('No rows in payments!');
     }
  } else {
     console.log('Failed to select payments:', await res.text());
  }
}
checkPaymentsTable();
