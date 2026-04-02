const fs = require('fs');
const path = 'src/pages/Admin.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

// 1. Import (Line 1)
if (!lines[0].includes('isValidCPF')) {
    lines.splice(1, 0, "import { isValidCPF } from '@/utils/cpf-validator';");
}

// 2. State (Lines 163+) - Find isNewBookingOpen
const iIdx = lines.findIndex(l => l.includes('const [isNewBookingOpen'));
if (iIdx !== -1 && !lines[iIdx+1].includes('generatedPix')) {
    lines.splice(iIdx + 1, 0, "  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);");
}

// 3. cpf in newBookingData - Find name: '',
const nIdx = lines.findIndex(l => l.includes("name: '',"));
if (nIdx !== -1 && !lines.some(l => l.includes("cpf: '',"))) {
    lines.splice(nIdx + 1, 0, "    cpf: '',");
}

// 4. handleCreateInternalBooking (Lines 474-578)
const fStart = lines.findIndex(l => l.includes('const handleCreateInternalBooking = async () => {'));
const fEnd = lines.findIndex((l, i) => i > fStart && l.includes('  };') && lines[i-1].includes('setLoading(false);'));

const newFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true); setGeneratedPix(null);
    let tB = null; let tO = null;
    const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
    
    if (!name || !visit_date || !isValidCPF(cpf)) {
      toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Campos faltando", description: "O CPF deve ser válido para prosseguir.", variant: "destructive" });
      setLoading(false); return;
    }

    try {
      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (Number(q.type==='dupla'?250:q.type==='adulto-crianca'?200:150)) * (1-qD) ) * q.quantity);
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: b, error: be } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf, confirmation_code: conf,
        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),
        children: Array(Number(children_free)||0).fill({age:10}),
        total_amount: total, status: status||'pending'
      }).select().single();
      if (be) throw be; tB = b.id;

      const { data: o, error: oe } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total, status: status||'pending', confirmation_code: conf
      }).select().single();
      if (oe) throw oe; tO = o.id;

      const res = await supabase.functions.invoke('create-payment', { body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: \`Reserva - \${name}\` } });
      if (res.error || !res.data?.data?.pix) throw new Error(res.error?.message || 'Falha no Asaas. CPF inválido.');
      
      setGeneratedPix(res.data.data.pix);
      toast({ title: 'Sucesso!' });
    } catch (err) {
       if (tO) await supabase.from('orders').delete().eq('id', tO); if (tB) await supabase.from('bookings').delete().eq('id', tB);
       toast({ title: "Falha", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };`;

if (fStart !== -1 && fEnd !== -1) {
    lines.splice(fStart, fEnd - fStart + 1, newFunc);
}

// 5. UI Grid (md:grid-cols-4)
const gIdx = lines.findIndex(l => l.includes('grid-cols-1 md:grid-cols-3 gap-6'));
if (gIdx !== -1) lines[gIdx] = lines[gIdx].replace('md:grid-cols-3', 'md:grid-cols-4');

// 6. Inject CPF Field
const nEndIdx = lines.findIndex(l => l.includes('placeholder="Nome Completo"')) + 1;
if (nEndIdx !== 0 && !lines.some(l => l.includes('CPF (Dígitos)'))) {
    const field = `                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> CPF (Dígitos)
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\\D/g, '')})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white text-emerald-950"
                               placeholder="Somente números"
                               maxLength={11}
                             />
                           </div>`;
    lines.splice(nEndIdx + 1, 0, field);
}

// 7. Success Screen (generatedPix)
const sStart = lines.findIndex(l => l.includes('<div className="bg-emerald-900 p-10'));
if (sStart !== -1 && !lines.some(l => l.includes('generatedPix ?'))) {
    const successTop = `                        {generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">FECHAR ASSISTENTE</Button>
                          </div>
                        ) : (
                          <div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">`;
    lines[sStart] = successTop;
    
    const sEnd = lines.findIndex(l => l.includes('</DialogFooter>')) - 1;
    lines.splice(sEnd, 0, '                    )}');
}

fs.writeFileSync(path, lines.join('\n'));
console.log("Admin.tsx sync completed.");
