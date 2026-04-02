import fs from 'fs';
const file = 'src/pages/Admin.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const flattenedBks =')) {
  const target = '      setBookings(flattenedBks);';
  const definition = `      // Merge booking data with order payment info for display
      const flattenedBks = (bks || []).map(b => {
        const order = orderData?.find((o: any) => o.booking_id === b.id);
        return {
          ...b,
          payments: order?.payments || [],
          customer_phone: order?.customer_phone || (b as any).phone
        };
      });\n\n`;
  content = content.replace(target, definition + target);
}

fs.writeFileSync(file, content);
console.log('Fixed missing flattenedBks in Admin.tsx');
