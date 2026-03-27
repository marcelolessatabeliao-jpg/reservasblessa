const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function check() {
  const { data, error } = await s.from('order_items').select('*').limit(1);
  if (error) {
     console.error('ERROR:', JSON.stringify(error, null, 2));
  } else if (data && data.length > 0) {
     console.log('COLUMNS:', Object.keys(data[0]));
  } else {
     console.log('Empty table, trying rpc if exists or different query...');
  }
}

check();
