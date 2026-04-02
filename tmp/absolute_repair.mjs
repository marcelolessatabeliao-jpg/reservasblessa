import { readFileSync, writeFileSync } from 'fs';

// --- 1. ADMIN.TSX (DATABASE SCHEMA ALIGNMENT) ---
const adminPath = 'src/pages/Admin.tsx';
let adminData = readFileSync(adminPath, 'utf8');

// 1.1 Correct Kiosk Reservations insert
const kioskInsertSearch = /        await supabase\.from\('kiosk_reservations'\)\.insert\(selected_kiosks\.map\(\(id: number\) => \(\{[\s\S]*?\}\)\)\);/;
const kioskInsertReplace = `        await supabase.from('kiosk_reservations').insert(selected_kiosks.map((id: number) => ({
          order_id: order.id,
          kiosk_id: id,
          kiosk_type: (id === 1 ? 'maior' : 'menor'),
          reservation_date: visit_date,
          quantity: 1
        })));`;

adminData = adminData.replace(kioskInsertSearch, kioskInsertReplace);

// 1.2 Correct Quad Reservations insert
const quadInsertSearch = /        await supabase\.from\('quad_reservations'\)\.insert\(quads\.map\(\(q: any\) => \(\{[\s\S]*?\}\)\)\);/;
const quadInsertReplace = `        await supabase.from('quad_reservations').insert(quads.map((q: any) => ({
          order_id: order.id,
          quad_type: q.type,
          reservation_date: visit_date,
          time_slot: q.time,
          quantity: q.quantity
        })));`;

adminData = adminData.replace(quadInsertSearch, quadInsertReplace);
writeFileSync(adminPath, adminData);
console.log('Admin.tsx: Kiosk and Quad reservation schema alignment completed.');


// --- 2. BOOKINGTABLE.TSX (DUPLICATE UI COMPONENT REMOVAL) ---
const tablePath = 'src/components/admin/BookingTable.tsx';
let tableData = readFileSync(tablePath, 'utf8');

// We need a VERY generic regex to find the FIRST Voucher button that appears next to the upload label.
const voucherButtonSearch = /<Button\s+onClick=\{\(e\) => \{\s+e\.stopPropagation\(\);\s+const phone = \(\(booking as any\)\.customer_phone[\s\S]*?<\/Button>/;

const newTableData = tableData.replace(voucherButtonSearch, '');
if (newTableData !== tableData) {
    writeFileSync(tablePath, newTableData);
    console.log('BookingTable.tsx: Removed first duplicate voucher button.');
} else {
    // FALLBACK: Use a simpler search for the one specifically at line 432 area
    const fallbackSearch = /<Button\s+onClick=\{\(e\) => \{\s+e\.stopPropagation\(\);\s+const phone = \(\(booking as any\)\.customer_phone[\s\S]*?<FileCheck className="w-3.5 h-3.5" \/>\s+VOUCHER\s+<\/Button>/;
    const newTableData2 = tableData.replace(fallbackSearch, '');
    if (newTableData2 !== tableData) {
        writeFileSync(tablePath, newTableData2);
        console.log('BookingTable.tsx: Removed first duplicate voucher button (fallback used).');
    } else {
        console.error('FAILED TO REMOVE VOUCHER BUTTON! Regex mismatch.');
    }
}
