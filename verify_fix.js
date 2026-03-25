
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function verifyFix() {
  console.log('Verificando se as colunas agora existem...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { 
      'apikey': ANON_KEY, 
      'Authorization': `Bearer ${ANON_KEY}`, 
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ 
      customer_name: 'VERIFICACAO POS-FIX', 
      total_amount: 0.01,
      visit_date: '2026-03-31'
    })
  });
  if (res.ok) {
     const data = await res.json();
     console.log('SUCESSO! Pedido de teste criado com as novas colunas!');
     console.log('Dados inseridos:', JSON.stringify(data[0], null, 2));
  } else {
     console.log('FALHA na verificação:', await res.text());
  }
}
verifyFix();
