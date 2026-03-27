import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function wipeTests() {
  console.log("Fetching orders and legacy bookings to wipe...");
  try {
    const { data: orders } = await supabase.from('orders').select('id');
    const { data: bks } = await supabase.from('bookings').select('id');

    const totalOrders = orders?.length || 0;
    const totalBks = bks?.length || 0;
    console.log(`Found ${totalOrders} orders and ${totalBks} legacy bookings.`);

    const adminToken = Buffer.from('admin:master').toString('base64');

    let count = 0;
    for (const o of (orders || [])) {
      await supabase.functions.invoke('admin-delete', {
        body: { bookingId: o.id, isOrder: true, adminToken }
      });
      count++;
      console.log(`Wiped order ${o.id}`);
    }

    for (const b of (bks || [])) {
      await supabase.functions.invoke('admin-delete', {
        body: { bookingId: b.id, isOrder: false, adminToken }
      });
      count++;
      console.log(`Wiped legacy booking ${b.id}`);
    }

    console.log(`Finished wiping ${count} items.`);
  } catch (err) {
    console.error("Error wiping:", err.message);
  }
}

wipeTests();
