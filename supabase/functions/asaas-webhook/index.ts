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

    if (!payment) {
      return new Response(JSON.stringify({ success: true, message: 'No payment payload' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[asaas-webhook] Event: ${event} for payment ${payment.id} (ref: ${payment.externalReference})`);

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const externalId = payment.id;
      const orderId = payment.externalReference;

      // 1. Atualizar registro na tabela payments (se existir)
      try {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('external_id', externalId);
      } catch (payErr) {
        console.warn('[asaas-webhook] Error updating payments table:', payErr);
      }

      // 2. Atualizar pedido de quiosque/chalé/reserva (se for uma reserva)
      if (orderId) {
        try {
          const { data: orderData } = await supabaseAdmin
            .from('orders')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('id', orderId)
            .select('id, confirmation_code, booking_id')
            .maybeSingle();

          if (orderData) {
            // 3. Atualizar reserva associada (booking_id)
            if (orderData.booking_id) {
              await supabaseAdmin
                .from('bookings')
                .update({ status: 'paid' })
                .eq('id', orderData.booking_id);
            }

            // 4. Gerar Voucher da reserva
            const { data: existingVoucher } = await supabaseAdmin
              .from('vouchers')
              .select('id')
              .eq('order_id', orderId)
              .maybeSingle();

            if (!existingVoucher) {
              const code =
                orderData?.confirmation_code ||
                `BL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
              const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`;

              await supabaseAdmin.from('vouchers').insert({
                order_id: orderId,
                code: code,
                qr_code_url: qrCodeUrl,
                status: 'active',
                is_redeemed: false,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              });

              console.log(`[asaas-webhook] Voucher generated for order ${orderId}: ${code}`);
            }
          }
        } catch (orderErr) {
          console.warn('[asaas-webhook] Non-fatal order check error:', orderErr);
        }
      }

      // 5. Atualizar Lessa Club Ecosystem (Assinatura, Faturas e Carteirinhas)
      try {
        const { data: settingsRow } = await supabaseAdmin
          .from('site_settings')
          .select('value')
          .eq('key', 'lessa_club_ecosystem_v1')
          .maybeSingle();

        if (settingsRow?.value) {
          const clubState = settingsRow.value;
          let clubUpdated = false;

          for (const sub of clubState.subscriptions || []) {
            let subInvoicePaid = false;

            for (const inv of sub.invoices || []) {
              const matchesInvoice =
                (orderId && inv.id === orderId) ||
                (inv.asaasPaymentId && inv.asaasPaymentId === externalId);
              const matchesSubUnified =
                orderId && orderId.startsWith(`unified_${sub.id}`);

              if (matchesInvoice || matchesSubUnified) {
                if (inv.status !== 'PAID') {
                  inv.status = 'PAID';
                  inv.paidAt = new Date().toISOString();
                  inv.asaasPaymentId = externalId;
                  subInvoicePaid = true;
                  clubUpdated = true;
                  console.log(
                    `[asaas-webhook] Invoice ${inv.id} of sub ${sub.subscriptionCode || sub.id} marked PAID`
                  );
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
                console.log(
                  `[asaas-webhook] Subscription ${sub.subscriptionCode || sub.id} and all members ACTIVATED!`
                );
              }
            }
          }

          if (clubUpdated) {
            await supabaseAdmin
              .from('site_settings')
              .update({ value: clubState, updated_at: new Date().toISOString() })
              .eq('key', 'lessa_club_ecosystem_v1');
            console.log('[asaas-webhook] Saved updated club state to site_settings');
          }
        }
      } catch (clubErr) {
        console.warn('[asaas-webhook] Error updating Lessa Club in site_settings:', clubErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[asaas-webhook] Processing error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Error processing webhook' }), {
      status: 200, // Retorna 200 para evitar que o Asaas desative o webhook por retry failure
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
