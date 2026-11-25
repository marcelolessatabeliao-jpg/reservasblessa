import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log(`[create-payment] Started ${req.method}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const {
      action,
      paymentId,
      orderId,
      name,
      email,
      phone,
      cpf,
      billingType,
      value,
      description,
      dueDate,
      installmentCount,
      installmentValue,
      totalValue,
    } = body;

    // 1. Chave de API e URL (Ambiente Real)
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) throw new Error('A variável ASAAS_API_KEY não foi configurada.');

    const isProd = ASAAS_API_KEY.startsWith('aact_live_');
    const DEFAULT_URL = isProd ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const ASAAS_URL = Deno.env.get('ASAAS_BASE_URL') || DEFAULT_URL;

    // Sincronização / Atualização de Vencimento e Valor no Asaas
    if (action === 'update-due-date' || action === 'update') {
      const targetPaymentId = paymentId || orderId;
      if (!targetPaymentId) throw new Error('paymentId é obrigatório para atualizar cobrança no Asaas.');
      
      const updatePayload: Record<string, any> = {};
      if (dueDate) updatePayload.dueDate = dueDate;
      if (value) updatePayload.value = Number(Number(value).toFixed(2));

      const updateReq = await fetch(`${ASAAS_URL}/payments/${targetPaymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify(updatePayload),
      });

      const updateData = await updateReq.json();
      if (!updateReq.ok) {
        throw new Error(`Asaas (Atualizar Cobrança): ${updateData.errors?.[0]?.description || 'Erro ao sincronizar cobrança no Asaas'}`);
      }

      return new Response(JSON.stringify({
        success: true,
        data: updateData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Exclusão / Cancelamento Oficial de Cobrança no Asaas
    if (action === 'delete' || action === 'delete-payment') {
      const targetPaymentId = paymentId || orderId;
      if (!targetPaymentId) throw new Error('paymentId é obrigatório para excluir cobrança no Asaas.');

      const deleteReq = await fetch(`${ASAAS_URL}/payments/${targetPaymentId}`, {
        method: 'DELETE',
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      const deleteData = await deleteReq.json();
      if (!deleteReq.ok && deleteReq.status !== 404) {
        const errMsg = deleteData.errors?.[0]?.description || 'Erro ao excluir cobrança no Asaas';
        throw new Error(`Asaas (Excluir Cobrança): ${errMsg}`);
      }

      return new Response(JSON.stringify({
        success: true,
        data: deleteData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Obter QR Code PIX e Dados da Cobrança Existente no Asaas (sem duplicar cobranças)
    if (action === 'get-pix-qr-code' || action === 'get-pix') {
      let targetPaymentId = paymentId || orderId;
      if (!targetPaymentId && body.invoiceUrl) {
        const match = String(body.invoiceUrl).match(/\/i\/([a-zA-Z0-9]+)/);
        if (match) {
          targetPaymentId = `pay_${match[1]}`;
        }
      }
      if (!targetPaymentId) throw new Error('paymentId ou invoiceUrl é obrigatório para obter o QR Code do PIX.');

      // Busca dados da cobrança
      const payReq = await fetch(`${ASAAS_URL}/payments/${targetPaymentId}`, {
        headers: { 'access_token': ASAAS_API_KEY },
      });
      const payData = payReq.ok ? await payReq.json() : null;

      const isPaid =
        payData?.status === 'CONFIRMED' ||
        payData?.status === 'RECEIVED' ||
        payData?.status === 'RECEIVED_IN_CASH';
      const isDeleted = Boolean(payData?.deleted);

      // Busca QR Code PIX apenas se a cobrança ainda estiver em aberto e não excluída
      let pixOk = false;
      let pixData: any = null;
      let pixError: string | null = null;
      if (!isPaid && !isDeleted) {
        const pixReq = await fetch(`${ASAAS_URL}/payments/${targetPaymentId}/pixQrCode`, {
          headers: { 'access_token': ASAAS_API_KEY },
        });
        pixOk = pixReq.ok;
        pixData = await pixReq.json().catch(() => null);
        if (!pixOk) {
          pixError = pixData?.errors?.[0]?.description || `HTTP ${pixReq.status}`;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          paymentId: targetPaymentId,
          invoiceUrl: payData?.invoiceUrl,
          status: payData?.status,
          isPaid,
          deleted: isDeleted,
          value: payData?.value !== undefined ? Number(payData.value) : undefined,
          originalValue: payData?.originalValue !== undefined && payData?.originalValue !== null ? Number(payData.originalValue) : undefined,
          interestValue: payData?.interestValue !== undefined && payData?.interestValue !== null ? Number(payData.interestValue) : undefined,
          dueDate: payData?.dueDate,
          paidAt: payData?.paymentDate || payData?.clientPaymentDate || payData?.confirmedDate || undefined,
          billingType: payData?.billingType,
          pix: pixOk && pixData ? {
            encodedImage: pixData.encodedImage,
            payload: pixData.payload,
            expirationDate: pixData.expirationDate,
          } : null,
          pixError,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Consulta de Todas as Cobranças do Cliente no Asaas por CPF, PaymentId ou CustomerId
    if (action === 'list-customer-charges' || action === 'get-customer-payments') {
      const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : '';
      const targetCustomerIds: string[] = [];

      if (body.customerId) {
        targetCustomerIds.push(String(body.customerId));
      }

      if (cleanCpf) {
        const custReq = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
          headers: { access_token: ASAAS_API_KEY },
        });
        const custData = await custReq.json();
        if (Array.isArray(custData?.data)) {
          for (const c of custData.data) {
            if (c.id && !targetCustomerIds.includes(c.id)) {
              targetCustomerIds.push(c.id);
            }
          }
        }
      }

      if (paymentId) {
        const payReq = await fetch(`${ASAAS_URL}/payments/${paymentId}`, {
          headers: { access_token: ASAAS_API_KEY },
        });
        if (payReq.ok) {
          const payData = await payReq.json();
          if (payData.customer && !targetCustomerIds.includes(payData.customer)) {
            targetCustomerIds.push(payData.customer);
          }
        }
      }

      if (targetCustomerIds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          payments: [],
          customers: [],
          message: 'Nenhum cliente encontrado no Asaas com este CPF ou ID.',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      const allPayments: any[] = [];
      const customersFound: any[] = [];
      const allSubscriptions: any[] = [];
      const debugList: any[] = [];

      for (const custId of targetCustomerIds) {
        const [cDetailsRes, cPaymentsRes, cSubsRes] = await Promise.all([
          fetch(`${ASAAS_URL}/customers/${custId}`, { headers: { access_token: ASAAS_API_KEY } }),
          fetch(`${ASAAS_URL}/payments?customer=${custId}&limit=100`, { headers: { access_token: ASAAS_API_KEY } }),
          fetch(`${ASAAS_URL}/subscriptions?customer=${custId}&limit=20`, { headers: { access_token: ASAAS_API_KEY } }),
        ]);

        if (cDetailsRes.ok) {
          customersFound.push(await cDetailsRes.json());
        }

        if (cSubsRes.ok) {
          const subsJson = await cSubsRes.json();
          if (Array.isArray(subsJson?.data)) {
            allSubscriptions.push(...subsJson.data);
          }
        }

        const payJson = await cPaymentsRes.json().catch((e) => ({ error: e.message }));
        debugList.push({ custId, status: cPaymentsRes.status, payJson });

        if (cPaymentsRes.ok && Array.isArray(payJson?.data)) {
          allPayments.push(...payJson.data);
        }
      }

      allPayments.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

      return new Response(JSON.stringify({
        success: true,
        targetCustomerIds,
        debugList,
        customers: customersFound,
        subscriptions: allSubscriptions,
        payments: allPayments,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Estorno de parcelamento duplicado no Asaas (installmentId ou paymentId)
    if (action === 'refund-installment') {
      const targetInstallmentId = body.installmentId ? String(body.installmentId).trim() : '';
      const targetPaymentId = paymentId ? String(paymentId).trim() : '';
      if (!targetInstallmentId && !targetPaymentId) {
        throw new Error('Informe installmentId ou paymentId para realizar o estorno.');
      }

      const endpoint = targetInstallmentId
        ? `${ASAAS_URL}/installments/${targetInstallmentId}/refund`
        : `${ASAAS_URL}/payments/${targetPaymentId}/refund`;

      const refundReq = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
        body: JSON.stringify(body.value ? { value: Number(body.value) } : {}),
      });
      const refundData = await refundReq.json().catch(() => ({}));
      if (!refundReq.ok) {
        throw new Error(
          `Asaas (Estorno): ${refundData?.errors?.[0]?.description || refundData?.message || 'Erro ao estornar cobrança'}`
        );
      }

      return new Response(JSON.stringify({
        success: true,
        refunded: refundData,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Limpeza e Validação de Dados
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';
    if (!cleanCpf) throw new Error('Para cobranças reais em produção, o CPF é obrigatório.');

    let cleanName = (name || '').trim();
    if (cleanName && !cleanName.includes(' ')) {
      cleanName = `${cleanName} Visitante`;
    }
    if (!cleanName) cleanName = 'Cliente Balneário Lessa';

    let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    if (cleanPhone.length < 10) cleanPhone = '69992222432';
    
    // 2.5 Idempotência: Verificar se já existe um pagamento pendente para este pedido/método (apenas se orderId for UUID válido)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orderId || ''));
    if (isUuid) {
      try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
        const { data: existingPayment } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('order_id', orderId)
            .eq('metodo', billingType)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingPayment?.external_id && existingPayment?.payment_url) {
            // Se for PIX, precisamos recuperar o QR Code novamente
            let pixData = null;
            if (billingType === 'PIX') {
                const pixReq = await fetch(`${ASAAS_URL}/payments/${existingPayment.external_id}/pixQrCode`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                if (pixReq.ok) pixData = await pixReq.json();
            }

            return new Response(JSON.stringify({
                success: true,
                is_reused: true,
                data: {
                    paymentId: existingPayment.external_id,
                    invoiceUrl: existingPayment.payment_url,
                    pix: pixData ? { encodedImage: pixData.encodedImage, payload: pixData.payload } : null
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }
      } catch (errIdemp) {
        console.warn('Erro ao verificar idempotência no banco:', errIdemp);
      }
    }

    // 3. Obter ou Criar Cliente no Asaas (reutiliza se já existir pelo CPF)
    let asaasCustomerId: string | null = null;

    if (cleanCpf) {
      try {
        const existingCustRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
          headers: { 'access_token': ASAAS_API_KEY }
        });
        if (existingCustRes.ok) {
          const custJson = await existingCustRes.json();
          if (custJson?.data && custJson.data.length > 0) {
            asaasCustomerId = custJson.data[0].id;
          }
        }
      } catch (searchErr) {
        console.warn('Erro ao pesquisar cliente por CPF no Asaas:', searchErr);
      }
    }

    if (!asaasCustomerId) {
      const customerReq = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          name: cleanName,
          cpfCnpj: cleanCpf,
          email: email || 'cliente@balneariolessa.com.br',
          mobilePhone: cleanPhone,
          notificationDisabled: false,
        })
      });

      const customerData = await customerReq.json();
      if (customerReq.ok && customerData?.id) {
        asaasCustomerId = customerData.id;
      } else {
        // Se falhou ao criar (ex: duplicidade de CPF detectada pelo Asaas), faz uma segunda busca
        if (cleanCpf) {
          try {
            const retryCustRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanCpf}`, {
              headers: { 'access_token': ASAAS_API_KEY }
            });
            if (retryCustRes.ok) {
              const retryJson = await retryCustRes.json();
              if (retryJson?.data && retryJson.data.length > 0) {
                asaasCustomerId = retryJson.data[0].id;
              }
            }
          } catch (_) {}
        }

        if (!asaasCustomerId) {
          throw new Error(`Asaas (Cliente): ${customerData.errors?.[0]?.description || 'Erro ao criar cadastro'}`);
        }
      }
    }

    // 4. Gerar Cobrança (PIX, CARTÃO CRÉDITO/DÉBITO ou CARNÊ com Parcelas)
    const isInstallment = billingType === 'CREDIT_CARD' && Number(installmentCount) > 1;

    // Garantir que a data de vencimento nunca seja inferior a hoje (exigência estrita do Asaas)
    const todayStr = new Date().toISOString().split('T')[0];
    let sanitizedDueDate = dueDate || todayStr;
    if (sanitizedDueDate < todayStr) {
      sanitizedDueDate = todayStr;
    }

    // Garantir que a descrição não contenha emojis ou caracteres especiais (rejeitados pela API do Asaas)
    const rawDescription = String(description || 'Reserva Balneário Lessa');
    const sanitizedDescription = rawDescription
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[\u2600-\u27BF\uE000-\uF8FF\u2011-\u2027\u2030-\u205E\u2060-\u20CF\u2100-\u214F\u2190-\u21FF\u2300-\u23FF\u2B50-\u2BFF]/g, '')
      .replace(/[•●▪■]/g, '-')
      .replace(/[^\w\sÀ-ÿ.,:;()_\-\/\\@#%&*+!?]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, 500);

    const paymentBody: Record<string, any> = {
      customer: asaasCustomerId,
      billingType: billingType,
      dueDate: sanitizedDueDate,
      description: sanitizedDescription,
      externalReference: orderId,
      postalService: false,
    };

    if (isInstallment) {
      paymentBody.installmentCount = Number(installmentCount);
      if (totalValue) {
        paymentBody.totalValue = Number(Number(totalValue).toFixed(2));
      } else if (installmentValue) {
        paymentBody.installmentValue = Number(Number(installmentValue).toFixed(2));
      } else {
        paymentBody.totalValue = Number(Number(value).toFixed(2));
      }
    } else {
      paymentBody.value = Number(Number(value || totalValue).toFixed(2));
    }

    if (body.creditCard) {
      paymentBody.creditCard = body.creditCard;
    }
    if (body.creditCardHolderInfo) {
      paymentBody.creditCardHolderInfo = body.creditCardHolderInfo;
    }

    if (billingType === 'CREDIT_CARD' && orderId) {
      try {
        const existingReq = await fetch(
          `${ASAAS_URL}/payments?customer=${asaasCustomerId}&externalReference=${encodeURIComponent(String(orderId))}&limit=20`,
          { headers: { access_token: ASAAS_API_KEY } }
        );
        if (existingReq.ok) {
          const existingJson = await existingReq.json();
          const alreadyPaid = (existingJson?.data || []).find(
            (p: any) => p.status === 'CONFIRMED' || p.status === 'RECEIVED'
          );
          if (alreadyPaid) {
            return new Response(JSON.stringify({
              success: true,
              duplicatePrevented: true,
              data: {
                paymentId: alreadyPaid.id,
                invoiceUrl: alreadyPaid.invoiceUrl,
                status: alreadyPaid.status,
                isPaid: true,
                pix: null,
              },
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }
        }
      } catch (e) {
        console.warn('Erro ao verificar cobrança duplicada no Asaas:', e);
      }
    }

    const paymentReq = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify(paymentBody)
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

    const isPaid = paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED';

    // 6. Registro no Supabase (Opcional - apenas para pedidos com UUID)
    if (isUuid) {
      try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
        await supabaseAdmin.from('payments').insert({
            order_id: orderId,
            gateway: 'asaas',
            metodo: billingType,
            status: isPaid ? 'paid' : 'pending',
            external_id: paymentData.id,
            payment_url: paymentData.invoiceUrl
        });

        if (isPaid) {
          await supabaseAdmin.from('orders').update({
            status: 'paid',
            updated_at: new Date().toISOString()
          }).eq('id', orderId);
        }
      } catch (e) { console.warn('Erro ao salvar log de pagamento:', e); }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        paymentId: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        status: paymentData.status,
        isPaid,
        pix: pixData ? { encodedImage: pixData.encodedImage, payload: pixData.payload } : null
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    console.error('[create-payment] Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
    });
  }
})
