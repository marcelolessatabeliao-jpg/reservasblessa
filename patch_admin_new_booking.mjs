import fs from 'fs';
const file = 'src/pages/Admin.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add States
const stateTarget = '  const [isGeneratingPix, setIsGeneratingPix] = useState(false);';
const stateAddition = `
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [newBookingData, setNewBookingData] = useState<any>({
    name: '',
    phone: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    adults_normal: 1,
    adults_solidario: 0,
    children: 0,
    kiosk_id: null,
    has_quad: false,
    status: 'pending'
  });`;
content = content.replace(stateTarget, stateTarget + stateAddition);

// 2. Add handleCreateInternalBooking
const functionTarget = '  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {';
const handleCreateFn = `  const handleCreateInternalBooking = async () => {
    setLoading(true);
    try {
      const { name, phone, visit_date, adults_normal, adults_solidario, children, kiosk_id, has_quad, status } = newBookingData;
      
      if (!name || !visit_date) {
        toast({ title: "Nome e Data são obrigatórios", variant: "destructive" });
        return;
      }

      // Calculate Total
      let total = (adults_normal * 50) + (adults_solidario * 25);
      if (kiosk_id) {
        total += (kiosk_id === 1 ? 100 : 75);
      }
      if (has_quad) {
        total += 150; // Generic individual quad price for simplicity
      }

      // 1. Create Booking
      const { data: booking, error: bError } = await supabase.from('bookings').insert({
        name,
        phone,
        visit_date,
        adults: adults_normal + adults_solidario,
        children: Array(Number(children)).fill({ age: 5 }), // Dummy children data
        total_amount: total,
        status: status || 'pending'
      }).select().single();

      if (bError) throw bError;

      // 2. Create Order for Dashboard
      const { data: order, error: oError } = await supabase.from('orders').insert({
        customer_name: name,
        customer_phone: phone,
        visit_date,
        total_amount: total,
        status: status || 'pending',
        booking_id: booking.id,
        order_items: [
           { product_name: 'Adulto Normal', quantity: adults_normal, unit_price: 50 },
           { product_name: 'Adulto Solidário', quantity: adults_solidario, unit_price: 25 },
           kiosk_id ? { product_name: 'Quiosque ' + kiosk_id, quantity: 1, unit_price: (kiosk_id === 1 ? 100 : 75) } : null,
           has_quad ? { product_name: 'Quadriciclo', quantity: 1, unit_price: 150 } : null
        ].filter(Boolean)
      }).select().single();

      if (oError) throw oError;

      // 3. Create Kiosk Reservation if needed
      if (kiosk_id) {
        await supabase.from('kiosk_reservations').insert({
          kiosk_id,
          reservation_date: visit_date,
          booking_id: booking.id,
          order_id: order.id,
          status: 'confirmed'
        });
      }

      toast({ title: "Reserva criada com sucesso!" });
      setIsNewBookingOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao criar reserva", description: err.message, variant: "destructive" });
    } finally {
      setLoading(true);
    }
  };\n\n`;
content = content.replace(functionTarget, handleCreateFn + functionTarget);

// 3. Update Nova Reserva Button
const buttonTarget = "onClick={() => window.open('/', '_blank')}";
content = content.replace(buttonTarget, "onClick={() => setIsNewBookingOpen(true)}");

