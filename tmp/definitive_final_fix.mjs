import { readFileSync, writeFileSync } from 'fs';

// --- 1. FIX ADMIN.TSX (CRITICAL SCHEMA ERROR) ---
const adminPath = 'src/pages/Admin.tsx';
let adminData = readFileSync(adminPath, 'utf8');

// Define the robust replacement for handleCreateInternalBooking's save logic.
// We need to split the one-shot insert into multiple steps to respect the DB schema.

const createBookingSearch = /\/\/ 2\. Create Booking[\s\S]*?if \(oError\) throw oError;/;

const createBookingReplace = `// 0. Generate Link Code
      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        confirmation_code: confCode,
        adults: (Number(adults_normal) || 0) + (Number(adults_half) || 0) + (Number(is_teacher) || 0) + (Number(is_student) || 0) + (Number(is_server) || 0) + (Number(is_donor) || 0) + (Number(is_solidarity) || 0) + (Number(is_pcd) || 0) + (Number(is_tea) || 0) + (Number(is_senior) || 0) + (Number(is_birthday) || 0),
        children: Array(Number(children_free) || 0).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;

      // 3. Create Order (Header only)
      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode
      }).select().single();

      if (oError) throw oError;

      // 3.5 Create Order Items (Line entries)
      if (order && orderItems.length > 0) {
        const itemsToInsert = orderItems.map(item => ({
          order_id: order.id,
          product_id: item.product_name, // Projects uses product_id to store the label/name
          quantity: item.quantity,
          unit_price: item.unit_price
        }));
        const { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsErr) console.error('Error inserting items:', itemsErr);
      }`;

adminData = adminData.replace(createBookingSearch, createBookingReplace);
writeFileSync(adminPath, adminData);
console.log('Fixed Admin.tsx: Split Orders/Items inserts and added robust person counting.');


// --- 2. FIX BOOKINGTABLE.TSX (DUPLICATE VOUCHER BUTTON) ---
const tablePath = 'src/components/admin/BookingTable.tsx';
let tableData = readFileSync(tablePath, 'utf8');

const tableLines = tableData.split('\n');
let newTableLines = [];
let skipVoucher = false;
let removedCount = 0;

for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i];
    
    // We want to remove the first instance of <Button ... VOUCHER ... </Button> that is in the header (near FileCheck)
    if (removedCount === 0 && line.includes('<Button') && tableLines[i+1]?.includes('const phone = ((booking as any).customer_phone')) {
        skipVoucher = true;
        removedCount++;
    }
    
    if (skipVoucher) {
        if (line.includes('</Button>')) {
            skipVoucher = false;
            continue;
        }
    } else {
        newTableLines.push(line);
    }
}

writeFileSync(tablePath, newTableLines.join('\n'));
console.log('Fixed BookingTable.tsx: Removed duplicate voucher button.');
