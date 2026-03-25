
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function bruteForce() {
  const fields = ['name', 'customer_name', 'total_amount', 'amount', 'total', 'status', 'created_at', 'updated_at', 'visit_date', 'customer_phone', 'phone'];
  for (const f of fields) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [f]: f === 'total_amount' || f === 'amount' || f === 'total' ? 10.0 : 'test' })
    });
    const status = res.status;
    if (status === 201 || status === 200) {
      console.log(`SUCESSO no campo: ${f}`);
    } else {
      const err = await res.json();
      console.log(`FALHA no campo ${f}: ${err.message}`);
    }
  }
}
bruteForce();
