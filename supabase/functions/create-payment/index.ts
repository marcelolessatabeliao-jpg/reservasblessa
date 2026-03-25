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
    const { orderId, name, email, phone, cpf, billingType, value, description } = await req.json()

    // 1. Chave de API e URL (Ambiente Real)
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('A variável ASAAS_API_KEY não foi configurada.');

    const isProd = ASAAS_API_KEY.startsWith('aact_live_');
    const DEFAULT_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL') || DEFAULT_URL;

    // 2. Limpeza de Dados
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';

    if (!cleanCpf) throw new Error('Para cobranças reais em produção, o CPF é obrigatório.');

    // 3. Criar/Vincular Cliente no Asaas
    const customerReq = await fetch(`${ASAAS_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        name: name,
        cpfCnpj: cleanCpf,
        email: email || 'cliente@balneariolessa.com.br',
        mobilePhone: cleanPhone
      })
    });

    const customerData = await customerReq.json();
    if (!customerReq.ok) {
       throw new Error(`Asaas (Cliente): ${customerData.errors?.[0]?.description || 'Erro ao criar cadastro'}`);
    }

    // 4. Gerar Cobrança (PIX ou CARTÃO)
    const paymentReq = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: billingType,
        value: Number(Number(value).toFixed(2)),
        dueDate: new Date().toISOString().split('T')[0],
        description: description || `Reserva Balneário Lessa`,
        externalReference: orderId
      })
    });

    const paymentData = await paymentReq.json();
    if (!paymentReq.ok) {
        throw new Error(`Asaas (Cobrança): ${paymentData.errors?.[0]?.description || 'Erro ao gerar cobrança'}`);
    }

    // 5. Dados do PIX (Se for PIX)
    let pixData = null;
    if (billingType === 'PIX') {
      const pixReq = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
        headers: { 'access_token': ASAAS_API_KEY }
      });
      pixData = await pixReq.json();
    }

    // 6. Registro no Supabase (Opcional - mas ajuda no Dashboard)
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    try {
        await supabaseAdmin.from('payments').insert({
            order_id: orderId,
            gateway: 'asaas',
            metodo: billingType,
            status: 'pending',
            external_id: paymentData.id,
            payment_url: paymentData.invoiceUrl
        });
    } catch (e) { console.warn('Erro ao salvar log de pagamento:', e); }

    return new Response(JSON.stringify({
      success: true,
      data: {
        paymentId: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        pix: pixData ? { encodedImage: pixData.encodedImage, payload: pixData.payload } : null
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
    });
  }
})
