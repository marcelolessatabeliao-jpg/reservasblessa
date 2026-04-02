import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The script before messed up the order of fetchData. Let's fix it properly.
const badSnippet = `      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      // orderData fetched earlier
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();`;

const goodSnippet = `      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });`;

data = data.replace(badSnippet, goodSnippet);

// Also make sure setBookings uses enrichedBookings
data = data.replace('setBookings(bks || []);', 'setBookings(enrichedBookings);');

writeFileSync(adminPath, data);
console.log('Fixed Admin.tsx order of enrichment');
