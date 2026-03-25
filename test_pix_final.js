
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function testPix() {
  console.log('Testando geração de PIX no novo pedido...');
  
  // Criar um pedido real para teste
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ customer_name: 'TESTE PIX FINAL', total_amount: 10.00, visit_date: '2026-03-31' })
  });
  const orders = await orderRes.json();
  const order = orders[0];

  // Invocar Edge Function
  const paymentRes = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      name: 'TESTE PIX FINAL',
      billingType: 'PIX',
      value: 10.00
    })
  });

  const paymentData = await paymentRes.json();
  console.log('Resultado PIX:', JSON.stringify(paymentData, null, 2));
}
testPix();
