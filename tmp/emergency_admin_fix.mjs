const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Add isValidCPF
const cpfFunc = `
const isValidCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  const cleanCpf = cpf.replace(/\\D/g, '');
  if (cleanCpf.length !== 11 || /^(\\d)\\1+$/.test(cleanCpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  if (rest !== parseInt(cleanCpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if ((rest === 10) || (rest === 11)) rest = 0;
  if (rest !== parseInt(cleanCpf.substring(10, 11))) return false;
  return true;
};
`;
if (!data.includes('const isValidCPF =')) {
    data = data.replace('const KIOSKS = [', cpfFunc + '\nconst KIOSKS = [');
}

// 2. Add states
if (!data.includes('const [generatedPix, setGeneratedPix]')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}
if (!data.includes('cpf: \'\',')) {
    data = data.replace('name: \'\',', 'name: \'\',\n    phone: \'\',\n    cpf: \'\',');
    data = data.replace('phone: \'\',', ''); // cleanup overlap
}

// 3. Brutal replacement of handleCreateInternalBooking
const newFunc = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    setGeneratedPix(null);
    let tB = null; let tO = null;
    try {
      const { name, phone, visit_date, cpf, status, manual_discount, adults_normal, adults_half, is_teacher, is_student, is_server, is_donor, is_solidarity, is_pcd, is_tea, is_senior, is_birthday, children_free, selected_kiosks, quads } = newBookingData;
      if (!name || !visit_date || !isValidCPF(cpf)) {
        toast({ title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Campos obrigatórios faltando", variant: "destructive" });
        setLoading(false); return;
      }
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

const startIdx = data.indexOf('const handleCreateInternalBooking = async () => {');
const endIdx = data.indexOf('toast({ title: "Reserva criada com sucesso!" });', startIdx);
const finalEnd = data.indexOf('};', endIdx) + 2;

if (startIdx !== -1 && finalEnd !== -1) {
    data = data.substring(0, startIdx) + newFunc + data.substring(finalEnd);
}

fs.writeFileSync(path, data);
console.log("Admin.tsx fixed.");
