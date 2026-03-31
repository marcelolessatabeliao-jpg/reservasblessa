const fs = require('fs');
const path = 'Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Real-time sync with robust regex
const oldSyncRegex = /useEffect\(\s*\(\s*\)\s*=>\s*\{\s*if\s*\(token\)\s*fetchData\(\);\s*\}\s*,\s*\[token\s*,\s*fetchData\]\s*\);/g;
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

if (content.match(oldSyncRegex)) {
    content = content.replace(oldSyncRegex, newSync);
    console.log('Real-time sync applied.');
} else {
    console.error('Target for real-time sync not found.');
}

// 2. Update updateBookingStatus
// Using a very loose match for the toast title which might have mojibake
const oldStatusRegex = /const updateBookingStatus = async\s*\(bookingId: string,\s*status: string,\s*isOrder\?: boolean\)\s*=>\s*\{[\s\S]+?toast\(\{ title: ".*?" \}\);[\s\S]+?fetchData\(\);[\s\S]+?\}[\s\S]+?\};/g;

// I'll search for the specific function and replace it
const oldFunc = `const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: "âœ“ Status atualizado" });
      fetchData();
    } catch (err) {
      console.error('Update status error:', err);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally { setUpdatingId(null); }
  };`;

if (content.includes('updateBookingStatus')) {
    // I'll manually find the bounds of the function to be safer
    const startIdx = content.indexOf('const updateBookingStatus = async');
    const endIdx = content.indexOf('};', startIdx) + 2; 
    // Wait, the function has multiple braces. I'll use a better approach.
}

// Re-using the literal from view_file for exact match (chunk replacement)
const oldFragment = `  const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;
      toast({ title: "âœ“ Status atualizado" });
      fetchData();
    } catch (err) {
      console.error('Update status error:', err);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally { setUpdatingId(null); }
  };`;

const newFragment = `  const updateBookingStatus = async (bookingId: string, status: string, isOrder?: boolean) => {
    setUpdatingId(bookingId);
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase.from(table).update({ status }).eq('id', bookingId);
      if (error) throw error;

      // Se for Checked-in e for um Pedido, marcar ITENS como redimidos (is_redeemed) no DB
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

if (content.includes('updateBookingStatus')) {
    // Attempting a block replacement
    const parts = content.split('const updateBookingStatus = async');
    if (parts.length > 1) {
        const afterFunc = parts[1].substring(parts[1].indexOf('};') + 2);
        content = parts[0] + newFragment + afterFunc;
        console.log('UpdateBookingStatus logic updated.');
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.tsx repair attempt complete.');
