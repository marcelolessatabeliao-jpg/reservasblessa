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
    const body = await req.json()
    const { action, orderId, paymentId } = body

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('A variável ASAAS_API_KEY não foi configurada.');

    const isProd = ASAAS_API_KEY.startsWith('aact_live_');
    const DEFAULT_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL') || DEFAULT_URL;

    // AÇÃO EM LOTE: Listar clientes com assinaturas/parcelas ativas ou em aberto no Asaas (somente leitura/prévia)
    if (action === 'list-asaas-installments') {
      const fetchAsaasJson = async (path: string) => {
        const res = await fetch(`${ASAAS_URL}${path}`, {
          headers: { access_token: ASAAS_API_KEY },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(`Asaas (${path}): ${json.errors?.[0]?.description || res.statusText}`);
        }
        return json;
      };

      const fetchAllPages = async (basePath: string, maxPages = 6) => {
        const all: any[] = [];
        const limit = 100;
        for (let page = 0; page < maxPages; page++) {
          const sep = basePath.includes('?') ? '&' : '?';
          const json = await fetchAsaasJson(`${basePath}${sep}limit=${limit}&offset=${page * limit}`);
          const chunk = Array.isArray(json?.data) ? json.data : [];
          all.push(...chunk);
          if (!json?.hasMore || chunk.length < limit) break;
        }
        return all;
      };

      const [activeSubs, pendingPayments, overduePayments] = await Promise.all([
        fetchAllPages('/subscriptions?status=ACTIVE', 6).catch(() => []),
        fetchAllPages('/payments?status=PENDING', 6).catch(() => []),
        fetchAllPages('/payments?status=OVERDUE', 4).catch(() => []),
      ]);

      const subsByCustomer = new Map<string, any[]>();
      const activeCustomerIds = new Set<string>();

      for (const s of activeSubs) {
        if (!s?.customer) continue;
        activeCustomerIds.add(s.customer);
        const list = subsByCustomer.get(s.customer) || [];
        list.push({
          id: s.id,
          value: Number(s.value || 0),
          cycle: s.cycle || 'MONTHLY',
          billingType: s.billingType || 'UNDEFINED',
          description: s.description || '',
          status: s.status || 'ACTIVE',
          nextDueDate: s.nextDueDate || '',
          dateCreated: s.dateCreated || '',
        });
        subsByCustomer.set(s.customer, list);
      }

      const openPaymentsByCustomer = new Map<string, any[]>();
      for (const p of [...pendingPayments, ...overduePayments]) {
        if (!p?.customer || p.deleted) continue;
        activeCustomerIds.add(p.customer);
        const list = openPaymentsByCustomer.get(p.customer) || [];
        list.push(p);
        openPaymentsByCustomer.set(p.customer, list);
      }

      const customerIds = Array.from(activeCustomerIds);
      const maxCustomers = Number(body.maxCustomers || 150);
      const truncated = customerIds.length > maxCustomers;
      const targetIds = customerIds.slice(0, maxCustomers);

      const isSubText = (text: string) =>
        /lessa\s*club|assinatura|mensalidade|carn[eê]|student|professor|servidor|vital[ií]cio|kids|pcd|tea|fidelidade|anual|pass/i.test(text);
      const isResText = (text: string) =>
        /reserva|chal[eé]|quiosque|day\s*use|camping|ingresso|entrada\s+avulsa|quadriciclo|voucher|pedido\s+#/i.test(text);

      const items: any[] = [];
      const batchSize = 6;
      for (let i = 0; i < targetIds.length; i += batchSize) {
        const chunk = targetIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          chunk.map(async (custId) => {
            try {
              const [custData, custPaymentsRes] = await Promise.all([
                fetchAsaasJson(`/customers/${custId}`),
                fetchAsaasJson(`/payments?customer=${custId}&limit=100`),
              ]);

              const rawPayments = Array.isArray(custPaymentsRes?.data)
                ? custPaymentsRes.data.filter((p: any) => !p.deleted)
                : (openPaymentsByCustomer.get(custId) || []);

              // Ordena por vencimento ascendente
              rawPayments.sort((a: any, b: any) =>
                String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
              );

              const subsList = subsByCustomer.get(custId) || [];
              const mappedPayments = rawPayments.map((p: any) => {
                const text = `${p.description || ''} ${p.externalReference || ''}`.trim();
                const val = Number(p.value || 0);
                const looksLikeReservation = isResText(text) && !p.subscription && !isSubText(text);
                const looksLikeSub =
                  Boolean(p.subscription) ||
                  Boolean(p.installment) ||
                  isSubText(text) ||
                  Math.abs(val - 49.9) < 0.05 ||
                  Math.abs(val - 44.91) < 0.05 ||
                  Math.abs(val - 25.0) < 0.05 ||
                  Math.abs(val - 22.5) < 0.05;

                return {
                  id: p.id,
                  value: val,
                  netValue: Number(p.netValue || val),
                  billingType: p.billingType || 'UNDEFINED',
                  status: p.status || 'PENDING',
                  dueDate: p.dueDate || '',
                  paidAt: p.confirmedDate || p.paymentDate || p.clientPaymentDate || undefined,
                  description: p.description || '',
                  invoiceUrl: p.invoiceUrl || p.bankSlipUrl || '',
                  subscriptionId: p.subscription || undefined,
                  installmentId: p.installment || undefined,
                  installmentNumber: p.installmentNumber || undefined,
                  externalReference: p.externalReference || '',
                  looksLikeReservation,
                  looksLikeSub,
                };
              });

              const hasActiveSubscription = subsList.length > 0;
              const hasInstallments = mappedPayments.some((p: any) => Boolean(p.installmentId));
              const hasSubTextSignal =
                subsList.some((s: any) => isSubText(s.description || '')) ||
                mappedPayments.some((p: any) => p.looksLikeSub);
              const hasResSignal = mappedPayments.some((p: any) => p.looksLikeReservation);
              const hasHalfPriceCharge = mappedPayments.some(
                (p: any) => Math.abs(p.value - 25.0) < 0.05 || Math.abs(p.value - 22.5) < 0.05
              );

              let likelyCategory: 'SUBSCRIPTION' | 'RESERVATION' | 'MIXED' | 'OTHER' = 'OTHER';
              if (hasActiveSubscription || hasInstallments || hasSubTextSignal) {
                likelyCategory = hasResSignal && !hasActiveSubscription ? 'MIXED' : 'SUBSCRIPTION';
              } else if (hasResSignal) {
                likelyCategory = 'RESERVATION';
              }

              return {
                customerId: custId,
                name: custData?.name || 'Cliente Asaas',
                cpfCnpj: custData?.cpfCnpj || '',
                email: custData?.email || '',
                phone: custData?.mobilePhone || custData?.phone || '',
                subscriptions: subsList,
                payments: mappedPayments,
                likelyCategory,
                hasActiveSubscription,
                hasInstallments,
                hasHalfPriceCharge,
              };
            } catch (custErr: any) {
              console.warn(`[check-payment] Error loading customer ${custId}:`, custErr?.message);
              return null;
            }
          })
        );
        for (const r of batchResults) {
          if (r) items.push(r);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          isProd,
          totalFound: customerIds.length,
          returnedCount: items.length,
          truncated,
          items,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (!orderId && !paymentId) throw new Error('OrderId ou PaymentId é obrigatório')

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
