const fs = require('fs');

// --- 1. Update Admin.tsx ---
const adminPath = 'src/pages/Admin.tsx';
let adminData = fs.readFileSync(adminPath, 'utf8');

// Update handleAddNote to be more generic
const oldAddNote = `  const handleAddNote = async (id: string, note: string, isOrder: boolean) => {
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const { error } = await supabase
        .from(table)
        .update({ internal_notes: note })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      if (isOrder) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, internal_notes: note } : o));
      } else {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, internal_notes: note } : b));
      }
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };`;

const newAddNote = `  const handleAddNote = async (id: string, value: string, isOrder: boolean, field: string = 'internal_notes') => {
    try {
      const table = isOrder ? 'orders' : 'bookings';
      const updateField = field === 'cpf' && isOrder ? 'customer_cpf' : field;
      
      const { error } = await supabase
        .from(table)
        .update({ [updateField]: value })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      if (isOrder) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, [updateField]: value } : o));
      } else {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, [field]: value, [updateField]: value } : b));
      }
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };`;

// Flexible replacement for Admin.tsx handleAddNote
if (adminData.includes(oldAddNote.replace(/\n/g, '\r\n'))) {
    adminData = adminData.replace(oldAddNote.replace(/\n/g, '\r\n'), newAddNote.replace(/\n/g, '\r\n'));
} else if (adminData.includes(oldAddNote)) {
    adminData = adminData.replace(oldAddNote, newAddNote);
} else {
    // Regex fallback for handleAddNote
    const addNoteRegex = /const handleAddNote = async\s*\(id:\s*string,\s*note:\s*string,\s*isOrder:\s*boolean\)\s*=>\s*\{[\s\S]*?\.update\(\{ internal_notes: note \}\)[\s\S]*?\};/;
    adminData = adminData.replace(addNoteRegex, newAddNote);
}

// Update handleGeneratePayment to validate CPF
const oldPaymentLogic = `          cpf: (item.cpf || item.customer_cpf || '').replace(/\\D/g, ''),`;
const newPaymentLogic = `          cpf: (item.cpf || item.customer_cpf || '').replace(/\\D/g, ''),`;
// Actually, it's already updated, but let's add a check for missing CPF
const paymentStart = `const handleGeneratePayment = async (bookingId: string, isOrder: boolean) => {`;
const paymentCheck = `    const item = isOrder ? orders.find((o: any) => o.id === bookingId) : bookings.find((b: any) => b.id === bookingId);
    const rawCpf = (item?.cpf || item?.customer_cpf || '').replace(/\\D/g, '');
    
    if (!rawCpf || rawCpf.length < 11 || /^(\\d)\\1+$/.test(rawCpf)) {
      toast({ 
        title: "CPF INVÁLIDO", 
        description: "Preencha um CPF válido no campo acima antes de gerar o PIX.",
        variant: "destructive" 
      });
      return;
    }`;

if (!adminData.includes("CPF INVÁLIDO")) {
    adminData = adminData.replace(paymentStart, paymentStart + "\n" + paymentCheck);
}

fs.writeFileSync(adminPath, adminData);

// --- 2. Update BookingTable.tsx ---
const tablePath = 'src/components/admin/BookingTable.tsx';
let tableData = fs.readFileSync(tablePath, 'utf8');

// Add Hash to icons
if (!tableData.includes('Hash')) {
    tableData = tableData.replace('QrCode,', 'QrCode, Hash,');
}

// Add CPF Input field
const uiTargetLine = '{onFileUpload && (';
const cpfUi = `                                                      {/* Campo de CPF para PIX */}
                                                      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-2xl border border-emerald-100 shadow-inner group-hover:border-emerald-200 transition-all">
                                                         <div className="flex flex-col">
                                                            <label className="text-[7px] font-black uppercase text-emerald-600/60 tracking-widest leading-none mb-1">CPF (Obrigatório para PIX)</label>
                                                            <div className="flex items-center gap-1.5">
                                                               <Hash className="w-3 h-3 text-emerald-400" />
                                                               <input 
                                                                  value={booking.cpf || booking.customer_cpf || ''}
                                                                  placeholder="Digitar CPF..."
                                                                  onChange={(e) => onAddNote(booking.id, e.target.value.replace(/\\D/g, ''), !!booking.is_order, 'cpf')}
                                                                  className="bg-transparent border-none focus:ring-0 text-[11px] font-black text-emerald-950 placeholder:text-emerald-300 w-32 p-0 h-4"
                                                               />
                                                            </div>
                                                         </div>
                                                      </div>\n\n                                                      `;

if (!tableData.includes('CPF (Obrigatório para PIX)')) {
    tableData = tableData.replace(uiTargetLine, cpfUi + uiTargetLine);
}

fs.writeFileSync(tablePath, tableData);
console.log("Successfully updated Admin.tsx and BookingTable.tsx.");
