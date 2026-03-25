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
    const { orderId, name, email, phone, billingType, value, description } = await req.json()

    if (!orderId || !name || !billingType || !value) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    
    if (!ASAAS_API_KEY) {
      console.error('ASAAS_API_KEY and ASAAS_BASE_URL must be set in Supabase Secrets');
      return new Response(JSON.stringify({ error: 'Configuração do gateway pendente (Chave ausente)' }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Auto-detect environment based on key prefix
    const isProduction = ASAAS_API_KEY.startsWith('aact_live_');
    const DEFAULT_BASE_URL = isProduction ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') || DEFAULT_BASE_URL;

    console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
    console.log(`Processing payment for ${name} (${billingType}, Phone: ${phone}) - Value: ${value}`);

    // 1. Criar/Buscar cliente no Asaas
    console.log('Step 1: Creating/Finding customer...');
    // Dica: Para evitar duplicados, em produção o ideal seria buscar por email primeiro, 
    // mas para reservas rápidas a criação direta funciona bem.
    const customerReq = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify({
        name: name || 'Cliente Site',
        email: email || 'cliente@balneariolessa.com.br',
        mobilePhone: phone || null
      })
    });
    
    const customerData = await customerReq.json();
    if (!customerReq.ok) {
      console.error('Asaas Customer Error:', JSON.stringify(customerData));
      return new Response(JSON.stringify({ error: customerData.errors?.[0]?.description || 'Erro ao preparar cadastro no Asaas' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const customerId = customerData.id;
    console.log('Customer ID created/found:', customerId);

    // 2. Criar cobrança no Asaas
    console.log('Step 2: Creating charge...');
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
        value: Number(Number(value).toFixed(2)),
        dueDate,
        description: description || 'Reserva Balneário Lessa',
        externalReference: orderId
      })
    });

    const paymentData = await paymentReq.json();
    if (!paymentReq.ok) {
      console.error('Asaas Payment Error:', JSON.stringify(paymentData));
      return new Response(JSON.stringify({ error: paymentData.errors?.[0]?.description || 'Erro ao gerar boleto/pix' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('Payment created:', paymentData.id);

    // 3. Obter QR Code / Pix Payload (se aplicável)
    let pixDetails = null;
    if (billingType === 'PIX') {
      console.log('Step 3: Getting PIX QR Code details...');
      const pixReq = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      });
      pixDetails = await pixReq.json();
      console.log('PIX details received.');
    }

    // Initialize Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // 4. Salvar registro no banco (opcional, para controle interno)
    try {
      await supabaseAdmin.from('payments').insert({
        order_id: orderId,
        gateway: 'asaas',
        metodo: billingType,
        status: 'pending',
        external_id: paymentData.id,
        payment_url: billingType === 'CREDIT_CARD' ? paymentData.invoiceUrl : null
      });
    } catch (dbErr) {
      console.warn('Silent failure saving payment record:', dbErr);
    }

    // Retorno ao Front-End
    return new Response(JSON.stringify({
      success: true,
      paymentId: paymentData.id,
      invoiceUrl: paymentData.invoiceUrl,
      pix: pixDetails ? {
        encodedImage: pixDetails.encodedImage, 
        payload: pixDetails.payload 
      } : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Internal Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro inesperado no servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
