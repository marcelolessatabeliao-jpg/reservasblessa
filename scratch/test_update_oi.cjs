const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data, error } = await supabase
    .from('order_items')
    .update({ product_id: 'Quiosque 02' })
    .eq('id', '60827340-973a-42ff-9e7a-89e853f8662f')
    .select();
    
  console.log('Update Error:', error);
}

testUpdate();
