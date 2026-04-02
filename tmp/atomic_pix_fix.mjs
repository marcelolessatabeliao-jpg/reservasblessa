const fs = require('fs');

const adminPath = 'src/pages/Admin.tsx';
let data = fs.readFileSync(adminPath, 'utf8');

// 1. Add isValidCPF utility
const isValidCpfFunction = `
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
    data = data.replace('const KIOSKS = [', isValidCpfFunction + '\nconst KIOSKS = [');
}

// 2. Add state for generated PIX in modal
if (!data.includes('const [generatedPix, setGeneratedPix] = useState')) {
    data = data.replace('const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);', 
                        'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);\n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);');
}

// 3. Atomically update handleCreateInternalBooking
const oldInternalBooking = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    try {
      const { 
        name, phone, visit_date, 
        adults_normal, adults_half, 
        is_teacher, is_student, is_server, is_donor, is_solidarity, 
        is_pcd, is_tea, is_senior, is_birthday,
        children_free, selected_kiosks, quads, manual_discount, status 
      } = newBookingData;
      
      if (!name || !visit_date) {
        toast({ title: "Nome e Data são obrigatórios", variant: "destructive" });
        return;
      }

      // 1. Calculate Total
      let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
      selected_kiosks.forEach((id: number) => {
        total += (id === 1 ? 100 : 75);
      });
      
      const quadDiscount = getQuadDiscount(visit_date);
      quads.forEach((q: any) => {
        const base = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
        total += (base * (1 - quadDiscount)) * q.quantity;
      });

      total = Math.max(0, total - manual_discount);

      // 0. Generate Link Code
      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        cpf: newBookingData.cpf,
        confirmation_code: confCode,
        adults: (Number(adults_normal) || 0) + (Number(adults_half) || 0) + (Number(is_teacher) || 0) + (Number(is_student) || 0) + (Number(is_server) || 0) + (Number(is_donor) || 0) + (Number(is_solidarity) || 0) + (Number(is_pcd) || 0) + (Number(is_tea) || 0) + (Number(is_senior) || 0) + (Number(is_birthday) || 0),
        children: Array(Number(children_free) || 0).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;

      // 3. Create Order (Header only)
      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        customer_cpf: newBookingData.cpf,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode
      }).select().single();

      if (oError) throw oError;`;

