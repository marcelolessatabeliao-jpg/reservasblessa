const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');
s.from('order_items').select('*').limit(5).then(r => {
  console.log('ITEMS:', JSON.stringify(r.data, null, 2));
  s.from('orders').select('*').limit(2).then(o => {
      console.log('ORDERS:', JSON.stringify(o.data, null, 2));
      process.exit(0);
  });
});
