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
  totalAmount: number;
  onSuccess?: (method: string) => void;
}

type PaymentMethod = 'PIX' | 'CREDIT_CARD';

export function PaymentModal({ open, onOpenChange, orderId, name, email, totalAmount, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ encodedImage: string; payload: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
          if (payload.new.status === 'paid') {
            toast({
              title: 'Pagamento Confirmado!',
              description: 'Seu pagamento foi recebido com sucesso.',
            });
            onOpenChange(false);
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
      const response = await supabase.functions.invoke('create-asaas-payment', {
        body: {
          orderId,
          name,
          email,
          billingType: method,
          value: totalAmount,
          description: `Reserva Balneário Lessa - ${name}`,
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { data } = response;

      if (data.error) {
         throw new Error(data.error);
      }

      if (method === 'PIX' && data.pix) {
        setPixData(data.pix);
      } else if (method === 'CREDIT_CARD' && data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
        toast({
          title: 'Redirecionando...',
          description: 'Você está sendo redirecionado para a plataforma de pagamento seguro.',
        });
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro no Pagamento',
        description: err.message || 'Falha ao processar pagamento.',
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

      if (error) throw error;
      
      // Update order status to waiting_local
      await (supabase as any).from('orders').update({
        status: 'waiting_local',
        updated_at: new Date().toISOString()
      }).eq('id', orderId);
      
      toast({
        title: 'Reserva Confirmada',
        description: 'Faça o pagamento na bilheteria.',
      });
      onOpenChange(false);
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

        {!pixData ? (
          <div className="flex flex-col gap-4 mt-4">
            <Button 
              size="lg" 
              onClick={() => handleGeneratePayment('PIX')}
              disabled={loading}
              className="w-full h-14 bg-[#00bdae] hover:bg-[#009b8f] text-white font-black text-lg rounded-2xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <QrCode className="h-6 w-6" />}
              PAGAR COM PIX
            </Button>

            <Button 
              size="lg" 
              variant="outline"
              onClick={() => handleGeneratePayment('CREDIT_CARD')}
              disabled={loading}
              className="w-full h-14 border-2 border-primary/20 hover:bg-primary/5 text-primary font-bold text-base rounded-2xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              Cartão de Crédito
            </Button>

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
            
            <Button 
              onClick={handleCopyPix}
              variant={copied ? "default" : "outline"}
              className="w-full h-12 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm rounded-xl border-primary bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Código PIX Copiado' : 'Copiar Código PIX'}
            </Button>

            <Button 
              onClick={() => {
                onOpenChange(false);
                onSuccess?.('pix');
              }}
              variant="ghost"
              className="w-full h-12 font-bold text-xs sm:text-sm rounded-xl"
            >
              Já realizei o pagamento
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
