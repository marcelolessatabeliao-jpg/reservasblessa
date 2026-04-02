import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// 1. Generate local confirmation code before insertion
const insertBookingSearch = `      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,`;

const insertBookingFix = `      // 0. GENERATE CONFIRMATION CODE
      const confCode = 'L-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        confirmation_code: confCode,`;

data = data.replace(insertBookingSearch, insertBookingFix);

// Ensure the insert call into orders also uses this confirmation_code
data = data.replace('confirmation_code: booking.confirmation_code,', 'confirmation_code: confCode,');

// 2. Add robust matching in fetchData (fallback: name + visit_date)
const matchingSearch = `const relatedOrder = (orderData || []).find(o => o.confirmation_code === b.confirmation_code);`;
const matchingReplace = `const nameMatch = (name1, name2) => (name1 || '').toLowerCase().trim() === (name2 || '').toLowerCase().trim();
        const relatedOrder = (orderData || []).find(o => 
          (o.confirmation_code === b.confirmation_code && b.confirmation_code) || 
          (nameMatch(o.customer_name, b.name) && (o.visit_date === b.visit_date))
        );`;

data = data.replace(matchingSearch, matchingReplace);

// 3. Update mapping logic in renderDashboard
// BROADENED KIOSK/QUAD DETECTION already had items, but let's make it even more robust
const mapLogicSearch = `    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      
      // BROADENED KIOSK DETECTION
      bItems.forEach(item => {
        const pNameLower = (item.product_name || '').toLowerCase();
        if (pNameLower.includes('quiosque') || pNameLower.includes('camping')) {
           // Extract numeric ID from "Quiosque 04" or similar
           const kioskIdMatch = pNameLower.match(/quiosque\\s*(\\d+)/i);
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
      });`;

// Wait, looking at the previous file content view, the regex already had the same variable names.
// I'll re-apply the broaden check to ensure the kiosk match is exact.

writeFileSync(adminPath, data);
console.log('Fixed Confirmation Code Generation and Robust Mapping fallback');
