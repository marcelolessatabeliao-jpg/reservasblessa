const fs = require('fs');
const path = 'src/pages/Admin.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);

// 1. IMPORT
if (!lines[1].includes('isValidCPF')) {
    lines.splice(1, 0, "import { isValidCPF } from '@/utils/cpf-validator';");
}

// 2. STATE
const stateIdx = lines.findIndex(l => l.includes('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);'));
if (stateIdx !== -1 && !lines.some(l => l.includes('generatedPix'))) {
    lines.splice(stateIdx + 1, 0, "  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);");
}

// 3. NEW BOOKING DATA
const nameIdx = lines.findIndex(l => l.includes("name: '',"));
if (nameIdx !== -1 && !lines.some(l => l.includes("cpf: '',"))) {
    lines.splice(nameIdx + 1, 0, "    cpf: '',");
}

// 4. ATOMIC FUNCTION (Replacement for lines 474-578 approx)
const funcStart = lines.findIndex(l => l.includes('const handleCreateInternalBooking = async () => {'));
const funcEnd = lines.findIndex((l, i) => i > funcStart && l.includes('  };') && lines[i-1].includes('setLoading(false);'));

const atomicFunc = [
    "  const handleCreateInternalBooking = async () => {",
    "    setLoading(true);",
    "    setGeneratedPix(null);",
    "    let tB = null; let tO = null;",
    "    try {",
    "      const { name, phone, visit_date, cpf, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads, manual_discount, status } = newBookingData;",
    "      if (!name || !visit_date || !isValidCPF(cpf)) {",
    '        toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Campos obrigatórios faltando", description: "O CPF é obrigatório para gerar o PIX.", variant: "destructive" });',
    "        setLoading(false); return;",
    "      }",
    "      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);",
    "      selected_kiosks.forEach((id) => total += (id === 1 ? 100 : 75));",
    "      const qD = getQuadDiscount(visit_date);",
    "      quads.forEach((q) => { const base = q.type==='dupla'?250:q.type==='adulto-crianca'?200:150; total += (base*(1-qD))*q.quantity; });",
    "      total = Math.max(0, total - manual_discount);",
    "      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();",
    "      const { data: b, error: be } = await supabase.from('bookings').insert({",
    "        name, phone, visit_date, cpf, confirmation_code: conf,",
    "        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),",
    "        children: Array(Number(children_free)||0).fill({ age: 10 }),",
    "        total_amount: total, status: status || 'pending'",
    "      }).select().single();",
    "      if (be) throw be; tB = b.id;",
    "      const { data: o, error: oe } = await supabase.from('orders').insert({",
    "        customer_name: name, customer_phone: phone, customer_cpf: cpf,",
    "        visit_date, total_amount: total, status: status || 'pending', confirmation_code: conf",
    "      }).select().single();",
    "      if (oe) throw oe; tO = o.id;",
    "      if (selected_kiosks.length > 0) { await supabase.from('kiosk_reservations').insert(selected_kiosks.map(id => ({ order_id: o.id, kiosk_id: id, kiosk_type: (id === 1 ? 'maior' : 'menor'), reservation_date: visit_date, quantity: 1 }))); }",
    "      if (quads.length > 0) { await supabase.from('quad_reservations').insert(quads.map(q => ({ order_id: o.id, quad_type: q.type, reservation_date: visit_date, time_slot: q.time, quantity: q.quantity }))); }",
    "      const res = await supabase.functions.invoke('create-payment', {",
    "        body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: `Reserva - ${name}` }",
    "      });",
    "      if (res.error || !res.data?.data?.pix) throw new Error(res.error?.message || 'Falha no Asaas. CPF inválido.');",
    "      setGeneratedPix(res.data.data.pix);",
    "      toast({ title: 'Reserva & PIX Criados!' });",
    "    } catch (err) {",
    "      if (tO) await supabase.from('orders').delete().eq('id', tO); if (tB) await supabase.from('bookings').delete().eq('id', tB);",
    '      toast({ title: "Falha na Reserva", description: err.message, variant: "destructive" });',
    "    } finally { setLoading(false); }",
    "  };"
];

if (funcStart !== -1 && funcEnd !== -1) {
    lines.splice(funcStart, funcEnd - funcStart + 1, ...atomicFunc);
}

// 5. UPDATE UI (CPF)
const phoneLine = lines.findIndex(l => l.includes('placeholder="DDD + Número"'));
const divEnd = lines.findIndex((l, i) => i > phoneLine && l.includes('</div>'));
if (divEnd !== -1 && !lines.some(l => l.includes('CPF (Validação)'))) {
    lines.splice(divEnd + 1, 0, 
        '                           <div className="space-y-2">',
        '                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5 font-bold">',
        '                                <Plus className="w-3.5 h-3.5" /> CPF (Dígitos)',
        '                             </label>',
        '                             <Input ',
        '                               value={newBookingData.cpf} ',
        "                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\\D/g, '')})} ",
        '                               className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white text-emerald-950" ',
        '                               placeholder="Somente números" ',
        '                               maxLength={11} ',
        '                             />',
        '                           </div>'
    );
}

// 6. UPDATE UI (SUCCESS SCREEN)
const dialogStart = lines.findIndex(l => l.includes('<div className="bg-emerald-900 p-10'));
if (dialogStart !== -1 && !lines.some(l => l.includes('generatedPix ?'))) {
    const line = lines[dialogStart];
    lines[dialogStart] = `                        {generatedPix ? (
                          <div className="flex flex-col items-center py-10 space-y-6">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR" className="w-56 h-56" />
                            </div>
                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">CONCLUÍDO - FECHAR</Button>
                          </div>
                      ) : (` + line;
    const dialogEnd = lines.findIndex(l => l.includes('</DialogFooter>'));
    if (dialogEnd !== -1) lines.splice(dialogEnd, 0, '                    )}');
}

// 7. GRID COLS fix
const gridIdx = lines.findIndex(l => l.includes('grid-cols-1 md:grid-cols-3 gap-6'));
if (gridIdx !== -1) lines[gridIdx] = lines[gridIdx].replace('md:grid-cols-3', 'md:grid-cols-4');

fs.writeFileSync(path, lines.join('\n'));
console.log("FINAL ATOMIC SYNC SUCCESSFUL.");
