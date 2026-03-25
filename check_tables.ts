
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://lcymbetnnuokrijynmjm.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjeW1iZXRubnVva3JpanlubWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI3NjIsImV4cCI6MjA4OTQwODc2Mn0.qAIACNQxbxBcSfrtjuh8TDaWqdA9f4Iy-M1O6i1z794'
);

async function checkTables() {
  const { data: qData, error: qError } = await supabase.from('quad_reservations').select('*').limit(1);
  console.log('quad_reservations:', qData ? Object.keys(qData[0] || {}) : qError);

  const { data: kData, error: kError } = await supabase.from('kiosk_reservations').select('*').limit(1);
  console.log('kiosk_reservations:', kData ? Object.keys(kData[0] || {}) : kError);

  const { data: oData, error: oError } = await supabase.from('orders').select('*').limit(1);
  console.log('orders:', oData ? Object.keys(oData[0] || {}) : oError);
}

checkTables();
