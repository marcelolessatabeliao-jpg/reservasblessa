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

    // AÇÃO: Sincronizar todos os pagamentos confirmados recentemente no Asaas com as faturas do Lessa Club
    if (action === 'sync-recent-club-payments') {
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

      const [confirmedJson, receivedJson] = await Promise.all([
        fetchAsaasJson('/payments?status=CONFIRMED&limit=100').catch(() => ({ data: [] })),
        fetchAsaasJson('/payments?status=RECEIVED&limit=100').catch(() => ({ data: [] })),
      ]);

      const paidPayments = [
        ...(Array.isArray(confirmedJson?.data) ? confirmedJson.data : []),
        ...(Array.isArray(receivedJson?.data) ? receivedJson.data : [])
      ].filter((p: any) => !p.deleted);

      const paidById = new Map<string, any>();
      for (const p of paidPayments) {
        paidById.set(p.id, p);
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );

      let updatedCount = 0;
      let activatedCount = 0;
      const nowIso = new Date().toISOString();
      const updatedByCode = new Map<string, any>();

      const processSubRecentPayments = (sub: any): boolean => {
        let subHasNewlyPaidInvoice = false;

        for (const inv of (sub.invoices || [])) {
          if (inv.status === 'PAID') continue;

          let paidMatch = inv.asaasPaymentId ? paidById.get(inv.asaasPaymentId) : null;
          if (!paidMatch && sub.subscriptionCode) {
            paidMatch = paidPayments.find((p: any) =>
              (p.dueDate === inv.dueDate || !inv.dueDate) &&
              typeof p.description === 'string' &&
              p.description.includes(sub.subscriptionCode)
            );
          }
          if (paidMatch) {
            inv.status = 'PAID';
            inv.asaasPaymentId = paidMatch.id;
            inv.paidAt = paidMatch.paymentDate || paidMatch.clientPaymentDate || paidMatch.confirmedDate || nowIso;
            if (paidMatch.value && Number(paidMatch.value) > 0) {
              inv.amount = Number(paidMatch.value);
            }
            if (paidMatch.billingType) {
              inv.paymentMethod = paidMatch.billingType === 'BOLETO' ? 'BOLETO' : paidMatch.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
            }
            subHasNewlyPaidInvoice = true;
            updatedCount++;
          }
        }

        if (subHasNewlyPaidInvoice) {
          const hasOverdue = (sub.invoices || []).some((i: any) => i.status === 'OVERDUE');
          const isManualAdminBlock =
            sub.inactivityReason === 'ADMINISTRATIVO' ||
            sub.inactivityReason === 'SOLICITACAO_CLIENTE' ||
            sub.inactivityReason === 'FALTA_DOCUMENTOS' ||
            (sub.status === 'INACTIVE' && sub.manualStatusOverride && sub.inactivityReason !== 'MENSALIDADE_VENCIDA');
          if (!hasOverdue && !isManualAdminBlock && sub.status !== 'ACTIVE') {
            sub.status = 'ACTIVE';
            sub.inactivityReason = undefined;
            sub.inactivityReasons = undefined;
            sub.inactivityNotes = undefined;
            sub.transferCompleted = true;
            sub.manuallyConfirmedTransfer = true;
            (sub.members || []).forEach((m: any) => {
              m.status = 'ACTIVE';
              m.inactivityReason = undefined;
              m.inactivityReasons = undefined;
            });
            activatedCount++;
          }
          sub.updatedAt = nowIso;
          sub.isModifiedFromSeed = true;
          return true;
        }
        return false;
      };

      // 1. Consulta paginada direta em `public.club_records` (suporta 10.000+ cadastros sem limite de 1.000 linhas)
      for (let from = 0; from < 50000; from += 1000) {
        const { data: crPage, error: crErr } = await supabaseAdmin
          .from('club_records')
          .select('subscription_code, payload')
          .order('subscription_code', { ascending: true })
          .range(from, from + 999);
        if (crErr || !Array.isArray(crPage) || crPage.length === 0) break;

        for (const row of crPage) {
          const sub = row.payload;
          if (!sub || typeof sub !== 'object') continue;
          if (processSubRecentPayments(sub)) {
            const code = String(row.subscription_code || sub.subscriptionCode || sub.id || '').trim();
            if (code) {
              updatedByCode.set(code, sub);
              await supabaseAdmin.from('club_records').upsert(
                {
                  subscription_code: code,
                  subscription_id: sub.id || code,
                  holder_name: sub.holderName || '',
                  holder_cpf: sub.holderCpf || '',
                  status: sub.status || 'ACTIVE',
                  payload: sub,
                  updated_at: nowIso,
                  updated_by: 'CHECK_PAYMENT_SYNC',
                },
                { onConflict: 'subscription_code' }
              );
            }
          }
        }
        if (crPage.length < 1000) break;
      }

      // 2. Espelha em `site_settings` somente se contiver assinaturas no snapshot legado
      const { data: settingsRow } = await supabaseAdmin
        .from('site_settings')
        .select('value')
        .eq('key', 'lessa_club_ecosystem_v1')
        .maybeSingle();

      if (settingsRow?.value && Array.isArray(settingsRow.value.subscriptions) && settingsRow.value.subscriptions.length > 0) {
        const clubState = settingsRow.value;
        let stateChanged = false;

        for (let idx = 0; idx < clubState.subscriptions.length; idx += 1) {
          const sub = clubState.subscriptions[idx];
          const code = String(sub.subscriptionCode || sub.id || '').trim();
          if (code && updatedByCode.has(code)) {
            clubState.subscriptions[idx] = updatedByCode.get(code);
            stateChanged = true;
            continue;
          }
          if (processSubRecentPayments(sub)) {
            stateChanged = true;
            if (code && !updatedByCode.has(code)) {
              await supabaseAdmin.from('club_records').upsert(
                {
                  subscription_code: code,
                  subscription_id: sub.id || code,
                  holder_name: sub.holderName || '',
                  holder_cpf: sub.holderCpf || '',
                  status: sub.status || 'ACTIVE',
                  payload: sub,
                  updated_at: nowIso,
                  updated_by: 'CHECK_PAYMENT_SYNC',
                },
                { onConflict: 'subscription_code' }
              );
            }
          }
        }

        if (stateChanged) {
          await supabaseAdmin
            .from('site_settings')
            .update({ value: clubState, updated_at: nowIso })
            .eq('key', 'lessa_club_ecosystem_v1');
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updatedCount,
          activatedCount,
          totalPaidInspected: paidById.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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
      // 1. Buscar o external_id do pagamento na tabela payments
      const { data: payData, error: payError } = await supabaseAdmin
        .from('payments')
        .select('external_id, status')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (payData?.external_id) {
        externalId = payData.external_id;
        payStatus = payData.status;
      } else {
        // 1b. Tentar direto na coluna payment_id de orders
        const { data: orderData } = await supabaseAdmin
          .from('orders')
          .select('payment_id, customer_cpf, total_amount')
          .eq('id', orderId)
          .maybeSingle();

        if (orderData?.payment_id) {
          externalId = orderData.payment_id;
        } else if (orderData?.customer_cpf) {
          // 1c. Tentar buscar cobrança correspondente no Asaas pelo CPF do cliente
          try {
            const cleanCpf = orderData.customer_cpf.replace(/\D/g, '');
            if (cleanCpf) {
              const custRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
                headers: { access_token: ASAAS_API_KEY },
              });
              const custJson = await custRes.json();
              const custId = custJson?.data?.[0]?.id;
              if (custId) {
                const paysRes = await fetch(`${ASAAS_URL}/payments?customer=${custId}&limit=10`, {
                  headers: { access_token: ASAAS_API_KEY },
                });
                const paysJson = await paysRes.json();
                const pays = paysJson?.data || [];
                const confirmedPay = pays.find((p: any) => !p.deleted && (p.status === 'RECEIVED' || p.status === 'CONFIRMED')) || pays[0];
                if (confirmedPay?.id) {
                  externalId = confirmedPay.id;
                }
              }
            }
          } catch (eCpf) {
            console.warn('[check-payment] Falha ao consultar Asaas por CPF:', eCpf);
          }
        }
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
            .update({ 
              status: 'paid', 
              payment_id: externalId,
              updated_at: new Date().toISOString() 
            })
            .eq('id', orderId);
        }

        if (externalId) {
          await supabaseAdmin
            .from('payments')
            .upsert({
              order_id: orderId || null,
              external_id: externalId,
              metodo: asaasData.billingType || 'PIX',
              status: 'paid',
              updated_at: new Date().toISOString()
            }, { onConflict: 'external_id' });
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

      // Sincronizar Lessa Club Ecosystem diretamente em `public.club_records` (paginado) + espelho legado `site_settings`
      try {
        const nowIso = new Date().toISOString();
        const applySinglePaymentToSub = (sub: any): boolean => {
          let subInvoicePaid = false;
          let changed = false;
          for (const inv of (sub.invoices || [])) {
            const matches =
              (orderId && inv.id === orderId) ||
              (inv.asaasPaymentId && inv.asaasPaymentId === externalId);
            const matchesSubUnified = orderId && orderId.startsWith(`unified_${sub.id}`);

            if (matches || matchesSubUnified) {
              if (inv.status !== 'PAID') {
                inv.status = 'PAID';
                inv.paidAt = asaasData?.paymentDate || asaasData?.clientPaymentDate || asaasData?.confirmedDate || nowIso;
                inv.asaasPaymentId = externalId;
                if (asaasData?.value && Number(asaasData.value) > 0) {
                  inv.amount = Number(asaasData.value);
                }
                if (asaasData?.billingType) {
                  inv.paymentMethod = asaasData.billingType === 'BOLETO' ? 'BOLETO' : asaasData.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
                }
                subInvoicePaid = true;
                changed = true;
              }
            }
          }

          const isSubTarget =
            subInvoicePaid ||
            (sub.asaasPaymentId && sub.asaasPaymentId === externalId) ||
            (orderId && orderId.startsWith(`unified_${sub.id}`));

          if (isSubTarget) {
            const hasOverdue = (sub.invoices || []).some((i: any) => i.status === 'OVERDUE');
            const isManualAdminBlock =
              sub.inactivityReason === 'ADMINISTRATIVO' ||
              sub.inactivityReason === 'SOLICITACAO_CLIENTE' ||
              sub.inactivityReason === 'FALTA_DOCUMENTOS';
            if (!hasOverdue && !isManualAdminBlock && sub.status !== 'ACTIVE') {
              sub.status = 'ACTIVE';
              sub.inactivityReason = undefined;
              sub.inactivityReasons = undefined;
              sub.inactivityNotes = undefined;
              sub.transferCompleted = true;
              sub.manuallyConfirmedTransfer = true;
              (sub.members || []).forEach((m: any) => {
                m.status = 'ACTIVE';
              });
              changed = true;
            }
            if (changed) {
              sub.updatedAt = nowIso;
              sub.isModifiedFromSeed = true;
            }
          }
          return changed;
        };

        const updatedSingleMap = new Map<string, any>();
        for (let from = 0; from < 50000; from += 1000) {
          const { data: crPage, error: crErr } = await supabaseAdmin
            .from('club_records')
            .select('subscription_code, payload')
            .order('subscription_code', { ascending: true })
            .range(from, from + 999);
          if (crErr || !Array.isArray(crPage) || crPage.length === 0) break;

          for (const row of crPage) {
            const sub = row.payload;
            if (!sub || typeof sub !== 'object') continue;
            if (applySinglePaymentToSub(sub)) {
              const code = String(row.subscription_code || sub.subscriptionCode || sub.id || '').trim();
              if (code) {
                updatedSingleMap.set(code, sub);
                await supabaseAdmin.from('club_records').upsert(
                  {
                    subscription_code: code,
                    subscription_id: sub.id || code,
                    holder_name: sub.holderName || '',
                    holder_cpf: sub.holderCpf || '',
                    status: sub.status || 'ACTIVE',
                    payload: sub,
                    updated_at: nowIso,
                    updated_by: 'CHECK_PAYMENT_SINGLE',
                  },
                  { onConflict: 'subscription_code' }
                );
              }
            }
          }
          if (crPage.length < 1000) break;
        }

        // Só toca no espelho legado `site_settings` se o cadastro NÃO foi encontrado em `club_records`
        if (updatedSingleMap.size === 0) {
          const { data: settingsRow } = await supabaseAdmin
            .from('site_settings')
            .select('value')
            .eq('key', 'lessa_club_ecosystem_v1')
            .maybeSingle();

          if (settingsRow?.value && Array.isArray(settingsRow.value.subscriptions) && settingsRow.value.subscriptions.length > 0) {
            const clubState = settingsRow.value;
            let clubUpdated = false;

            for (let idx = 0; idx < clubState.subscriptions.length; idx += 1) {
              const sub = clubState.subscriptions[idx];
              if (applySinglePaymentToSub(sub)) {
                clubUpdated = true;
                const code = String(sub.subscriptionCode || sub.id || '').trim();
                if (code) {
                  await supabaseAdmin.from('club_records').upsert(
                    {
                      subscription_code: code,
                      subscription_id: sub.id || code,
                      holder_name: sub.holderName || '',
                      holder_cpf: sub.holderCpf || '',
                      status: sub.status || 'ACTIVE',
                      payload: sub,
                      updated_at: nowIso,
                      updated_by: 'CHECK_PAYMENT_SINGLE',
                    },
                    { onConflict: 'subscription_code' }
                  );
                }
              }
            }

            if (clubUpdated) {
              await supabaseAdmin
                .from('site_settings')
                .update({ value: clubState, updated_at: nowIso })
                .eq('key', 'lessa_club_ecosystem_v1');
            }
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
