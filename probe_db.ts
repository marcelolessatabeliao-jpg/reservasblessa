import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://lcymbetnnuokrijynmjm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function probe() {
  console.log('Testing Project URL:', SUPABASE_URL);
  
  const { data: bookingsData, error: bookingsError } = await supabase.from('bookings').select('*').limit(1);
  console.log('Bookings table probe:', { exists: !bookingsError, error: bookingsError });

  const { data: ordersData, error: ordersError } = await supabase.from('orders').select('*').limit(1);
  console.log('Orders table probe:', { exists: !ordersError, error: ordersError });
  if (ordersData && ordersData.length > 0) {
      console.log('Orders columns:', Object.keys(ordersData[0]));
  } else {
      console.log('Orders table is empty, trying to fetch columns via RPC or metadata if possible');
  }

  
  const { data: servicesData, error: servicesError } = await supabase.from('services').select('*').limit(1);
  console.log('Services table probe:', { exists: !servicesError, error: servicesError });
  if (servicesData && servicesData.length > 0) {
      console.log('Services columns:', Object.keys(servicesData[0]));
  }
}

probe();

