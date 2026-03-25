
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function finalFind() {
  const fields = ['cliente', 'client', 'nome', 'user', 'email', 'id', 'uuid'];
  for (const f of fields) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [f]: 'test' })
    });
    const err = await res.json();
    if (err.message.includes('RLS')) {
       console.log(`EXISTE: ${f}`);
    } else if (err.message.includes('Could not find')) {
       // Nao existe
    } else {
       console.log(`ERRO em ${f}: ${err.message}`);
    }
  }
}
finalFind();
