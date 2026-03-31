import fs from 'fs';

let adminTxt = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Fix .toLowerCase() on numbers (like order.id) causing runtime crash
adminTxt = adminTxt.replace(
    /return \(order\.customer_name \|\| ''\)\.toLowerCase\(\)\.includes\(s\) \|\|[\s\S]*?\(order\.created_at \|\| ''\)\.includes\(s\);/,
    `return String(order.customer_name || '').toLowerCase().includes(s) ||
            String(order.customer_phone || '').includes(s) ||
            String(order.cpf || '').includes(s) ||
            String(order.id || '').toLowerCase().includes(s) ||
            String(order.created_at || '').includes(s);`
);

// 2. Just in case, make sure the string conversion is robust everywhere the filter was injected
const oldFilterCode = `return (order.customer_name || '').toLowerCase().includes(s) ||
            (order.customer_phone || '').includes(s) ||
            (order.cpf || '').includes(s) ||
            (order.id || '').toLowerCase().includes(s) ||
            (order.created_at || '').includes(s);`;

if (adminTxt.includes(oldFilterCode)) {
    adminTxt = adminTxt.replace(oldFilterCode, `return String(order.customer_name || '').toLowerCase().includes(s) ||
            String(order.customer_phone || '').includes(s) ||
            String(order.cpf || '').includes(s) ||
            String(order.id || '').toLowerCase().includes(s) ||
            String(order.created_at || '').includes(s);`);
}

fs.writeFileSync('src/pages/Admin.tsx', adminTxt, 'utf8');
console.log('Fixed potential runtime error in order filtering');
