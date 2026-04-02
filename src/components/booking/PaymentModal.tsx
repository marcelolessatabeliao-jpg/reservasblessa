import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, QrCode, CreditCard, Copy, CheckCircle, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/booking-types';
import { useToast } from '@/hooks/use-toast';

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
               <div>
                  <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest mb-1">CÓDIGO VOUCHER</p>
                  <p className="text-4xl font-mono font-black text-primary tracking-[0.2em]">{confirmationCode}</p>
               </div>
               
               <div className="flex justify-center bg-white p-4 rounded-2xl border shadow-sm max-w-[180px] mx-auto">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${confirmationCode}`} 
                   alt="QR Code" 
                   className="w-32 h-32"
                 />
               </div>
            </div>

            <Button 
               onClick={() => onOpenChange(false)}
               className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-black rounded-2xl shadow-xl"
            >
              FECHAR E VOLTAR AO SITE
            </Button>
            
            <p className="text-[10px] text-muted-foreground text-center px-4">
              Enviamos os detalhes também para o seu e-mail e você pode tirar um print desta tela para agilizar seu check-in.
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
                Sua reserva <span className="underline">SÓ SERÁ GARANTIDA</span> e o inventário bloqueado após a confirmação do pagamento. O QR Code expira e a vaga pode ser ocupada por outro cliente se não for pago agora.
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

            <Button 
              onClick={async () => {
                setLoading(true);
                const { data, error } = await supabase.from('orders').select('status, confirmation_code').eq('id', orderId).single();
                setLoading(false);
                
                if (data?.status === 'paid' || data?.status === 'confirmed') {
                  setConfirmationCode(data.confirmation_code);
                  setPaymentConfirmed(true);
                  toast({ title: "Confirmado!", description: "Seu pagamento já foi identificado." });
                } else {
                  toast({ title: "Ainda não identificado", description: "O banco pode levar alguns minutos. Caso já tenha pago, aguarde um pouco." });
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
