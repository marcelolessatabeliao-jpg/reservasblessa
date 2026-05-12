import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('order_items').select('*').limit(1)
  if (error) {
    console.error('Error fetching order_items:', error)
  } else {
    console.log('Order item keys:', Object.keys(data[0] || {}))
  }

  // List all tables using a query that might work if RLS allows or via a known table
  const { data: tables, error: tableErr } = await supabase.rpc('get_tables'); // unlikely to exist
  if (tableErr) {
     // Try to see if we can find 'products' by querying it directly again
     const { error: prodErr } = await supabase.from('products').select('id').limit(1);
     console.log('Products table exists?', !prodErr);
     if (prodErr) console.log('Products err:', prodErr);
  }
}

check()
