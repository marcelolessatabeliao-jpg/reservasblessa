const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const date = '2026-05-23';

  console.log(`Checking DB for date: ${date}`);
  
  const { data: kioskRes, error: kErr } = await supabase
    .from('kiosk_reservations')
    .select('*')
    .eq('reservation_date', date);

  console.log('Kiosk Reservations:', kioskRes);

  const { data: orderItems, error: oiErr } = await supabase
    .from('order_items')
    .select('*, orders!inner(visit_date, status, customer_name)')
    .eq('orders.visit_date', date);

  console.log('Order Items for that date:', orderItems);
}

main().catch(console.error);
