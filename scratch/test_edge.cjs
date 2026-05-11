const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testEdgeFunction() {
  const payload = {
    action: 'update_kiosk',
    item_id: 'dfda0ae7-f038-4b85-8dbc-b02cd6f8241e',
    kiosk_id: 2,
    kiosk_type: 'menor',
    price: 75,
    order_item_id: '60827340-973a-42ff-9e7a-89e853f8662f',
    new_product_id: 'Quiosque 02'
  };

  console.log("Calling Edge Function with payload:", payload);
  
  const { data, error } = await supabase.functions.invoke('create-internal-order', {
    body: payload
  });
  
  console.log('Response Data:', data);
  console.log('Response Error:', error);
}

testEdgeFunction();
