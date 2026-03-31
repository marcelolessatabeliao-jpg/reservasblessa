const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Real-time Sync
const syncTarget = 'useEffect(() => {\n    if (token) fetchData();\n  }, [token, fetchData]);';
const syncReplacement = `  useEffect(() => {
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

if (content.includes(syncTarget)) {
    content = content.replace(syncTarget, syncReplacement);
    console.log('Real-time sync applied.');
} else {
    // Try without indentation
    const syncTargetSimple = 'if (token) fetchData();';
    if (content.includes(syncTargetSimple)) {
        content = content.replace(syncTargetSimple, '{\n      fetchData();\n      const channel = supabase.channel("admin_changes").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "kiosk_reservations" }, () => fetchData()).on("postgres_changes", { event: "*", schema: "public", table: "quad_reservations" }, () => fetchData()).subscribe();\n      return () => { supabase.removeChannel(channel); };\n    }');
         console.log('Real-time sync applied (fallback).');
    }
}

// 2. status persistence
if (content.includes('updateBookingStatus')) {
    const oldLine = 'toast({ title: "âœ“ Status atualizado" });';
    const newLine = `if (status === 'checked-in' && isOrder) {
        await supabase.from('order_items').update({ is_redeemed: true }).eq('order_id', bookingId);
      }
      toast({ title: "✓ Status atualizado" });`;
    if (content.includes(oldLine)) {
        content = content.replace(oldLine, newLine);
        console.log('Check-in persistence applied.');
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.tsx finalized.');
