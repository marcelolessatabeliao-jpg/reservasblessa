const fs = require('fs');

const adminPath = 'src/pages/Admin.tsx';
let data = fs.readFileSync(adminPath, 'utf8');

// 1. Force Imports
if (!data.includes('import { isValidCPF }')) {
    data = "import { isValidCPF } from '@/utils/cpf-validator';\n" + data;
}

// 2. Force State
if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
                        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}
if (!data.includes('cpf: \'\',')) {
    data = data.replace('name: \'\',', 'name: \'\', cpf: \'\',');
}

// 3. REFACTOR handleCreateInternalBooking (ATOMIC)
// Replacement based on unique markers to be highly reliable
const funcStart = 'const handleCreateInternalBooking = async () => {';
const searchEndStr = 'fetchData();';
const startIdx = data.indexOf(funcStart);
const endIdx = data.indexOf(searchEndStr, startIdx);
const finalEndIdx = data.indexOf('};', endIdx) + 2;

const newFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true); setGeneratedPix(null);
    let tB = null; let tO = null;
    const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
    
    // VALIDATION FIRST - Block completely if invalid
    if (!name || !visit_date || !isValidCPF(cpf)) {
      toast({ 
        title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Verifique os dados", 
        description: "A reserva só é salva se o CPF for válido.", 
        variant: "destructive" 
      });
      setLoading(false); return;
    }

    try {
      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (q.type==='dupla'?250:q.type==='adulto-crianca'?200:150) * (1-qD) ) * q.quantity);
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Step A: Insert into DB (Temporary state)
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

      // Step B: Call Asaas
      const res = await supabase.functions.invoke('create-payment', { body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: \`Reserva - \${name}\` } });
      
      if (res.error || !res.data?.data?.pix) {
        throw new Error(res.error?.message || res.data?.message || 'Asaas rejeitou os dados do pagador.');
      }
      
      setGeneratedPix(res.data.data.pix);
      toast({ title: 'Reserva Confirmada & PIX Gerado!' });

    } catch (err) {
       // ROLLBACK: Remove from DB if Asaas failed
       console.error('Rolling back since payment failed:', err.message);
       if (tO) await supabase.from('orders').delete().eq('id', tO); 
       if (tB) await supabase.from('bookings').delete().eq('id', tB);
       toast({ title: "Falha na Criação", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };`;

if (startIdx !== -1 && finalEndIdx !== -1) {
    data = data.substring(0, startIdx) + newFunc + data.substring(finalEndIdx);
}

// 4. Force UI update for CPF field
const uiGridOld = 'grid grid-cols-1 md:grid-cols-3 gap-6';
const uiGridNew = 'grid grid-cols-1 md:grid-cols-4 gap-6';
if (data.includes(uiGridOld)) {
    data = data.replace(uiGridOld, uiGridNew);
}

const nameInput = 'placeholder="Nome Completo"';
if (!data.includes('CPF (Dígitos)')) {
    const nameSectionIdx = data.indexOf('</div>', data.indexOf(nameInput)) + 6;
    const cpfUI = `
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> CPF (Dígitos)
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\\D/g, '')})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="Ex: 00000000000"
                               maxLength={11}
                             />
                           </div>`;
    data = data.substring(0, nameSectionIdx) + cpfUI + data.substring(nameSectionIdx);
}

// 5. Force UI update for Pix Screen
if (!data.includes('generatedPix ?')) {
    const modalStart = '<div className="bg-emerald-900 p-10';
    const successScreen = `{generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); fetchData(); setGeneratedPix(null); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">FECHAR ASSISTENTE</Button>
                          </div>
                        ) : (
                          <div className="bg-emerald-900`;
    data = data.replace('<div className="bg-emerald-900 p-10', successScreen);
    
    // Find the end to close
    const finalFooter = '</DialogFooter>';
    const endPos = data.indexOf(finalFooter);
    data = data.substring(0, endPos) + '\n                    )}' + data.substring(endPos);
}

fs.writeFileSync(adminPath, data);
console.log("Atomic Fix Applied successfully.");
