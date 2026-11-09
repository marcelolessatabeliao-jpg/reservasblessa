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
    const { orderId, paymentId } = await req.json()
    if (!orderId && !paymentId) throw new Error('OrderId ou PaymentId é obrigatório')

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('A variável ASAAS_API_KEY não foi configurada.');

    const isProd = ASAAS_API_KEY.startsWith('aact_live_');
    const DEFAULT_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL') || DEFAULT_URL;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    let externalId = paymentId;
    let payStatus = 'pending';

    if (!externalId && orderId) {
      // 1. Buscar o external_id do pagamento
      const { data: payData, error: payError } = await supabaseAdmin
        .from('payments')
        .select('external_id, status')
        .eq('order_id', orderId)
        .eq('gateway', 'asaas')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (payError) throw payError
      if (payData?.external_id) {
        externalId = payData.external_id;
        payStatus = payData.status;
      }
    }

    if (!externalId) {
       return new Response(JSON.stringify({ 
         success: false, 
         error: 'Nenhum pagamento Asaas encontrado para este pedido.' 
       }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Consultar Asaas
    const response = await fetch(`${ASAAS_URL}/payments/${externalId}`, {
      headers: { 'access_token': ASAAS_API_KEY }
    })

    const asaasData = await response.json()
    if (!response.ok) {
      throw new Error(`Asaas: ${asaasData.errors?.[0]?.description || 'Erro ao consultar'}`)
    }

    const asaasStatus = asaasData.status; // RECEIVED, CONFIRMED, OVERDUE, etc.
    const isPaid = asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED';

    let updated = false;
    if (isPaid && payStatus !== 'paid' && orderId) {
      try {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', orderId);

        if (externalId) {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('external_id', externalId);
        }

        const { data: orderData } = await supabaseAdmin.from('orders').select('booking_id').eq('id', orderId).maybeSingle();
        if (orderData?.booking_id) {
          await supabaseAdmin.from('bookings').update({ status: 'paid' }).eq('id', orderData.booking_id);
        }
        updated = true;
      } catch (errDb) {
        console.warn('Non-fatal db sync in check-payment:', errDb);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status: asaasStatus,
      updated,
      data: asaasData
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    })
  }
})
