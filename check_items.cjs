const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  "https://lcymbetnnuokrijynmjm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794"
);

async function check(){
    const { data, error } = await supabase.from('order_items').select('*').limit(1);
    if(error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
}
check();
