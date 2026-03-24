import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, name, email, billingType, value, description } = await req.json()

    if (!orderId || !name || !billingType || !value) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmNhYWE0MGM3LWUyYzgtNGU1Yy1hMjRjLWE0YmExZmY5MmUwNzo6JGFhY2hfODlkMDkwZDctMmJjZi00ZmI1LWE2NzEtMzJiOGM5MmI1NDNi';
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') || 'https://www.asaas.com/api/v3';

    // 1. Criar cliente no Asaas
    const customerReq = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify({
        name,
        email: email || 'cliente@asaas.com.br', // Email é recomendado
      })
    });
    
    const customerData = await customerReq.json();
    if (!customerReq.ok) {
      console.error('Asaas Customer Error:', customerData);
      throw new Error(customerData.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
    }

    const customerId = customerData.id;

    // 2. Criar cobrança no Asaas
    // Vencimento = Hoje
    const dueDate = new Date().toISOString().split('T')[0];

    const paymentReq = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify({
        customer: customerId,
        billingType,
        value,
        dueDate,
        description: description || 'Reserva Balneário Lessa',
        externalReference: orderId
      })
    });

    const paymentData = await paymentReq.json();
    if (!paymentReq.ok) {
      console.error('Asaas Payment Error:', paymentData);
      throw new Error(paymentData.errors?.[0]?.description || 'Erro ao gerar cobrança');
    }

    // 3. Obter QR Code / Pix Payload (se aplicável)
    let pixData = null;
    if (billingType === 'PIX') {
      const pixReq = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      });
      pixData = await pixReq.json();
    }

    // Initialize Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    );

    // 4. Salvar registro no banco (tabela payments)
    const { error: dbError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: orderId,
        gateway: 'asaas',
        metodo: billingType,
        status: 'pending',
        external_id: paymentData.id,
        payment_url: billingType === 'CREDIT_CARD' ? paymentData.invoiceUrl : null
      });

    if (dbError) {
      console.error('Error saving payment locally:', dbError);
      // Nós continuamos mesmo com erro local para garantir que a tela receba o QRCode.
    }

    // Retorno ao Front-End
    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl,
      pix: pixData ? {
        encodedImage: pixData.encodedImage, // Base64 image
        payload: pixData.payload // Copia e cola
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
