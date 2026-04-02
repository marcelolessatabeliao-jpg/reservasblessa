import { readFileSync, writeFileSync } from 'fs';

// 1. FIX ADMIN.TSX (DUPLICATE IDENTIFIER)
const adminPath = 'src/pages/Admin.tsx';
let adminData = readFileSync(adminPath, 'utf8');

// Remove the first redundant confCode definition
const redundantDef = `            // 0. Define Local Link\n      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();\n\n`;
adminData = adminData.replace(redundantDef, '');

writeFileSync(adminPath, adminData);
console.log('Fixed Admin.tsx: Removed duplicate confCode definition.');


// 2. FIX BOOKINGTABLE.TSX (REDUNDANT UI BUTTON)
const tablePath = 'src/components\admin\BookingTable.tsx'.replace(/\\/g, '/');
let tableData = readFileSync(tablePath, 'utf8');

// Regex to find the first VOUCHER button in the actions header and remove it.
// It matches the <Button> tag up to </Button> specifically the one next to the upload label.
const voucherButtonRegex = /<Button\s+onClick=\{\(e\) => \{\s+e\.stopPropagation\(\);\s+const phone = \(\(booking as any\)\.customer_phone[\s\S]*?<\/Button>/;

const newTableData = tableData.replace(voucherButtonRegex, '');
if (newTableData !== tableData) {
    writeFileSync(tablePath, newTableData);
    console.log('Fixed BookingTable.tsx: Removed first duplicate voucher button.');
} else {
    console.error('FAILED to find voucher button in BookingTable.tsx');
}
