import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    const payload = await req.json();
    const event = payload.event;
    const payment = payload.payment;

    console.log(`Received Asaas Event: ${event} for payment ${payment.id}`);

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const externalId = payment.id;
      const orderId = payment.externalReference;

      // 1. Atualizar pagamentos
      const { data: payData, error: payError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('external_id', externalId)
        .select()
        .single();

      if (payError) {
        console.warn('Payment not found in local table, searching by externalReference:', payError);
      }

      // 2. Atualizar pedido
      const { data: orderData, error: orderError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select('id, confirmation_code, booking_id')
        .single();

      if (orderError) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // 3. Atualizar reserva associada (booking_id)
      if (orderData.booking_id) {
        await supabaseAdmin
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', orderData.booking_id);
      }

      // 4. Gerar Voucher (Sempre que for pago)
      // Checar se já existe voucher
      const { data: existingVoucher } = await supabaseAdmin
        .from('vouchers')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!existingVoucher) {
        const code = orderData?.confirmation_code || `BL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`;

        await supabaseAdmin
          .from('vouchers')
          .insert({
            order_id: orderId,
            code: code,
            qr_code_url: qrCodeUrl,
            status: 'active',
            is_redeemed: false,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          
        console.log(`Voucher generated for order ${orderId}: ${code}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { 'Content-Type': 'application/json' } 
    });
  }
})