const newInternalBooking = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    setGeneratedPix(null);
    let tempOrderId = null;
    let tempBookingId = null;

    try {
      const { 
        name, phone, visit_date, cpf,
        adults_normal, adults_half, 
        is_teacher, is_student, is_server, is_donor, is_solidarity, 
        is_pcd, is_tea, is_senior, is_birthday,
        children_free, selected_kiosks, quads, manual_discount, status 
      } = newBookingData;
      
      if (!name || !visit_date) {
        toast({ title: "Nome e Data são obrigatórios", variant: "destructive" });
        setLoading(false);
        return;
      }

      // CPF VALIDATION
      if (!isValidCPF(cpf)) {
        toast({ 
          title: "CPF INVÁLIDO", 
          description: "Por favor, digite um CPF válido para que o PIX seja gerado.",
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      // 1. Calculate Total
      let total = (adults_normal * 50) + ((adults_half + is_teacher + is_student + is_server + is_donor + is_solidarity) * 25);
      selected_kiosks.forEach((id: number) => {
        total += (id === 1 ? 100 : 75);
      });
      
      const quadDiscount = getQuadDiscount(visit_date);
      quads.forEach((q: any) => {
        const base = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
        total += (base * (1 - quadDiscount)) * q.quantity;
      });

      total = Math.max(0, total - manual_discount);
      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      // 2. Create Temporary Booking (Atomic-like)
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf,
        confirmation_code: confCode,
        adults: (Number(adults_normal) || 0) + (Number(adults_half) || 0) + (Number(is_teacher) || 0) + (Number(is_student) || 0) + (Number(is_server) || 0) + (Number(is_donor) || 0) + (Number(is_solidarity) || 0) + (Number(is_pcd) || 0) + (Number(is_tea) || 0) + (Number(is_senior) || 0) + (Number(is_birthday) || 0),
        children: Array(Number(children_free) || 0).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;
      tempBookingId = booking.id;

      // 3. Create Temporary Order
      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode
      }).select().single();

      if (oError) throw oError;
      tempOrderId = order.id;

      // 4. ATTEMPT PIX GENERATION (Asaas)
      try {
        const response = await supabase.functions.invoke('create-payment', {
          body: {
            orderId: order.id,
            name,
            email: 'admin@balneariolessa.com.br',
            phone,
            cpf: cpf.replace(/\\D/g, ''),
            billingType: 'PIX',
            value: total,
            description: \`Reserva Balneário Lessa - \${name}\`,
          }
        });

        if (response.error || !response.data?.data?.pix) {
          throw new Error(response.error?.message || response.data?.message || 'Falha ao gerar PIX no Asaas. CPF ou Dados podem estar incorretos.');
        }

        setGeneratedPix(response.data.data.pix);
        toast({ title: 'PIX Gerado com Sucesso', description: 'Escaneie o QR Code abaixo.' });

      } catch (err) {
        // ROLLBACK: Delete from DB if Asaas fails
        console.error('Asaas Failure - Rolling back DB entry:', err);
        await supabase.from('orders').delete().eq('id', tempOrderId);
        await supabase.from('bookings').delete().eq('id', tempBookingId);
        
        throw new Error(err.message || 'Erro ao comunicar com Asaas. Tente um CPF diferente.');
      }
`;

// Helper to replace handleCreateInternalBooking
const replacePattern = /const handleCreateInternalBooking = async \(\) => \{[\s\S]*?\/\/ 3\. Create Order \(Header only\)[\s\S]*?if \(oError\) throw oError;/;
data = data.replace(replacePattern, newInternalBooking);

// 4. Update the Modal UI to show the QR Code and a "Finalizar" button
const uiSection5 = `<div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">`;
const successUi = `{generatedPix ? (
                          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 py-10 space-y-6">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR Code" className="w-56 h-56" />
                            </div>
                            <div className="text-center space-y-2">
                               <p className="text-emerald-400 font-black uppercase text-xs tracking-widest leading-none">PIX Copia e Cola</p>
                               <div className="flex gap-2 items-center bg-white/10 p-4 rounded-2xl border border-white/20 max-w-sm">
                                  <p className="text-[10px] font-mono break-all line-clamp-2">{generatedPix.payload}</p>
                                  <button onClick={() => {
                                      navigator.clipboard.writeText(generatedPix.payload);
                                      toast({title: 'Copiado!'});
                                  }} className="bg-emerald-500 p-2 rounded-lg"><Check className="w-4 h-4 text-white" /></button>
                               </div>
                            </div>
                            <Button 
                               onClick={() => {
                                  setIsNewBookingOpen(false);
                                  setGeneratedPix(null);
                                  refreshData();
                               }}
                               className="w-full h-16 bg-white hover:bg-emerald-50 text-emerald-900 rounded-2xl font-black text-lg"
                            >
                               CONCLUÍDO - FECHAR ASSISTENTE
                            </Button>
                          </div>
                        ) : (
                         <div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">`;

if (!data.includes('generatedPix.encodedImage')) {
  // We need to find the matching closing div for section 5. 
  // This is tricky via simple search/replace, so I'll replace the whole block again.
  // Actually, I'll just wrap the content inside the section.
  data = data.replace(uiSection5, successUi);
  // Add the closing tag for the conditional
  data = data.replace('</Button>\n                        </div>\n                      </div>', '</Button>\n                        </div>\n                      </div>\n                    )}');
}

// Final cleanup: Ensure refreshData is called
if (!data.includes('refreshData();')) {
    // I already added it in the successUi block.
}

fs.writeFileSync(adminPath, data);
console.log("Successfully implemented Atomic PIX & CPF Validation in Admin.tsx.");
