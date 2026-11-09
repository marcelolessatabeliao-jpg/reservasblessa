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
    if (isPaid) {
      // Atualizar orders e payments
      try {
        if (orderId) {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', orderId);
        }

        if (externalId) {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('external_id', externalId);
        }

        if (orderId) {
          const { data: orderData } = await supabaseAdmin.from('orders').select('booking_id').eq('id', orderId).maybeSingle();
          if (orderData?.booking_id) {
            await supabaseAdmin.from('bookings').update({ status: 'paid' }).eq('id', orderData.booking_id);
          }
        }
        updated = true;
      } catch (errDb) {
        console.warn('Non-fatal db sync in check-payment:', errDb);
      }

      // Sincronizar Lessa Club Ecosystem (Assinatura, Faturas e Membros)
      try {
        const { data: settingsRow } = await supabaseAdmin
          .from('site_settings')
          .select('value')
          .eq('key', 'lessa_club_ecosystem_v1')
          .maybeSingle();

        if (settingsRow?.value) {
          const clubState = settingsRow.value;
          let clubUpdated = false;

          for (const sub of (clubState.subscriptions || [])) {
            let subInvoicePaid = false;
            for (const inv of (sub.invoices || [])) {
              const matches =
                (orderId && inv.id === orderId) ||
                (inv.asaasPaymentId && inv.asaasPaymentId === externalId);
              const matchesSubUnified = orderId && orderId.startsWith(`unified_${sub.id}`);

              if (matches || matchesSubUnified) {
                if (inv.status !== 'PAID') {
                  inv.status = 'PAID';
                  inv.paidAt = new Date().toISOString();
                  inv.asaasPaymentId = externalId;
                  subInvoicePaid = true;
                  clubUpdated = true;
                }
              }
            }

            const isSubTarget =
              subInvoicePaid ||
              (sub.asaasPaymentId && sub.asaasPaymentId === externalId) ||
              (orderId && orderId.startsWith(`unified_${sub.id}`));

            if (isSubTarget) {
              const hasOverdue = (sub.invoices || []).some((i: any) => i.status === 'OVERDUE');
              if (!hasOverdue) {
                sub.status = 'ACTIVE';
                (sub.members || []).forEach((m: any) => {
                  m.status = 'ACTIVE';
                });
                sub.updatedAt = new Date().toISOString();
                clubUpdated = true;
              }
            }
          }

          if (clubUpdated) {
            await supabaseAdmin
              .from('site_settings')
              .update({ value: clubState, updated_at: new Date().toISOString() })
              .eq('key', 'lessa_club_ecosystem_v1');
          }
        }
      } catch (clubErr) {
        console.warn('[check-payment] Error syncing club state:', clubErr);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status: asaasStatus,
      isPaid,
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
