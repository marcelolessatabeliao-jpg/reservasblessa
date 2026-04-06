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
    const {
      name, phone, cpf, visit_date, status,
      adults_normal = 0, adults_half = 0,
      is_teacher = 0, is_student = 0, is_server = 0,
      is_donor = 0, is_solidarity = 0,
      is_pcd = 0, is_tea = 0, is_senior = 0, is_birthday = 0,
      children_free = 0,
      selected_kiosks = [],
      quads = [],
      manual_discount = 0,
      manual_discount_type = 'unit',
      total_amount = 0
    } = body

    if (!name || !visit_date) {
      return new Response(JSON.stringify({ success: false, error: 'Nome e data são obrigatórios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

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
    addItem('Meia-Entrada', adults_half, 25)
    addItem('Lessa Professor Pass', is_teacher, 25)
    addItem('Lessa Estudante Pass', is_student, 25)
    addItem('Lessa Servidor Pass', is_server, 25)
    addItem('Lessa Doador Pass', is_donor, 25)
    addItem('Adulto Solidário', is_solidarity, 25)
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
    const dayOfWeek = new Date(visit_date + 'T12:00:00').getDay()
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

    // 5. Se status = paid, gerar voucher
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
      status: orderStatus
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('create-internal-order error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})
