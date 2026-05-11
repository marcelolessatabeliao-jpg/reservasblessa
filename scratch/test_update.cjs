const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data, error } = await supabase
    .from('kiosk_reservations')
    .update({ kiosk_id: 2 })
    .eq('id', 'dfda0ae7-f038-4b85-8dbc-b02cd6f8241e')
    .select();
    
  console.log('Update Error:', error);
}

testUpdate();
