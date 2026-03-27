
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { bookingId, isOrder, adminToken } = await req.json()

    if (!adminToken) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate admin token (simple prefix check as in update-booking-status)
    try {
      const decoded = atob(adminToken)
      if (!decoded.startsWith('admin:')) {
        throw new Error('Invalid token')
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (isOrder) {
      console.log(`[AdminDelete] Deleting Order ${bookingId}`);
      // Cascade delete relations
      await supabase.from('order_items').delete().eq('order_id', bookingId);
      await supabase.from('kiosk_reservations').delete().eq('order_id', bookingId);
      await supabase.from('quad_reservations').delete().eq('order_id', bookingId);
      
      const { error } = await supabase.from('orders').delete().eq('id', bookingId);
      if (error) throw error;
    } else {
      console.log(`[AdminDelete] Deleting Legacy Booking ${bookingId}`);
      const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    
  } catch (error: any) {
    console.error('[AdminDelete] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
