const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Add Import
if (!data.includes('import { isValidCPF }')) {
    data = "import { isValidCPF } from '@/utils/cpf-validator';\n" + data;
}

// 2. Add generatedPix state and fix newBookingData
if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}
if (!data.includes('cpf: \'\',')) {
    data = data.replace('name: \'\',', 'name: \'\', cpf: \'\',');
}

// 3. ATOMIC LOGIC REPLACEMENT
const newFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true); setGeneratedPix(null);
    let tB = null; let tO = null;
    const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
    
    if (!name || !visit_date || !isValidCPF(cpf)) {
      toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Verifique os campos obrigatórios", variant: "destructive" });
      setLoading(false); return;
    }

    try {
      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (q.type==='dupla'?250:q.type==='adulto-crianca'?200:150) * (1-qD) ) * q.quantity);
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

      // 4. CALL ASAAS - If it fails, delete entry so it never appears in admin
      const res = await supabase.functions.invoke('create-payment', { body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: \`Reserva - \${name}\` } });
      
      if (res.error || !res.data?.data?.pix) throw new Error(res.error?.message || res.data?.message || 'Falha ao gerar PIX. CPF pode estar inválido para o Asaas.');
      
      setGeneratedPix(res.data.data.pix);
      toast({ title: 'PIX Gerado!' });
    } catch (err) {
       // ROLLBACK
       if (tO) await supabase.from('orders').delete().eq('id', tO); 
       if (tB) await supabase.from('bookings').delete().eq('id', tB);
       toast({ title: "Erro no Salvamento", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };`;

const startIdx = data.indexOf('const handleCreateInternalBooking = async () => {');
const successMarker = 'toast({ title: "Reserva criada com sucesso!" });';
const endIdx = data.indexOf(successMarker, startIdx);
const finalEnd = data.indexOf('};', endIdx) + 2;

if (startIdx !== -1 && finalEnd !== -1) {
    data = data.substring(0, startIdx) + newFunc + data.substring(finalEnd);
}

// 4. UI: Injetar campo CPF e tela de Sucesso
const gridSearch = '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">';
if (data.includes(gridSearch)) {
    data = data.replace(gridSearch, '<div className="grid grid-cols-1 md:grid-cols-4 gap-6">');
}

if (!data.includes('Hash className="w-3.5 h-3.5"')) {
    const nameSection = data.indexOf('<Input \n                               value={newBookingData.name}');
    const endNameDiv = data.indexOf('</div>', nameSection) + 6;
    const cpfInput = `
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" /> CPF
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="000.000.000-00"
                             />
                           </div>`;
    data = data.substring(0, endNameDiv) + cpfInput + data.substring(endNameDiv);
}

if (!data.includes('generatedPix ?')) {
    const successShow = `{generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6">
                            <div className="bg-white p-6 rounded-3xl border-8 border-emerald-500/20 shadow-2xl">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR Code" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">FECHAR ASSISTENTE</Button>
                          </div>
                      ) : (
                        <div className="bg-emerald-900`;
    data = data.replace('<div className="bg-emerald-900', successShow);
    // Find the end of the button section to close the conditional
    const buttonClose = 'setLoading(false);';
    const lastButtonIdx = data.indexOf('</Button>', data.lastIndexOf(buttonClose)) + 9;
     data = data.substring(0, lastButtonIdx) + '\n                      </div>\n                    )}' + data.substring(lastButtonIdx);
}

fs.writeFileSync(path, data);
console.log("Admin.tsx Final Sync Completed.");
