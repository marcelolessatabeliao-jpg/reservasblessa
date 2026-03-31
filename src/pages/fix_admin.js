const fs = require('fs');
const path = 'Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

// Simple direct string replacement if possible
const oldStr = 'useEffect(() => {\n    if (token) fetchData();\n  }, [token, fetchData]);';
const newStr = `useEffect(() => {
    if (token) {
      fetchData();
      const channel = supabase
        .channel('admin_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_reservations' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quad_reservations' }, () => fetchData())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [token, fetchData]);`;

if (content.indexOf('if (token) fetchData();') !== -1) {
    // Replace the specific block
    content = content.replace(/useEffect\(\(\) => \{\s*if \(token\) fetchData\(\);\s*\}, \[token, fetchData\]\);/, newStr);
    console.log('Sync applied.');
} else {
    console.log('Sync target not found.');
}

// Check-in logic
const oldRedeem = /toast\(\{ title: "âœ“ Status atualizado" \}\);\s*fetchData\(\);/g;
const newRedeem = `if (status === 'checked-in' && isOrder) {
        await supabase.from('order_items').update({ is_redeemed: true }).eq('order_id', bookingId);
      }
      toast({ title: "✓ Status atualizado" });
      fetchData();`;

content = content.replace(oldRedeem, newRedeem);

fs.writeFileSync(path, content, 'utf8');
console.log('Done.');
