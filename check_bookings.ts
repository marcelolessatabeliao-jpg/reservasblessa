import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lcymbetnnuokrijynmjm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkBookings() {
  const { data, error } = await supabase.from('bookings').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Bookings columns:', Object.keys(data[0]));
  } else {
    console.log('Bookings table empty or error:', error);
  }
}

checkBookings();
