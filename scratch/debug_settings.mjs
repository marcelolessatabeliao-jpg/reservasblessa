import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listTables() {
  console.log('Querying settings...')
  // Try to query site_settings
  const { data: settings, error: sError } = await supabase.from('site_settings').select('*')
  if (sError) {
    console.error('Error fetching site_settings:', sError)
  } else {
    console.log('site_settings content:', settings)
  }
}

listTables()
