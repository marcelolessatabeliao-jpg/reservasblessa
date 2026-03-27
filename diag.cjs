const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function check() {
  const { data, error } = await s.from('orders').insert({ 
      customer_name: 'DIAGNOSTIC TEST',
      total_amount: 0,
      status: 'pending'
  }).select('*').single();
  
  if (error) {
     console.error('INSERT ERROR (Orders):', JSON.stringify(error, null, 2));
  } else {
     console.log('SUCCESS (Orders):', JSON.stringify(data, null, 2));
     const { error: itemErr } = await s.from('order_items').insert({
         order_id: data.id,
         product_id: 'TEST ITEM',
         quantity: 1,
         unit_price: 0
     });
     if (itemErr) console.error('INSERT ERROR (Items):', JSON.stringify(itemErr, null, 2));
     else console.log('SUCCESS (Items)');
  }
}

check();
