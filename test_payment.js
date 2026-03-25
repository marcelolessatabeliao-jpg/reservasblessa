
const SUPABASE_URL = 'https://lcymbetnnuokrijynmjm.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794';

async function testPaymentSystem() {
  console.log('--- TESTE DO SISTEMA DE PAGAMENTO ---');
  
  // 1. Criar um pedido de teste
  console.log('1. Criando pedido de teste...');
  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      customer_name: 'TESTE ANTIGRAVITY',
      customer_phone: '11999999999',
      visit_date: '2026-03-30',
      total_amount: 1.00, // Valor baixo para teste
      status: 'pending'
    })
  });

  if (!orderRes.ok) {
    console.error('Falha ao criar pedido:', await orderRes.text());
    return;
  }
  const orders = await orderRes.json();
  const order = orders[0];
  console.log('Pedido criado ID:', order.id);

  // 2. Chamar a Edge Function create-payment para gerar um PIX
  console.log('2. Chamando create-payment Edge Function (PIX)...');
  const paymentRes = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId: order.id,
      name: 'TESTE ANTIGRAVITY',
      email: 'teste@exemplo.com',
      phone: '11999999999',
      billingType: 'PIX',
      value: 1.00,
      description: 'Teste de Integração Antigravity'
    })
  });

  if (!paymentRes.ok) {
    const error = await paymentRes.text();
    console.error('Falha na Edge Function create-payment:', error);
    if (error.includes('JWT')) console.log('DICA: Verifique se a ANON_KEY é válida para invocar funções.');
    return;
  }

  const paymentData = await paymentRes.json();
  console.log('Resultado create-payment:', JSON.stringify(paymentData, null, 2));

  if (paymentData.pix) {
    console.log('SUCESSO: PIX Gerado com sucesso!');
  } else if (paymentData.invoiceUrl) {
    console.log('SUCESSO: Link de Cobrança Gerado!');
  } else {
    console.log('AVISO: Resposta incompleta (verifique se os logs do Asaas no console do Supabase mostram erros).');
  }

  // 3. Simular Webhook (Opcional)
  if (paymentData.paymentId) {
    console.log('3. Simulando Webhook de confirmação...');
    const webhookRes = await fetch(`${SUPABASE_URL}/functions/v1/asaas-webhook`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: paymentData.paymentId,
          externalReference: order.id,
          status: 'RECEIVED',
          value: 1.00
        }
      })
    });

    if (webhookRes.ok) {
      console.log('SUCESSO: Webhook simulado com sucesso!');
      
      // 4. Verificar se o status do pedido mudou para 'paid'
      console.log('4. Verificando status final do pedido...');
      const finalCheck = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}&select=status,confirmation_code`, {
        headers: { 'apikey': ANON_KEY }
      });
      const finalData = await finalCheck.json();
      console.log('Status Final:', finalData[0]?.status, '| Código:', finalData[0]?.confirmation_code);
    } else {
      console.error('Falha ao simular webhook:', await webhookRes.text());
    }
  }

  console.log('--- TESTE CONCLUÍDO ---');
}

testPaymentSystem();
