$path = "src/pages/Admin.tsx"
$content = Get-Content $path -Raw

# 1. Add generatedPix state
if ($content -notlike "*generatedPix*") {
    $content = $content -replace 'const \[isNewBookingOpen, setIsNewBookingOpen\] = useState\(false\);', 'const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);`n  const [generatedPix, setGeneratedPix] = useState<{encodedImage:string, payload:string} | null>(null);'
}

# 2. Add cpf to newBookingData
if ($content -notlike "*cpf: ''*") {
    $content = $content -replace "name: '',", "name: '',`n    cpf: '',"
}

# 3. Replace handleCreateInternalBooking (using a regex to find the whole function)
$newFunc = @"
  const handleCreateInternalBooking = async () => {
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
      
      if (!name || !visit_date || !isValidCPF(cpf)) {
        toast({ 
          title: !isValidCPF(cpf) ? "CPF INVÁLIDO" : "Dados incompletos", 
          description: "A reserva só é salva com um CPF válido e QR Code gerado.", 
          variant: "destructive" 
        });
        setLoading(false);
        return;
      }

      let total = (Number(adults_normal) * 50) + ((Number(adults_half) + Number(is_teacher) + Number(is_student) + Number(is_server) + Number(is_donor) + Number(is_solidarity)) * 25);
      if (selected_kiosks) {
        selected_kiosks.forEach((id: number) => total += (id === 1 ? 100 : 75));
      }
      const quadDiscount = getQuadDiscount(visit_date);
      if (quads) {
        quads.forEach((q: any) => {
          const base = q.type === 'dupla' ? 250 : q.type === 'adulto-crianca' ? 200 : 150;
          total += (base * (1 - quadDiscount)) * q.quantity;
        });
      }
      total = Math.max(0, total - manual_discount);
      const confCode = 'L-' + Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name, phone, visit_date, cpf,
        confirmation_code: confCode,
        adults: (Number(adults_normal)||0)+(Number(adults_half)||0)+(Number(is_teacher)||0)+(Number(is_student)||0)+(Number(is_server)||0)+(Number(is_donor)||0)+(Number(is_solidarity)||0)+(Number(is_pcd)||0)+(Number(is_tea)||0)+(Number(is_senior)||0)+(Number(is_birthday)||0),
        children: Array(Number(children_free)||0).fill({ age: 10 }),
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;
      tempBookingId = booking.id;

      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name, customer_phone: phone, customer_cpf: cpf,
        visit_date, total_amount: total,
        status: status || 'pending',
        confirmation_code: confCode
      }).select().single();

      if (oError) throw oError;
      tempOrderId = order.id;

      if (selected_kiosks && selected_kiosks.length > 0) {
        await supabase.from('kiosk_reservations').insert(selected_kiosks.map((id: number) => ({
          order_id: order.id, kiosk_id: id, kiosk_type: (id === 1 ? 'maior' : 'menor'),
          reservation_date: visit_date, quantity: 1
        })));
      }

      if (quads && quads.length > 0) {
        await supabase.from('quad_reservations').insert(quads.map((q: any) => ({
          order_id: order.id, quad_type: q.type,
          reservation_date: visit_date, time_slot: q.time, quantity: q.quantity
        })));
      }

      const response = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: order.id, name,
          email: 'admin@balneariolessa.com.br',
          phone, cpf: cpf.replace(/\D/g, ''),
          billingType: 'PIX',
          value: total,
          description: ``Reserva - `${name}``,
        }
      });

      if (response.error || !response.data?.data?.pix) {
        throw new Error(response.error?.message || 'Falha ao conectar com Asaas. Verifique se o CPF é estruturalmente válido e real.');
      }

      setGeneratedPix(response.data.data.pix);
      toast({ title: 'Reserva e PIX Gerados!', description: 'QR Code pronto para pagamento.' });

    } catch (err: any) {
      console.error('Rolling back:', err.message);
      if (tempOrderId) await supabase.from('orders').delete().eq('id', tempOrderId);
      if (tempBookingId) await supabase.from('bookings').delete().eq('id', tempBookingId);
      toast({ title: "Falha na Reserva", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
"@

# The regex for the old handleCreateInternalBooking is tricky because it has many lines.
# We'll use a placeholder replacement or match the start and end tokens.
$oldFuncStart = '  const handleCreateInternalBooking = async \(\) => \{'
$oldFuncEnd = '      setLoading\(false\);`r?`n    \}`r?`n  \};'
# But since I know the exact content from previous view_file, I'll use a more direct match.

# For simplicity, I'll rewrite the file using [regex]::Replace
$pattern = '(?s)const handleCreateInternalBooking = async \(\) => \{.*?setLoading\(false\);.*?\}'
$content = [regex]::Replace($content, $pattern, $newFunc)

# 4. Add CPF Field UI
if ($content -notlike "*Plus*") {
    # If Plus is not there, we use Phone as anchor
    $content = $content -replace 'placeholder="DDD \+ Número"`r?`n\s+/\>`r?`n\s+</div>', 'placeholder="DDD + Número"`n                               />`n                           </div>`n                           <div className="space-y-2">`n                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">`n                                <Plus className="w-3.5 h-3.5" /> CPF (Dígitos)`n                             </label>`n                             <Input `n                               value={newBookingData.cpf} `n                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value.replace(/\D/g, "")})} `n                               className="h-14 rounded-2xl border-2 border-emerald-100 font-bold bg-white text-emerald-950" `n                               placeholder="Somente números" `n                               maxLength={11}`n                             />`n                           </div>'
}

# 5. Add generatedPix UI success screen
if ($content -notlike "*generatedPix ?*") {
    $content = $content -replace 'className="bg-emerald-900 p-10 rounded-\[3rem\] text-white space-y-8 shadow-2xl relative overflow-hidden"\>', 'className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">`n                        {generatedPix ? (`n                          <div className="flex flex-col items-center py-10 space-y-6">`n                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">`n                               <img src={`data:image/png;base64,${generatedPix.encodedImage}`} alt="QR" className="w-56 h-56" />`n                            </div>`n                            <Button onClick={() => { setIsNewBookingOpen(false); setGeneratedPix(null); fetchData(); }} className="w-full h-16 bg-white text-emerald-900 rounded-2xl font-black">CONCLUÍDO - FECHAR</Button>`n                          </div>`n                        ) : ('
    
    # We need to find the place to close the ternary. It's after the Create button.
    $content = $content -replace 'CONCLUIR E SALVAR RESERVA`r?`n\s+\</Button\>', 'CONCLUIR E SALVAR RESERVA`n                           </Button>`n                        )}'
}

# 6. Change grid-cols-3 to 4
$content = $content -replace 'grid-cols-1 md:grid-cols-3 gap-6', 'grid-cols-1 md:grid-cols-4 gap-6'

[System.IO.File]::WriteAllText($path, $content)
