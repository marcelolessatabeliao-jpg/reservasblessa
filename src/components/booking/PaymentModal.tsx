import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, CreditCard, Copy, CheckCircle, Wallet, AlertTriangle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/booking-types';
import { useToast } from '@/hooks/use-toast';
import { trackFBEvent } from '@/utils/pixel-events';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  totalAmount: number;
  initialMethod?: PaymentMethod;
  onSuccess?: (method: string) => void;
}

type PaymentMethod = 'PIX' | 'CREDIT_CARD';

export function PaymentModal({ open, onOpenChange, orderId, name, email, phone, cpf: initialCpf, totalAmount, initialMethod, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [cpf, setCpf] = useState(initialCpf || '');
  const [methodStarted, setMethodStarted] = useState(false);

  useEffect(() => {
    if (open && initialMethod && !methodStarted && (initialCpf || cpf).length >= 11) {
      setMethodStarted(true);
      handleGeneratePayment(initialMethod);
    }
  }, [open, initialMethod, initialCpf, cpf, methodStarted]);

  useEffect(() => {
    if (!open) {
      setMethodStarted(false);
      setPixData(null);
    }
  }, [open]);

  useEffect(() => {
    if (!orderId || !open) return;

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new.status === 'paid' || payload.new.status === 'confirmed') {
            setConfirmationCode(payload.new.confirmation_code);
            setPaymentConfirmed(true);

            trackFBEvent('Purchase', { 
              value: totalAmount, 
              currency: 'BRL', 
              content_name: 'Reserva Balneário Lessa',
              content_ids: [orderId]
            });

            toast({
              title: 'Pagamento Confirmado!',
              description: 'Seu agendamento foi garantido com sucesso.',
            });
            onSuccess?.('paid_auto');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, open, toast, onOpenChange, onSuccess]);

  const handleGeneratePayment = async (method: PaymentMethod) => {
    setLoading(true);
    setPixData(null);
    try {
      // Get phone from booking state if needed, but the parent should ideally pass it.
      // For now, we'll try to find it from the orders table if it's missing, 
      // but let's assume we want to pass it from the form.
      
      const response = await supabase.functions.invoke('create-payment', {
        body: {
          orderId,
          name,
          email,
          phone,
          cpf, // Passando o CPF para a função
          billingType: method,
          value: totalAmount,
          description: `Reserva Balneário Lessa - ${name}`,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro na comunicação com o servidor de pagamento');
      }

      const { data: body } = response;
      const data = body.data;

      if (method === 'PIX' && data?.pix) {
        setPixData(data.pix);
        toast({ title: 'Código PIX Gerado', description: 'Escaneie o QR Code ou copie o código.' });
      } else if (method === 'CREDIT_CARD' && data?.invoiceUrl) {
        toast({
          title: 'Redirecionando...',
          description: 'Aguarde um momento.',
        });
        
        // Use a safer redirection for mobile
        setTimeout(() => {
          window.location.href = data.invoiceUrl;
        }, 100);
      }
    } catch (err: any) {
      console.error('[Payment] Error:', err);
      toast({
        title: 'Falha no Pagamento',
        description: err.message || 'Não foi possível conectar ao Asaas. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocalPayment = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).from('payments').insert({
        order_id: orderId,
        gateway: 'local',
        metodo: 'local',
        status: 'pending'
      });

      const { data: updatedOrder, error: fetchError } = await (supabase as any)
        .from('orders')
        .select('confirmation_code')
        .eq('id', orderId)
        .single();

      if (updatedOrder?.confirmation_code) {
         setConfirmationCode(updatedOrder.confirmation_code);
         setPaymentConfirmed(true);

         trackFBEvent('Purchase', { 
           value: totalAmount, 
           currency: 'BRL', 
           content_name: 'Reserva Balneário Lessa',
           content_ids: [orderId]
         });
      }

      toast({
        title: 'Reserva Confirmada',
        description: 'Faça o pagamento na bilheteria apresentando seu voucher.',
      });
      onSuccess?.('local');
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro no Pagamento',
        description: err.message || 'Falha ao processar pagamento local.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'PIX Copiado!',
      description: 'Código PIX Copia e Cola copiado para a área de transferência.',
    });
  };

  const handleSendWhatsApp = () => {
    if (!pixData || !phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    // Ensure international format (55 for BR if not present)
    const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    
    const message = `*Pagamento Seguro*\n\nEscaneie o QR Code no app do seu banco ou copie o c\u00F3digo abaixo:\n\n*PIX Copia e Cola:*\n${pixData.payload}\n\n${String.fromCodePoint(0x26A0)} *AVISO IMPORTANTE*\n\nSua reserva *S\u00D3 SER\u00C1 GARANTIDA* ap\u00F3s a confirma\u00E7\u00E3o do pagamento. O QR Code expira e a sua reserva pode ser ocupada por outro cliente se n\u00E3o for pago agora.`;
    
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-[2rem] p-6 shadow-2xl border-primary/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-gliker text-primary text-center">Pagamento Seguro</DialogTitle>
          {!pixData && (
            <DialogDescription className="text-center">
              Como deseja pagar o valor de <strong className="text-primary">{formatCurrency(totalAmount)}</strong>?
            </DialogDescription>
          )}
        </DialogHeader>

        {paymentConfirmed ? (
          <div className="flex flex-col items-center py-4 space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
              <CheckCircle className="w-12 h-12" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-gliker text-primary">Reserva Confirmada!</h3>
              <p className="text-sm text-muted-foreground font-medium">Apresente este código na entrada do Balneário</p>
            </div>

            <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-3xl p-8 w-full text-center space-y-4">
               <div className="animate-bounce">
                  <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest mb-1">CÓDIGO VOUCHER</p>
                  <p className="text-4xl font-mono font-black text-primary tracking-[0.2em]">{confirmationCode}</p>
               </div>
               
               <div className="flex justify-center bg-white p-4 rounded-2xl border shadow-sm max-w-[180px] mx-auto transition-transform hover:scale-110 duration-500">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${confirmationCode}`} 
                   alt="QR Code" 
                   className="w-32 h-32"
                 />
               </div>

               <div className="pt-2">
                 <p className="text-[10px] font-bold text-primary/60 leading-tight">
                   Guarde este código! Você poderá usá-lo na seção <span className="font-black text-primary">"Consultar Reserva"</span> no menu do site para acessar seu voucher a qualquer momento.
                 </p>
               </div>
            </div>

            <Button 
               onClick={() => {
                 onOpenChange(false);
                 window.location.href = '/'; // Redirecionar para o início para atualizar estado se necessário
               }}
               className="w-full h-16 bg-primary hover:bg-primary-dark text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95"
            >
              CONCLUÍDO - VOLTAR AO INÍCIO
            </Button>
            
            <p className="text-[10px] text-muted-foreground text-center px-4 font-medium italic">
              Enviamos um e-mail com os detalhes. Dica: Tire um print desta tela agora para levar com você!
            </p>
          </div>
        ) : loading && !pixData ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-bold text-primary animate-pulse tracking-widest uppercase">Processando Pagamento...</p>
            <p className="text-xs text-muted-foreground">Aguarde enquanto geramos sua cobrança segura.</p>
          </div>
        ) : !pixData ? (
          <div className="flex flex-col gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1">
                CPF do Pagador (Obrigatório para Produção)
              </label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="w-full h-12 px-4 rounded-xl border-2 border-primary/10 focus:border-primary/30 focus:outline-none text-sm font-medium transition-all"
              />
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-1 my-2">
              <div className="flex items-center gap-2 text-red-700 font-black text-[10px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5 fill-red-100" /> Aviso de Segurança
              </div>
              <p className="text-[10px] font-bold text-red-900 leading-tight">
                O Balneário Lessa <span className="underline italic">NÃO se responsabiliza</span> por pagamentos via PIX realizados para CPFs de terceiros. 
                Utilize <span className="underline italic">APENAS</span> o QR Code ou o Código Copia e Cola gerado abaixo.
              </p>
            </div>

            <Button 
              size="lg" 
              onClick={() => handleGeneratePayment('PIX')}
              disabled={loading || cpf.length < 11}
              className="w-full h-14 bg-[#00bdae] hover:bg-[#009b8f] text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <QrCode className="h-6 w-6" />}
              PAGAR COM PIX
            </Button>

            <Button 
              size="lg" 
              variant="outline"
              onClick={() => handleGeneratePayment('CREDIT_CARD')}
              disabled={loading || cpf.length < 11}
              className="w-full h-14 border-2 border-primary/20 hover:bg-primary/5 text-primary font-bold text-base rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              Cartão de Crédito
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-black text-amber-800 leading-tight">
                ⚠️ <span className="underline">ATENÇÃO:</span> Sua reserva só é garantida após a confirmação do pagamento. O slot permanece disponível para outros clientes até a conclusão da transação.
              </p>
            </div>

            <Button 
              size="lg" 
              variant="ghost"
              onClick={handleLocalPayment}
              disabled={loading}
              className="w-full h-14 bg-secondary/10 hover:bg-secondary/20 text-secondary-dark font-bold text-base rounded-2xl flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wallet className="h-5 w-5" />}
              Pagar no Local
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-4 space-y-4">
            <p className="text-sm font-bold text-foreground text-center">Escaneie o QR Code abaixo no app do seu banco:</p>
            <div className="bg-white p-3 border-2 border-primary/10 rounded-2xl shadow-sm">
              <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code PIX" className="w-48 h-48 mx-auto" />
            </div>
            
            <p className="text-xs text-muted-foreground font-medium text-center">Ou copie o código para pagar na função "PIX Copia e Cola":</p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-black text-amber-900 uppercase flex items-center gap-1">
                ⚠️ Aviso Importante
              </p>
              <p className="text-[10px] text-amber-800 leading-tight font-bold">
                Sua reserva <span className="underline">SÓ SERÁ GARANTIDA</span> após a confirmação do pagamento. O QR Code expira e a sua reserva pode ser ocupada por outro cliente se não for pago agora.
              </p>
            </div>
            
            <Button 
              onClick={handleCopyPix}
              variant={copied ? "default" : "outline"}
              className="w-full h-12 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm rounded-xl border-primary bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Código PIX Copiado' : 'Copiar Código PIX'}
            </Button>

            {phone && (
              <Button 
                onClick={handleSendWhatsApp}
                className="w-full h-12 flex items-center justify-center gap-2 font-black text-xs sm:text-sm rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                Enviar para WhatsApp do Cliente
              </Button>
            )}

            <Button 
              onClick={async () => {
                setLoading(true);
                try {
                  const { data, error } = await supabase.functions.invoke('check-payment', {
                    body: { orderId }
                  });
                  
                  if (error) throw error;
                  
                  if (data?.success && (data?.status === 'RECEIVED' || data?.status === 'CONFIRMED')) {
                    // Refetch status to get confirmation code
                    const { data: order } = await supabase.from('orders').select('confirmation_code').eq('id', orderId).single();
                    if (order?.confirmation_code) setConfirmationCode(order.confirmation_code);
                    setPaymentConfirmed(true);

                    trackFBEvent('Purchase', { 
                      value: totalAmount, 
                      currency: 'BRL', 
                      content_name: 'Reserva Balneário Lessa',
                      content_ids: [orderId]
                    });

                    toast({ title: "Confirmado!", description: "Seu pagamento foi identificado com sucesso." });
                  } else {
                    toast({ 
                      title: "Ainda não identificado", 
                      description: "O banco pode levar alguns minutos. Caso já tenha pago, aguarde um pouco." 
                    });
                  }
                } catch (err) {
                  console.error('Sync error:', err);
                  toast({ title: "Erro na verificação", description: "Tente novamente em instantes.", variant: "destructive" });
                } finally {
                  setLoading(false);
                }
              }}
              variant="ghost"
              className="w-full h-12 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Já paguei, verificar agora
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
