import { supabase } from './src/integrations/supabase/client';

async function test() {
  const { data, error } = await supabase.from('orders').select('id, last_voucher_sent_at').limit(1);
  console.log("Orders Data:", data);
  console.log("Orders Error:", error);

  const { data: bData, error: bError } = await supabase.from('bookings').select('id, last_voucher_sent_at').limit(1);
  console.log("Bookings Data:", bData);
  console.log("Bookings Error:", bError);
}
test();
