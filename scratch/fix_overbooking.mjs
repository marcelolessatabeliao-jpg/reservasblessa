import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanup() {
  const orderId = 'a0d266ce-d753-49f8-a672-91de9530068d'
  const date = '2026-04-20'
  
  console.log(`Cleaning up quad_reservations for order ${orderId} on ${date}...`)
  
  // 1. Delete all quad reservations for this order on this date
  const { error: dError } = await supabase
    .from('quad_reservations')
    .delete()
    .eq('order_id', orderId)
    .eq('reservation_date', date)
  
  if (dError) {
    console.error('Error deleting:', dError)
    return
  }
  
  console.log('Deleted old records.')
  
  // 2. Re-insert the correct ones based on order_items verified earlier:
  // 1 Individual at 10:30, 1 Dupla at 10:30
  const reservations = [
    {
      order_id: orderId,
      reservation_date: date,
      time_slot: '10:30',
      quad_type: 'individual',
      quantity: 1,
      price: 120 // Unit price from order_items
    },
    {
      order_id: orderId,
      reservation_date: date,
      time_slot: '10:30',
      quad_type: 'dupla',
      quantity: 1,
      price: 225 // Unit price from order_items
    }
  ]
  
  const { error: iError } = await supabase
    .from('quad_reservations')
    .insert(reservations)
  
  if (iError) {
    console.error('Error inserting:', iError)
    return
  }
  
  console.log('Inserted correct records.')
}

cleanup()
