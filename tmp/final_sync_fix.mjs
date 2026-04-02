import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The logic before at lines 812-841:
// 818: const hasKiosk = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quiosque'));
// 822: kiosk_id: b.kiosk_id || 'MAIOR',
// 829: const hasQuad = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quadri'));

// We need to broaden this with more robust keywords and a numeric ID parser for Kiosks.

const oldMappingBlock = `    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      const hasKiosk = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quiosque'));
      if (hasKiosk && !dayKiosks.some(dk => dk.id === b.id)) {
        dayKiosks.push({
           id: b.id,
           kiosk_id: b.kiosk_id || 'MAIOR',
           customer_name: b.name || 'Cliente (Interno)',
           reservation_date: b.visit_date,
           status: b.status
        });
      }
      
      const hasQuad = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quadri'));
      if (hasQuad && !dayQuads.some(dq => dq.id === b.id)) {
        bItems.filter(i => (i.product_name || '').toLowerCase().includes('quadri')).forEach(qi => {
           dayQuads.push({
              id: b.id + '-' + Math.random().toString(36).substr(2, 5),
              customer_name: b.name || 'Cliente (Interno)',
              reservation_date: b.visit_date,
              time_slot: b.quad_time_slot || '10:30',
              quantity: qi.quantity || 1,
              status: b.status
           });
        });
      }
    });`;

const newMappingBlock = `    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      
      // BROADENED KIOSK DETECTION
      bItems.forEach(item => {
        const pNameLower = (item.product_name || '').toLowerCase();
        if (pNameLower.includes('quiosque') || pNameLower.includes('camping')) {
           // Extract numeric ID from "Quiosque 04" or similar
           const kioskIdMatch = pNameLower.match(/quiosque\s*(\d+)/i);
           const kId = kioskIdMatch ? parseInt(kioskIdMatch[1], 10) : (pNameLower.includes('maior') ? 1 : 'MENOR');

           if (!dayKiosks.some(dk => dk.id === b.id && dk.kiosk_id === kId)) {
              dayKiosks.push({
                 id: b.id + '-' + item.id,
                 kiosk_id: kId,
                 customer_name: b.name || 'Cliente (Interno)',
                 reservation_date: b.visit_date,
                 status: b.status
              });
           }
        }
      });
      
      // BROADENED QUAD DETECTION
      // Manual bookings use "Passeio" keywords instead of "Quadri"
      const quadKeywords = ['quadri', 'passeio', 'quadriciclo'];
      const quadItems = bItems.filter(i => quadKeywords.some(k => (i.product_name || '').toLowerCase().includes(k)));
      
      quadItems.forEach(qi => {
         const qiId = b.id + '-' + qi.id;
         if (!dayQuads.some(dq => dq.id === qiId)) {
            dayQuads.push({
               id: qiId,
               customer_name: b.name || 'Cliente (Interno)',
               reservation_date: b.visit_date,
               time_slot: b.quad_time_slot || '10:30',
               quantity: qi.quantity || 1,
               status: b.status
            });
         }
      });
    });`;

data = data.replace(oldMappingBlock, newMappingBlock);

writeFileSync(adminPath, data);
console.log('Fixed Reservation Mapping definitively with broadened keywords and numeric ID parser');
