const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Force Imports at the very top
if (!data.includes("import { isValidCPF } from '@/utils/cpf-validator';")) {
    data = "import { isValidCPF } from '@/utils/cpf-validator';\n" + data;
}

// 2. Force State
if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace(/const \[isNewBookingOpen, setIsNewBookingOpen\] = useState\(false\);/, 
        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}
if (!data.includes("cpf: '',")) {
    data = data.replace(/name: '',/, "name: '', cpf: '',");
}

// 3. REFACTOR handleCreateInternalBooking (ATOMIC)
// Using a regex to find the whole function body
const funcRegex = /const handleCreateInternalBooking = async \(\) => \{[\s\S]*?fetchData\(\);[\s\S]*?\} finally \{[\s\S]*?setLoading\(false\);[\s\S]*?\}[\s\S]*?\};/;

const atomicFunc = `const handleCreateInternalBooking = async () => {
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
      
      if (!name || !visit_date || !isValidCPF(cpf)) {
        toast({ 
          title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Verifique os dados", 
          description: "O CPF deve ser válido para prosseguir com a reserva.", 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (q.type==='dupla'?250:q.type==='adulto-crianca'?200:150) * (1-qD) ) * q.quantity);
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // Step A: Persist Booking
      const { data: b, error: be } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf, confirmation_code: conf,
        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),
        children: Array(Number(children_free)||0).fill({ age: 10 }),
        total_amount: total, status: status || 'pending'
      }).select().single();
      if (be) throw be; tB = b.id;

      // Step B: Persist Order
      const { data: o, error: oe } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total, status: status || 'pending', confirmation_code: conf
      }).select().single();
      if (oe) throw oe; tO = o.id;

      // Step C: Link Tables
      if (selected_kiosks.length > 0) {
        await supabase.from('kiosk_reservations').insert(selected_kiosks.map(id => ({
          order_id: o.id, kiosk_id: id, kiosk_type: (id === 1 ? 'maior' : 'menor'),
          reservation_date: visit_date, quantity: 1
        })));
      }

      // Step D: ASAAS (Final checkpoint)
      const res = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: o.id, name, email: 'admin@balneariolessa.com.br',
          phone, cpf: cpf.replace(/\\D/g, ''),
          billingType: 'PIX', value: total,
          description: \`Reserva - \${name}\`,
        }
      });

      if (res.error || !res.data?.data?.pix) {
        throw new Error(res.error?.message || res.data?.message || 'Falha ao gerar o PIX no Asaas.');
      }

      setGeneratedPix(res.data.data.pix);
      toast({ title: 'Sucesso!', description: 'Reserva e PIX gerados.' });

    } catch (err) {
       console.error('Rolling back:', err.message);
       if (tO) await supabase.from('orders').delete().eq('id', tO);
       if (tB) await supabase.from('bookings').delete().eq('id', tB);
       toast({ title: "Falha na Criação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };`;

data = data.replace(funcRegex, atomicFunc);

// 4. Injetar UI (Grid e CPF)
data = data.replace(/grid grid-cols-1 md:grid-cols-3 gap-6/, 'grid grid-cols-1 md:grid-cols-4 gap-6');

if (!data.includes('CPF (Validação)')) {
    const nameSectionIdx = data.indexOf('</div>', data.indexOf('placeholder="Nome Completo"')) + 6;
    const cpfUI = `
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
                           </div>`;
    data = data.substring(0, nameSectionIdx) + cpfUI + data.substring(nameSectionIdx);
}

// 5. Injetar Tela de Sucesso (Pix)
if (!data.includes('generatedPix ?')) {
    data = data.replace('<div className="bg-emerald-900', \`{generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\\\`data:image/png;base64,\\\${generatedPix.encodedImage}\\\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">CONCLUÍDO - FECAR</Button>
                          </div>
                      ) : (
                        <div className="bg-emerald-900\`);
    
    // Add closing brace
    data = data.replace(/<\/DialogFooter>/, ')}</DialogFooter>');
}

fs.writeFileSync(path, data);
console.log("Atomic Sync SUCCESS.");
