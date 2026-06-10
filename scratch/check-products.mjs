import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://lcymbetnnuokrijynmjm.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794');

async function check() {
  const { data: items, error } = await supabase
    .from('order_items')
    .select('product_id');
  
  if (error) {
    console.error(error);
    return;
  }

  const productsMap = new Map();
  items.forEach(item => {
    const id = item.product_id || 'Unknown';
    productsMap.set(id, (productsMap.get(id) || 0) + 1);
  });

  console.log("ALL UNIQUE PRODUCT_IDs IN DATABASE:");
  const sorted = Array.from(productsMap.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, count]) => {
    console.log(`- ${id} (count: ${count})`);
  });
}
check();
