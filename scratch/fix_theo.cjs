const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Tentar usar service_role_key se disponível, caso contrário usar anon_key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  console.log("Fixing Theo Rocha's reservation...");
  
  // 1. Kiosk Reservation
  const { data: kData, error: kErr } = await supabase
    .from('kiosk_reservations')
    .update({ kiosk_id: 3 })
    .eq('id', 'dfda0ae7-f038-4b85-8dbc-b02cd6f8241e')
    .select();
    
  console.log('Update Kiosk Res:', kData, kErr);
  
  // 2. Order Item
  const { data: oData, error: oErr } = await supabase
    .from('order_items')
    .update({ product_id: 'Quiosque 03' })
    .eq('id', '60827340-973a-42ff-9e7a-89e853f8662f')
    .select();
    
  console.log('Update Order Item:', oData, oErr);
}

fix().catch(console.error);
