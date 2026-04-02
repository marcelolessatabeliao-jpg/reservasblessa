import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The bug is at line 373 (approx): 
// const flattenedBks = (bks || []).map(b => {
// It should use enrichedBookings instead of bks.

const oldFlattened = `      // Merge booking data with order payment info for display
      const flattenedBks = (bks || []).map(b => {
        const order = orderData?.find((o: any) => o.confirmation_code === b.confirmation_code);
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });`;

const newFlattened = `      // Merge booking data with order payment info for display
      const flattenedBks = (enrichedBookings || []).map(b => {
        // EnrichedBookings already linked simple confirmation_code, but let's re-find if needed
        // Actually, we can just use the enriched object directly.
        const order = orderData?.find((o: any) => 
          (o.confirmation_code === b.confirmation_code && b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && matchDate(o.visit_date, b.visit_date))
        );
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });`;

data = data.replace(oldFlattened, newFlattened);

// One more check: the totals calculation at line 384 also uses bks/enrichedBookings
data = data.replace('[...(bks || []),', '[...(enrichedBookings || []),');

writeFileSync(adminPath, data);
console.log('Fixed Critical Overwrite BUG in Admin.tsx: FlattenedBks now preserves EnrichedBookings items.');
