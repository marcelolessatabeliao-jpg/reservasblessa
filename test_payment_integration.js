
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const CREATE_PAYMENT_URL = `${SUPABASE_URL}/functions/v1/create-payment`;
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function testPayment() {
  console.log('--- TESTANDO INTEGRAÇÃO DE PAGAMENTO (ASAAS) ---');
  
  // 1. Criar um pedido temporário para associar o pagamento
  console.log('Criando pedido de teste...');
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      customer_name: 'TESTE INTEGRACAO SCRIPT',
      total_amount: 50.00,
      visit_date: '2026-04-10',
      status: 'pending'
    })
  });

  if (!orderRes.ok) {
    console.error('Falha ao criar pedido:', await orderRes.text());
    return;
  }

  const orderData = await orderRes.json();
  const orderId = orderData[0].id;
  console.log('Pedido criado:', orderId);

  // 2. Chamar a Edge Function create-payment
  console.log('Chamando Edge Function create-payment (PIX)...');
  const paymentRes = await fetch(CREATE_PAYMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No auth needed for this public function as per config.toml
    },
    body: JSON.stringify({
      orderId: orderId,
      name: 'TESTE INTEGRACAO SCRIPT',
      email: 'teste@exemplo.com',
      phone: '69999999999',
      billingType: 'PIX',
      value: 50.00,
      description: 'Teste de Integração Balneário Lessa'
    })
  });

  const paymentResult = await paymentRes.json();
  
  if (paymentRes.ok && paymentResult.success) {
    console.log('SUCESSO! Pagamento gerado no Asaas.');
    console.log('ID do Pagamento:', paymentResult.paymentId);
    if (paymentResult.pix) {
       console.log('PIX Payload recebido com sucesso!');
       // console.log('Payload:', paymentResult.pix.payload);
    }
  } else {
    console.error('ERRO na Edge Function:', paymentResult);
  }
}

testPayment();
