import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Real-Time Sync
const oldSync = /useEffect\(\(\) => \{\s*if \(token\) fetchData\(\);\s*\}, \[token, fetchData\]\);/g;
const newSync = `useEffect(() => {
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

if (content.match(oldSync)) {
  content = content.replace(oldSync, newSync);
  console.log('Real-time sync applied.');
} else {
  console.warn('Real-time sync target not found.');
}

// 2. Update updateBookingStatus for is_redeemed
// Using a simpler regex to catch the updateBookingStatus function
const oldStatusFn = /const updateBookingStatus = async \(bookingId: string, status: string, isOrder\?: boolean\) => \{[\s\S]*?const table = isOrder \? 'orders' : 'bookings';\s*const \{ error \} = await supabase.from\(table\).update\(\{ status \}\).eq\('id', bookingId\);[\s\S]*?\};/g;

// Since the function is multi-line with possible mojibake (âœ“), I'll use a more flexible replacement
const statusFuncSearch = /const updateBookingStatus = async \(bookingId: string, status: string, isOrder\?: boolean\) => \{[\s\S]+?fetchData\(\);[\s\S]+?\} finally \{ setUpdatingId\(null\); \}\s*\};/;
const newStatusFunc = `const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;
      if (status === 'checked-in' && isOrder) {
        await supabase.from('order_items').update({ is_redeemed: true }).eq('order_id', bookingId);
      }
      toast({ title: "✓ Status atualizado" });
      fetchData();
    } catch (err) {
      console.error('Update status error:', err);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally { setUpdatingId(null); }
  };`;

if (content.match(statusFuncSearch)) {
  content = content.replace(statusFuncSearch, newStatusFunc);
  console.log('Check-in logic updated.');
} else {
  console.warn('Check-in logic target not found.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Admin.tsx updated successfully.');
