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

    // 2. Limpeza de Dados
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : '';

    if (!cleanCpf) throw new Error('Para cobranças reais em produção, o CPF é obrigatório.');
    
    // 2.5 Idempotência: Verificar se já existe um pagamento pendente para este pedido/método
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
          name: name,
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

    // 4. Gerar Cobrança (PIX, CARTÃO ou CARNÊ com Parcelas)
    const isInstallment = Number(installmentCount) > 1;
    const paymentBody: Record<string, any> = {
      customer: asaasCustomerId,
      billingType: billingType,
      dueDate: dueDate || new Date().toISOString().split('T')[0],
      description: description || `Reserva Balneário Lessa`,
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
        paymentBody.installmentValue = Number(Number(value).toFixed(2));
      }
    } else {
      paymentBody.value = Number(Number(value).toFixed(2));
    }

    if (body.creditCard) {
      paymentBody.creditCard = body.creditCard;
    }
    if (body.creditCardHolderInfo) {
      paymentBody.creditCardHolderInfo = body.creditCardHolderInfo;
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

    // 6. Registro no Supabase (Opcional - mas ajuda no Dashboard)
    try {
        await supabaseAdmin.from('payments').insert({
            order_id: orderId,
            gateway: 'asaas',
            metodo: billingType,
            status: paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED' ? 'paid' : 'pending',
            external_id: paymentData.id,
            payment_url: paymentData.invoiceUrl
        });
    } catch (e) { console.warn('Erro ao salvar log de pagamento:', e); }

    const isPaid = paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED';

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
