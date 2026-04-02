const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Add Import at the top if missing
if (!data.includes("import { isValidCPF } from '@/utils/cpf-validator';")) {
    data = "import { isValidCPF } from '@/utils/cpf-validator';\n" + data;
}

// 2. Function Replacement
const funcStart = 'const handleCreateInternalBooking = async () => {';
const successMarker = 'toast({ title: "Reserva criada com sucesso!" });';
const funcEndMarker = 'setLoading(false);';

const startIdx = data.indexOf(funcStart);
const markerIdx = data.indexOf(successMarker, startIdx);
const endIdx = data.indexOf('};', data.indexOf(funcEndMarker, markerIdx)) + 2;

const newAtomicFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    setGeneratedPix(null);
    let tB = null; let tO = null;

    try {
      const { 
        name, phone, visit_date, cpf,
        adults_normal, adults_half, 
        is_teacher, is_student, is_server, is_donor, is_solidarity, 
        is_pcd, is_tea, is_senior, is_birthday,
        children_free, selected_kiosks, quads, manual_discount, status 
      } = newBookingData;
      
      // STRICT VALIDATION
      if (!name || !visit_date || !isValidCPF(cpf)) {
        toast({ 
          title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Campos obrigatórios faltando", 
          description: "A reserva só é salva no sistema se o CPF for válido e o pagamento for processado.", 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      // 1. Calculate Total
      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach((id: number) => {
        total += (id === 1 ? 100 : 75);
      });
      const qD = getQuadDiscount(visit_date);
      quads.forEach((q: any) => {
        const base = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
        total += (base * (1 - qD)) * q.quantity;
      });
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Create Booking (Temporary)
      const { data: b, error: be } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf, confirmation_code: conf,
        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),
        children: Array(Number(children_free)||0).fill({ age: 10 }),
        total_amount: total, status: status || 'pending'
      }).select().single();
      if (be) throw be;
      tB = b.id;

      // 3. Create Order
      const { data: o, error: oe } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total, status: status || 'pending', confirmation_code: conf
      }).select().single();
      if (oe) throw oe;
      tO = o.id;

      // 4. CALL ASAAS - ATOMIC STEP
      const response = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: o.id, name, email: 'admin@balneariolessa.com.br',
          phone, cpf: cpf.replace(/\\D/g, ''),
          billingType: 'PIX', value: total,
          description: \`Reserva Balneário Lessa - \${name}\`,
        }
      });

      if (response.error || !response.data?.data?.pix) {
        throw new Error(response.error?.message || response.data?.message || 'Erro na API do Asaas. O CPF pode estar correto estruturalmente mas inválido na base da Receita/Asaas.');
      }

      setGeneratedPix(response.data.data.pix);
      toast({ title: 'Sucesso!', description: 'PIX Gerado com Sucesso.' });

    } catch (err) {
       // ROLLBACK Logic: If any step fails, remove from DB so it never "goes to the panel"
       console.error('Atomic Failure - Rolling back:', err.message);
       if (tO) await supabase.from('orders').delete().eq('id', tO);
       if (tB) await supabase.from('bookings').delete().eq('id', tB);
       toast({ title: "Falha na Reserva", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };`;

if (startIdx !== -1 && endIdx !== -1) {
    data = data.substring(0, startIdx) + newAtomicFunc + data.substring(endIdx);
}

// 3. Ensure state and UI are updated
if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}
if (!data.includes('cpf: \'\',')) {
    data = data.replace('name: \'\',', 'name: \'\', cpf: \'\',');
}

// UI GRID
data = data.replace('grid grid-cols-1 md:grid-cols-3 gap-6', 'grid grid-cols-1 md:grid-cols-4 gap-6');

// UI CPF FIELD (After Phone)
const phoneInput = 'placeholder="DDD + Número"';
if (!data.includes('label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">\\n                                 <Plus className="w-3.5 h-3.5" /> CPF')) {
    const phoneDivEnd = data.indexOf('</div>', data.indexOf(phoneInput)) + 6;
    const cpfField = \`
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> CPF (Obrigatório)
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\\\\D/g, '')})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white text-emerald-950"
                               placeholder="Somente números"
                               maxLength={11}
                             />
                           </div>\`;
    data = data.substring(0, phoneDivEnd) + cpfField + data.substring(phoneDivEnd);
}

// UI PIX SCREEN
if (!data.includes('generatedPix ?')) {
    const emeraldDiv = '<div className="bg-emerald-900 p-10';
    data = data.replace(emeraldDiv, \`{generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\\\`data:image/png;base64,\\\${generatedPix.encodedImage}\\\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">CONCLUÍDO - FECHAR</Button>
                          </div>
                        ) : (
                          \${emeraldDiv}\`);
    // Add closing brace before DialogFooter
    data = data.replace('</DialogFooter>', ')}</DialogFooter>');
}

fs.writeFileSync(path, data);
console.log("Atomic Admin Sync Fixed.");
