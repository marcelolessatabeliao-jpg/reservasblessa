import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS Pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    })
  }

  try {
    const body = await req.json()
    const {
      name, phone, cpf, visit_date, status,
      adults_normal = 0,
      is_teacher = 0, is_student = 0, is_server = 0,
      is_solidarity = 0,
      is_pcd = 0, is_tea = 0, is_senior = 0, is_birthday = 0,
      children_free = 0,
      selected_kiosks = [],
      quads = [],
      additionals = [],
      manual_discount = 0,
      manual_discount_type = 'unit',
      total_amount = 0
    } = body

    // Map any incoming legacy fields to solidarity for safety
    const consolidatedSolidarity = (is_solidarity || 0) + (body.adults_half || 0) + (body.is_donor || 0)

    if (!name || !visit_date) {
      return new Response(JSON.stringify({ success: false, error: 'Nome e data são obrigatórios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // 0. Duplicity Check: Verificar se já existe um pedido pendente para este CPF na mesma data
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, '')
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, confirmation_code')
        .eq('customer_cpf', cleanCpf)
        .eq('visit_date', visit_date)
        .eq('status', 'pending')
        .maybeSingle()
      
      if (existingOrder) {
        return new Response(JSON.stringify({ 
          success: true, 
          is_duplicate: true,
          orderId: existingOrder.id,
          confirmationCode: existingOrder.confirmation_code,
          message: 'Já existe uma reserva pendente para este CPF nesta data. Carregando dados existentes...'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // 1. Criar o pedido principal
    const orderStatus = status === 'paid' ? 'paid' : 'pending'
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: name.trim(),
        customer_phone: phone || null,
        customer_cpf: cpf || null,
        visit_date,
        total_amount,
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .select('id, confirmation_code')
      .single()

    if (orderError) throw orderError

    const orderId = order.id

    // 2. Montar order_items
    const items: any[] = []

    const addItem = (product_id: string, quantity: number, unit_price: number) => {
      if (quantity > 0) items.push({ order_id: orderId, product_id, quantity, unit_price })
    }

    addItem('Adulto', adults_normal, 50)
    addItem('Adulto Solidário', consolidatedSolidarity, 25)
    addItem('Lessa Professor Pass', is_teacher, 25)
    addItem('Lessa Estudante Pass', is_student, 25)
    addItem('Lessa Servidor Pass', is_server, 25)
    addItem('Lessa Inclusão', is_pcd, 0)
    addItem('Lessa TEA', is_tea, 0)
    addItem('Lessa Vitalício', is_senior, 0)
    addItem('Aniversariante', is_birthday, 0)
    addItem('Criança', children_free, 0)

    // Quiosques
    selected_kiosks.forEach((kioskId: number) => {
      addItem(`Quiosque ${String(kioskId).padStart(2, '0')}`, 1, kioskId === 1 ? 100 : 75)
    })

    // Quadriciclos — com desconto do dia já embutido no total_amount
    // Forçar fuso horário de Porto Velho (-04:00) para garantir o dia da semana correto
    const dayOfWeek = new Date(visit_date + 'T12:00:00-04:00').getDay()
    let quadDiscount = 0
    if (dayOfWeek === 1 || dayOfWeek === 5) quadDiscount = 0.2
    else if (dayOfWeek === 0 || dayOfWeek === 6) quadDiscount = 0.1

    quads.forEach((q: any) => {
      if ((q.quantity || 0) <= 0) return
      const baseMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 }
      const labelMap: Record<string, string> = { individual: 'Quadriciclo Individual', dupla: 'Quadriciclo Dupla', 'adulto-crianca': 'Quadriciclo Adulto+Criança' }
      const base = baseMap[q.type] || 150
      const unitPrice = base * (1 - quadDiscount)
      items.push({
        order_id: orderId,
        product_id: labelMap[q.type] || 'Quadriciclo Individual',
        quantity: q.quantity,
        unit_price: unitPrice,
        metadata: { time: q.time }
      })
    })
    
    // Serviços Adicionais
    additionals.forEach((a: any) => {
      if ((a.quantity || 0) <= 0) return
      const labelMap: Record<string, string> = { pesca: 'Pesca Esportiva', 'futebol-sabao': 'Futebol de Sabão' }
      const priceMap: Record<string, number> = { pesca: 20, 'futebol-sabao': 10 }
      items.push({
        order_id: orderId,
        product_id: labelMap[a.type] || a.type,
        quantity: a.quantity,
        unit_price: priceMap[a.type] || 0
      })
    })

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) console.warn('Failed to save order_items:', itemsError.message)
    }

    // 3. Salvar reservas de quiosque
    if (selected_kiosks.length > 0) {
      const kioskRows = selected_kiosks.map((id: number) => ({
        order_id: orderId,
        kiosk_id: id,
        kiosk_type: id === 1 ? 'maior' : 'menor',
        reservation_date: visit_date,
        quantity: 1,
        customer_name: name.trim()
      }))
      const { error: kErr } = await supabase.from('kiosk_reservations').insert(kioskRows)
      if (kErr) console.warn('Failed to save kiosk_reservations:', kErr.message)
    }

    // 4. Salvar reservas de quadriciclos
    const activeQuads = quads.filter((q: any) => q.quantity > 0 && q.time)
    if (activeQuads.length > 0) {
      const quadRows = activeQuads.map((q: any) => ({
        order_id: orderId,
        quad_type: q.type,
        reservation_date: visit_date,
        time_slot: q.time,
        quantity: q.quantity,
        customer_name: name.trim()
      }))
      const { error: qErr } = await supabase.from('quad_reservations').insert(quadRows)
      if (qErr) console.warn('Failed to save quad_reservations:', qErr.message)
    }

    // 5. Se status = pending, gerar cobrança Asaas (PIX) para que o admin possa mostrar ao cliente
    let pixData = null
    if (orderStatus === 'pending') {
      try {
        const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
        if (ASAAS_API_KEY) {
          const isLive = ASAAS_API_KEY.startsWith('aact_live_')
          const ASAAS_URL = isLive ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3'
          
          // 5.1 Idempotência: Verificar se já existe um pagamento pendente para este pedido
          const { data: existingPay } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', orderId)
            .eq('status', 'pending')
            .maybeSingle()

          if (existingPay?.external_id) {
            const qrReq = await fetch(`${ASAAS_URL}/payments/${existingPay.external_id}/pixQrCode`, {
              headers: { 'access_token': ASAAS_API_KEY }
            })
            const qrData = await qrReq.json()
            if (qrReq.ok) {
              pixData = { encodedImage: qrData.encodedImage, payload: qrData.payload }
            }
          } else {
            // Criar/Vincular Cliente
            const customerReq = await fetch(`${ASAAS_URL}/customers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
              body: JSON.stringify({
                name: name.trim(),
                cpfCnpj: cpf ? cpf.replace(/\D/g, '') : null,
                mobilePhone: phone ? phone.replace(/\D/g, '') : null
              })
            })
            const customerData = await customerReq.json()
            
            if (customerReq.ok) {
              // Gerar Cobrança PIX
              const paymentReq = await fetch(`${ASAAS_URL}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                body: JSON.stringify({
                  customer: customerData.id,
                  billingType: 'PIX',
                  value: total_amount,
                  dueDate: new Date().toISOString().split('T')[0],
                  description: `Reserva Interna - ${name.trim()}`,
                  externalReference: orderId
                })
              })
              const paymentData = await paymentReq.json()
              
              if (paymentReq.ok) {
                // Obter QR Code
                const qrReq = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
                  headers: { 'access_token': ASAAS_API_KEY }
                })
                const qrData = await qrReq.json()
                if (qrReq.ok) {
                  pixData = { encodedImage: qrData.encodedImage, payload: qrData.payload }
                }

                // Registrar pagamento no Supabase
                await supabase.from('payments').insert({
                  order_id: orderId,
                  gateway: 'asaas',
                  metodo: 'PIX',
                  status: 'pending',
                  external_id: paymentData.id,
                  payment_url: paymentData.invoiceUrl
                })
              }
            }
          }
        }
      } catch (e) {
        console.warn('Falha ao gerar PIX Asaas para reserva interna:', e.message)
      }
    }

    // 6. Se status = paid, gerar voucher
    if (orderStatus === 'paid') {
      const code = order.confirmation_code || `BL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      await supabase.from('vouchers').insert({
        order_id: orderId,
        code,
        qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`,
        status: 'active',
        is_redeemed: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
    }

    return new Response(JSON.stringify({
      success: true,
      orderId,
      confirmationCode: order.confirmation_code,
      status: orderStatus,
      pix: pixData
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('create-internal-order error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 // Mudado para 400 para que o invoke detecte o erro corretamente
    })
  }
})
