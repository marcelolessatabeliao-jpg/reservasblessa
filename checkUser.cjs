const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim().replace(/"/g, '');
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim().replace(/"/g, '');
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, product_name, quantity, metadata, orders!inner(customer_name)')
    .ilike('orders.customer_name', '%KEULYANE%');
    
  if (error) {
    console.error("ERRO:", error);
  } else {
    console.log("ORDER ITEMS:", JSON.stringify(data.filter(d => d.order_id === 'a0d266ce-d753-49f8-a672-91de9530068d'), null, 2));
  }
}

run();
