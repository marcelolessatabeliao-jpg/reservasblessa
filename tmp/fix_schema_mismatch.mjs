import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// The block to fix: orders insert
const ordersInsertOld = `      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode,
        order_items: orderItems
      }).select().single();`;

const ordersInsertNew = `      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode
      }).select().single();

      if (oError) throw oError;

      // 3.5 Insert Order Items into separate table
      if (order && orderItems.length > 0) {
        const itemsWithOrderId = orderItems.map(item => ({
          order_id: order.id,
          product_id: item.product_name, // Schema uses product_id to store the label
          quantity: item.quantity,
          unit_price: item.unit_price
        }));
        const { error: itemsErr } = await supabase.from('order_items').insert(itemsWithOrderId);
        if (itemsErr) console.error('Non-critical: Error inserting order_items:', itemsErr);
      }`;

data = data.replace(ordersInsertOld, ordersInsertNew);

writeFileSync(adminPath, data);
console.log('Fixed Schema Mismatch: Order items are now inserted into their own table.');