// 4. Add Dialog JSX
const dialogTarget = '</Dialog>'; // After Pix Dialog
const newBookingDialog = `
                  <Dialog open={isNewBookingOpen} onOpenChange={setIsNewBookingOpen}>
                    <DialogContent className="sm:max-w-lg bg-white rounded-3xl border-2 border-emerald-100 overflow-hidden p-0 max-h-[95vh] overflow-y-auto">
                      <div className="bg-emerald-600 p-6 text-center">
                        <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Nova Reserva Interna</DialogTitle>
                        <p className="text-emerald-100 text-[10px] font-bold uppercase mt-1">Cadastro Simplificado (Sem CPF)</p>
                      </div>
                      
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-emerald-800 uppercase pl-1">Nome do Cliente</label>
                             <Input 
                               value={newBookingData.name} 
                               onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                               className="rounded-xl border-emerald-100 focus:ring-emerald-500/20"
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-emerald-800 uppercase pl-1">Telefone</label>
                             <Input 
                               value={newBookingData.phone} 
                               onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                               className="rounded-xl border-emerald-100 focus:ring-emerald-500/20"
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-emerald-800 uppercase pl-1">Data da Visita</label>
                             <Input 
                               type="date"
                               value={newBookingData.visit_date} 
                               onChange={e => setNewBookingData({...newBookingData, visit_date: e.target.value})}
                               className="rounded-xl border-emerald-100 focus:ring-emerald-500/20"
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-emerald-800 uppercase pl-1">Status Inicial</label>
                             <select 
                               className="w-full h-10 px-3 py-2 rounded-xl border border-emerald-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                               value={newBookingData.status}
                               onChange={e => setNewBookingData({...newBookingData, status: e.target.value})}
                             >
                                <option value="pending">Pendente (Não Pago)</option>
                                <option value="paid">Confirmada (Pago)</option>
                             </select>
                           </div>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-4">
                           <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest text-center border-b border-emerald-200 pb-2">Composição da Reserva</p>
                           
                           <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-1 text-center">
                                <label className="text-[8px] font-black text-emerald-800/60 uppercase">Adultos (50)</label>
                                <Input type="number" min="0" value={newBookingData.adults_normal} onChange={e => setNewBookingData({...newBookingData, adults_normal: parseInt(e.target.value) || 0})} className="text-center rounded-lg h-8 px-1" />
                              </div>
                              <div className="space-y-1 text-center">
                                <label className="text-[8px] font-black text-emerald-800/60 uppercase">Solidário (25)</label>
                                <Input type="number" min="0" value={newBookingData.adults_solidario} onChange={e => setNewBookingData({...newBookingData, adults_solidario: parseInt(e.target.value) || 0})} className="text-center rounded-lg h-8 px-1" />
                              </div>
                              <div className="space-y-1 text-center">
                                <label className="text-[8px] font-black text-emerald-800/60 uppercase">Crianças (0)</label>
                                <Input type="number" min="0" value={newBookingData.children} onChange={e => setNewBookingData({...newBookingData, children: parseInt(e.target.value) || 0})} className="text-center rounded-lg h-8 px-1" />
                              </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-emerald-800/60 uppercase pl-1">Quiosque (1-24)</label>
                                <Input type="number" min="0" max="24" value={newBookingData.kiosk_id || ''} onChange={e => setNewBookingData({...newBookingData, kiosk_id: parseInt(e.target.value) || null})} placeholder="Número" className="rounded-lg h-8" />
                              </div>
                              <div className="flex items-center gap-2 pt-4">
                                <input type="checkbox" id="has_quad" checked={newBookingData.has_quad} onChange={e => setNewBookingData({...newBookingData, has_quad: e.target.checked})} className="w-4 h-4 accent-emerald-600" />
                                <label htmlFor="has_quad" className="text-[10px] font-black text-emerald-800 uppercase cursor-pointer">Adicionar Quadriciclo</label>
                              </div>
                           </div>
                        </div>

                        <div className="text-center pt-2">
                           <p className="text-[10px] font-black text-emerald-800/60 uppercase mb-1">Total Previsto</p>
                           <p className="text-3xl font-black text-emerald-950">R$ {
                             ((newBookingData.adults_normal * 50) + (newBookingData.adults_solidario * 25) + (newBookingData.kiosk_id ? (newBookingData.kiosk_id === 1 ? 100 : 75) : 0) + (newBookingData.has_quad ? 150 : 0)).toFixed(2).replace('.', ',')
                           }</p>
                        </div>

                        <Button 
                          onClick={handleCreateInternalBooking}
                          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg"
                        >
                          Salvar Reserva
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>`;
content = content.replace(dialogTarget, dialogTarget + newBookingDialog);

fs.writeFileSync(file, content);
console.log('Successfully patched Admin.tsx with New Booking Dialog');
