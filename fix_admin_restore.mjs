import fs from 'fs';
const file = 'src/pages/Admin.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Revert bookings fetch to simple select('*')
const fetchDataOld = 'supabase.from(\'bookings\').select(\'*, orders(*, payments(*))\').order(\'visit_date\', { ascending: false });';
const fetchDataNew = 'supabase.from(\'bookings\').select(\'*\').order(\'visit_date\', { ascending: false });';
content = content.replace(fetchDataOld, fetchDataNew);

// 2. Locate map logic and ensure it uses orderData which MUST be fetched BEFORE
// Actually, in the code, orders is fetched in line 157.
// I'll move it up if needed, but for now I'll just fix the mapping logic.

const mappingOld = `      const flattenedBks = (bks || []).map(b => {
        const order = (b as any).orders?.[0];
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });`;

const mappingNew = `      const flattenedBks = (bks || []).map(b => {
        // We find the payment info by searching for an order linked to this booking
        const order = orderData?.find((o: any) => o.booking_id === b.id);
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });`;

content = content.replace(mappingOld, mappingNew);

// 3. Ensure orderData is fetched BEFORE the mapping
// Current sequence: const { data: bks } ... const { data: kiosks } ... const { data: quads } ... const orderData = await getAdminOrders();
// This is already before bks is mapped to flattenedBks in my revised code.

fs.writeFileSync(file, content);
console.log('Successfully updated Admin.tsx to avoid complex join and restore data visibility.');
