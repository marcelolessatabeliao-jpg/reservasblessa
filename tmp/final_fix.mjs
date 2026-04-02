import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let adminContent = readFileSync(adminPath, 'utf8');

// 1. Fix fetchData to attach order_items to bookings
const fetchDataFind = `const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });`;
const fetchDataReplace = `const { data: bks } = await supabase.from('bookings').select('*').order('visit_date', { ascending: false });
      const orderData = await getAdminOrders();
      
      // Enrich bookings with their order items from the orders table
      const enrichedBookings = (bks || []).map(b => {
        const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);
        return { ...b, order_items: relatedOrder?.order_items || [] };
      });`;

// Replace the original fetch and the orderData fetch (since we now do it earlier)
adminContent = adminContent.replace(fetchDataFind, fetchDataReplace);
adminContent = adminContent.replace(`const orderData = await getAdminOrders();`, `// orderData fetched earlier`);
adminContent = adminContent.replace(`setBookings(bks || []);`, `setBookings(enrichedBookings);`);

writeFileSync(adminPath, adminContent);
console.log('Fixed Admin.tsx: enriched bookings with order items');

const tablePath = 'src/components/admin/BookingTable.tsx';
let tableContent = readFileSync(tablePath, 'utf8');

// 2. Remove the first VOUCHER button in BookingTable (lines 432-453 approx)
const redundantVoucherRegex = /<Button\s+onClick=\{\(e\) => \{\s+e\.stopPropagation\(\);\s+const phone = \(\(booking as any\)\.customer_phone \|\| \(\(booking as any\)\.phone \|\| ''\)\)\.replace\(\/\\D\/g, ''\);[\s\S]*?VOUCHER[\s\S]*?<\/Button>/;
tableContent = tableContent.replace(redundantVoucherRegex, '');

writeFileSync(tablePath, tableContent);
console.log('Fixed BookingTable.tsx: removed redundant voucher button');
