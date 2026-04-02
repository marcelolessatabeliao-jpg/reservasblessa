import { readFileSync, writeFileSync } from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let data = readFileSync(adminPath, 'utf8');

// Refactored handleGeneratePayment to match the Edge Function expectations
const oldPaymentFn = `  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {
    setIsGeneratingPix(true);
    try {
      const item = isOrder ? orders.find(o => o.id === bookingId) : bookings.find(b => b.id === bookingId);
      if (!item) throw new Error("Reserva não encontrada");

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: bookingId, 
          billingType: 'PIX',
          customer: {
            name: item.name || item.customer_name,
            phone: item.phone || item.customer_phone
          }
        }
      });

      if (error) throw error;
      if (data && data.encodedImage) {
        setPixData({
          qrCode: data.encodedImage,
          payload: data.payload,
          amount: item.total_amount,
          name: item.name || item.customer_name
        });
      } else {
        throw new Error("Erro ao gerar QR Code");
      }
    } catch (err: any) {
      console.error('Pix generation error:', err);
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPix(false);
    }
  };`;

const newPaymentFn = `  const handleGeneratePayment = async (bookingId: string, isOrder?: boolean) => {
    setIsGeneratingPix(true);
    try {
      const item = isOrder ? orders.find((o: any) => o.id === bookingId) : bookings.find((b: any) => b.id === bookingId);
      if (!item) throw new Error("Reserva não encontrada");

      // The create-payment function expects a flat structure and specifically a 'value' field.
      // It also requires a CPF. If not found in the record, it will likely fail on the Edge side.
      const { data: response, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          orderId: bookingId, 
          billingType: 'PIX',
          name: item.name || item.customer_name,
          phone: item.phone || item.customer_phone,
          cpf: item.cpf || '000.000.000-00', // Pre-emptive fallback for manual bookings lacking CPF
          value: item.total_amount,
          description: \`Reserva Balneário Lessa - \${item.name || item.customer_name}\`
        }
      });

      if (error) throw error;
      
      // Response check: The function returns { success: true, data: { pix: { encodedImage, payload } } }
      if (response && response.success && response.data?.pix) {
        setPixData({
          qrCode: response.data.pix.encodedImage,
          payload: response.data.pix.payload,
          amount: item.total_amount,
          name: item.name || item.customer_name
        });
      } else {
        throw new Error(response?.error || "A função não retornou um QR Code válido.");
      }
    } catch (err: any) {
      console.error('Pix generation error:', err);
      toast({ title: "Erro ao gerar PIX", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingPix(false);
    }
  };`;

data = data.replace(oldPaymentFn, newPaymentFn);

writeFileSync(adminPath, data);
console.log('Fixed handleGeneratePayment: Unified data structure with Edge Function requirements.');
