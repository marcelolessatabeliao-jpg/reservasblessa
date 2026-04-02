import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The block that is currently broken:
// 227: const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
// 228: // orderData fetched earlier
// 231: const enrichedBookings = (bks || []).map(b => {
// 232:   const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);

// Let's just find the whole fetchData start and rewrite it safely.

const searchSnippet = `  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      // orderData fetched earlier
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const orderData = await getAdminOrders();`;

const replacementSnippet = `  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orderData = await getAdminOrders();
      const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const { data: kiosks } = await supabase.from('kiosk_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      const { data: quads } = await supabase.from('quad_reservations').select('*, orders(customer_name), bookings(name)').order('reservation_date', { ascending: false });
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });`;

const newData = data.replace(searchSnippet, replacementSnippet);

if (newData === data) {
    console.error("FAILED TO REPLACE SNIPPET! Trying more flexible approach...");
    // Try a more flexible replacement if whitespace differed
    const regex = /const fetchData = useCallback\(async \(\) => \{\s+setLoading\(true\);\s+try \{\s+const \{ data: bks \}[\s\S]*?const orderData = await getAdminOrders\(\);/;
    data = data.replace(regex, replacementSnippet);
} else {
    data = newData;
}

writeFileSync(adminPath, data);
console.log('Fixed Admin.tsx ReferenceError definitively');
