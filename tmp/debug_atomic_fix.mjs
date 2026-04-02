const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

console.log("File length:", data.length);

const startKey = 'const handleCreateInternalBooking = async () => {';
const startIdx = data.indexOf(startKey);
console.log("Start Key index:", startIdx);

if (startIdx === -1) {
    console.log("SEARCHING WITH MORE TOLLERANCE...");
    const regex = /const\s+handleCreateInternalBooking\s+=\s+async\s+\(\)\s+=>\s+\{/;
    const match = data.match(regex);
    if (match) {
        console.log("Regex match found at:", match.index);
        // We will use this to replace
    } else {
        console.log("REGEX ALSO FAILED.");
        process.exit(1);
    }
}

// If we got here, startIdx or match.index is valid
// Let's just rewrite the whole function block using a very large search string
const oldCodeStart = '  const handleCreateInternalBooking = async () => {\n    setLoading(true);\n    try {';
const oldCodeEnd = '    } finally {\n      setLoading(false);\n    }\n  };';

// Let's use a dynamic search for the block
const blockStart = data.indexOf('const handleCreateInternalBooking = async () => {');
const blockEnd = data.indexOf('};', data.indexOf('setLoading(false);', blockStart)) + 2;

console.log("Block range:", blockStart, "to", blockEnd);

if (blockStart !== -1 && blockEnd > blockStart) {
    const newFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    setGeneratedPix(null);
    let tB = null; let tO = null;
    try {
      const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
      
      if (!name || !visit_date || !isValidCPF(cpf)) {
        toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Dados incompletos", variant: "destructive" });
        setLoading(false); return;
      }

      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (q.type==='dupla'?250:q.type==='adulto-crianca'?200:150) * (1-qD) ) * q.quantity);
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: b, error: be } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf, confirmation_code: conf,
        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),
        children: Array(Number(children_free)||0).fill({ age: 10 }),
        total_amount: total, status: status || 'pending'
      }).select().single();
      if (be) throw be; tB = b.id;

      const { data: o, error: oe } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total, status: status || 'pending', confirmation_code: conf
      }).select().single();
      if (oe) throw oe; tO = o.id;

      if (selected_kiosks.length > 0) {
        await supabase.from('kiosk_reservations').insert(selected_kiosks.map(id => ({ order_id: o.id, kiosk_id: id, kiosk_type: (id === 1 ? 'maior' : 'menor'), reservation_date: visit_date, quantity: 1 })));
      }

      if (quads.length > 0) {
        await supabase.from('quad_reservations').insert(quads.map(q => ({ order_id: o.id, quad_type: q.type, reservation_date: visit_date, time_slot: q.time, quantity: q.quantity })));
      }

      const res = await supabase.functions.invoke('create-payment', { body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: \`Reserva - \${name}\` } });
      if (res.error || !res.data?.data?.pix) throw new Error(res.error?.message || 'Falha Asaas');
      
      setGeneratedPix(res.data.data.pix);
      toast({ title: 'Sucesso!' });
    } catch (err) {
      if (tO) await supabase.from('orders').delete().eq('id', tO); if (tB) await supabase.from('bookings').delete().eq('id', tB);
      toast({ title: "Falha", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };`;
    data = data.substring(0, blockStart) + newFunc + data.substring(blockEnd);
}

// Import & State logic
if (!data.includes("import { isValidCPF }")) data = "import { isValidCPF } from '@/utils/cpf-validator';\n" + data;
if (!data.includes('generatedPix')) data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<any>(null);');
if (!data.includes("cpf: '',")) data = data.replace(/name: '',/, "name: '', cpf: '',");

// UI injection
data = data.replace('grid-cols-1 md:grid-cols-3 gap-6', 'grid-cols-1 md:grid-cols-4 gap-6');
if (!data.includes('CPF (Dígitos)')) {
    const namePos = data.indexOf('placeholder="Nome Completo"');
    const divPos = data.indexOf('</div>', namePos) + 6;
    data = data.substring(0, divPos) + `
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" /> CPF
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\\\\D/g, '')})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white text-emerald-950"
                               placeholder="Somente números"
                               maxLength={11}
                             />
                           </div>` + data.substring(divPos);
}

if (!data.includes('generatedPix ?')) {
    data = data.replace('<div className="bg-emerald-900', \`{generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6">
                            <div className="bg-white p-6 rounded-3xl border-8 border-emerald-500/20 shadow-2xl">
                               <img src={\\\`data:image/png;base64,\\\${generatedPix.encodedImage}\\\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">FECHAR</Button>
                          </div>
                      ) : (
                        <div className="bg-emerald-900\`);
    data = data.replace('</DialogFooter>', ')}</DialogFooter>');
}

fs.writeFileSync(path, data);
console.log("FINAL ATOMIC SYNC COMPLETED.");
