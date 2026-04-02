const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Add isValidCPF and states if missing
if (!data.includes('const isValidCPF =')) {
    const cpfFunc = `
const isValidCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  const clean = cpf.replace(/\\D/g, '');
  if (clean.length !== 11 || /^(\\d)\\1+$/.test(clean)) return false;
  let s = 0, r;
  for (let i = 1; i <= 9; i++) s = s + parseInt(clean.substring(i - 1, i)) * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(clean.substring(9, 10))) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s = s + parseInt(clean.substring(i - 1, i)) * (12 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(clean.substring(10, 11))) return false;
  return true;
};
`;
    data = data.replace('const KIOSKS = [', cpfFunc + '\nconst KIOSKS = [');
}

if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}

// 2. Fix state initialization
if (!data.includes('cpf: \'\',')) {
  data = data.replace('name: \'\',', 'name: \'\', cpf: \'\',');
}

// 3. Logic Replacement (Atomic)
const startMarker = 'const handleCreateInternalBooking = async () => {';
const oldFuncRegex = /const handleCreateInternalBooking = async \(\) => \{[\s\S]*?toast\(\{ title: "Reserva criada com sucesso!" \}\);[\s\S]*?setIsNewBookingOpen\(false\);[\s\S]*?fetchData\(\);[\s\S]*?\} catch \(err: any\) \{[\s\S]*?\} finally \{[\s\S]*?setLoading\(false\);[\s\S]*?\};/;

const newLogic = `  const handleCreateInternalBooking = async () => {
    setLoading(true); setGeneratedPix(null);
    let tB = null; let tO = null;
    const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
    if (!name || !visit_date || !isValidCPF(cpf)) {
      toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Campos faltando", variant: "destructive" });
      setLoading(false); return;
    }
    try {
      let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
      selected_kiosks.forEach(id => total += (id === 1 ? 100 : 75));
      const qD = getQuadDiscount(visit_date);
      quads.forEach(q => total += ( (q.type==='dupla'?250:q.type==='adulto-crianca'?200:150) * (1-qD) ) * q.quantity);
      total = Math.max(0, total - manual_discount);
      const conf = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: b, error: be } = await supabase.from('bookings').insert({ name, phone, visit_date, cpf, confirmation_code: conf, adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0), children: Array(Number(children_free)||0).fill({age:10}), total_amount: total, status: status||'pending' }).select().single();
      if (be) throw be; tB = b.id;
      const { data: o, error: oe } = await supabase.from('orders').insert({ customer_name: name, customer_phone: phone, customer_cpf: cpf, visit_date, total_amount: total, status: status||'pending', confirmation_code: conf }).select().single();
      if (oe) throw oe; tO = o.id;
      const res = await supabase.functions.invoke('create-payment', { body: { orderId: o.id, name, email: 'admin@balneariolessa.com.br', phone, cpf: cpf.replace(/\\D/g, ''), billingType: 'PIX', value: total, description: \`Reserva - \${name}\` } });
      if (res.error || !res.data?.data?.pix) throw new Error(res.error?.message || 'Erro no Asaas');
      setGeneratedPix(res.data.data.pix);
    } catch (err) {
      if (tO) await supabase.from('orders').delete().eq('id', tO); if (tB) await supabase.from('bookings').delete().eq('id', tB);
      toast({ title: "Falha", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };`;

data = data.replace(oldFuncRegex, newLogic);

// 4. UI Replacement (Grid and CPF Field)
const gridSearch = '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">';
const gridReplace = '<div className="grid grid-cols-1 md:grid-cols-4 gap-6">';
if (data.includes(gridSearch)) {
    data = data.replace(gridSearch, gridReplace);
}

const nameFieldSearch = '<Input \n                               value={newBookingData.name} \n                               onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}';
const cpfField = `
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
                           </div>\n`;

// Put CPF after name field
if (data.includes('name: e.target.value})}')) {
    const endOfNameDiv = data.indexOf('</div>', data.indexOf('name: e.target.value})}')) + 6;
    data = data.substring(0, endOfNameDiv) + cpfField + data.substring(endOfNameDiv);
}

// 5. Success Screen (Show Pix)
const section5Start = '<div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">';
if (!data.includes('generatedPix ?')) {
  data = data.replace(section5Start, `{generatedPix ? (
                          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 py-10 space-y-6">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR Code" className="w-56 h-56" />
                            </div>
                            <Button 
                               onClick={() => {
                                  setIsNewBookingOpen(false); setGeneratedPix(null); refreshData();
                               }}
                               className="w-full h-16 bg-white hover:bg-emerald-50 text-emerald-900 rounded-2xl font-black text-lg"
                            >
                               CONCLUÍDO - FECHAR
                            </Button>
                          </div>
                        ) : (
                          ` + section5Start);
    // Add the closing block
    const buttonClose = 'setIsNewBookingOpen(false);';
    const lastButtonDiv = data.indexOf('</Button>', data.lastIndexOf(buttonClose)) + 9;
    data = data.substring(0, lastButtonDiv) + '\n                        </div>\n                      </div>\n                    )}' + data.substring(lastButtonDiv);
}

fs.writeFileSync(path, data);
console.log("Final Sync Done.");
