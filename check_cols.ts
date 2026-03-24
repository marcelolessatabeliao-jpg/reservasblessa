import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lcymbetnnuokrijynmjm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
  // We try to insert a dummy row with only total_amount to see what the returned object looks like
  const { data, error } = await supabase.from('orders').insert({ total_amount: 0 }).select().single();
  
  if (error) {
    console.error('Error inserting dummy:', error);
    // Try to just select and see if we get anything
    const { data: selectData, error: selectError } = await supabase.from('orders').select('*').limit(1);
    if (!selectError && selectData && selectData.length > 0) {
        console.log('Columns found in select:', Object.keys(selectData[0]));
    } else {
        console.log('Could not find any data to inspect columns. Error:', selectError);
    }
  } else {
    console.log('Columns found in insert result:', Object.keys(data));
  }
}

checkColumns();
