import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAvailability() {
  const date = '2026-04-20'
  
  console.log(`Checking reservations for ${date}...`)
  
  const { data, error } = await supabase
    .from('quad_reservations')
    .select('*, orders!inner(status, customer_name)')
    .eq('reservation_date', date)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Reservations found:', JSON.stringify(data, null, 2))
  
  // Count only paid/confirmed
  const paidStatuses = ['paid', 'confirmed', 'PAGO', 'CONFIRMADO']
  const counts = {}
  
  data.forEach(r => {
    if (paidStatuses.includes(r.orders.status)) {
      counts[r.time_slot] = (counts[r.time_slot] || 0) + r.quantity
    }
  })
  
  console.log('Confirmed/Paid counts per slot:', counts)
}

checkAvailability()
