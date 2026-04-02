import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The logic was:
// 227: const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
// 228: // orderData fetched earlier
// 231: const enrichedBookings = (bks || []).map(b => {
// 232:   const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
// ...
// 237: const orderData = await getAdminOrders();

// We need to move orderData fetch to the top.

const oldBlock = `      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      // orderData fetched earlier
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();`;

const newBlock = `      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });`;

data = data.replace(oldBlock, newBlock);

// Ensure we use enrichedBookings in the aggregate calculations too
data = data.replace('[...(bks || []), ...(orderData || [])].forEach', '[...(enrichedBookings || []), ...(orderData || [])].forEach');

writeFileSync(adminPath, data);
console.log('Fixed Admin.tsx ReferenceError and data enrichment order');
