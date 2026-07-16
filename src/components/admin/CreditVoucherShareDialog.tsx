import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ImageIcon, 
  Loader2,
  CheckCircle2,
  Download,
  Copy,
  User,
  DollarSign,
  Gift
} from 'lucide-react';
import { formatCurrency } from '@/lib/booking-types';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";

interface CreditVoucherShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: any;
}

export function CreditVoucherShareDialog({
  open,
  onOpenChange,
  credit
}: CreditVoucherShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [imageGenerated, setImageGenerated] = useState<string | null>(null);
  const voucherRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setImageGenerated(null);
  }, [credit?.id]);

  if (!credit) return null;

  const name = credit.customer_name || 'Cliente';
  const availableBalance = (credit.amount || 0) - (credit.used_amount || 0);
  const creditCode = credit.id.split('-')[0].toUpperCase();

  const handleGenerateImage = async () => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      
      if (voucherRef.current) {
        const canvas = await html2canvas(voucherRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
        });
        const dataUrl = canvas.toDataURL('image/png');
        setImageGenerated(dataUrl);
        
        try {
           const blob = await (await fetch(dataUrl)).blob();
           await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
           ]);
           toast({ title: "Imagem Copiada!", description: "A imagem do voucher foi copiada. Agora basta colar no WhatsApp do cliente." });
        } catch (err) {
           toast({ title: "Imagem Gerada!", description: "A imagem está pronta abaixo. Você pode baixar ou colar manualmente." });
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = () => {
    const notesText = credit.notes ? `\n🏷️ *Motivo/Obs:* ${credit.notes}` : '';
    const message = `✨ *VALE CRÉDITO - BALNEÁRIO LESSA* ✨\n\nOlá ${name}!\nVocê possui um crédito ativo em nosso sistema.\n\n💰 *Valor Disponível:* ${formatCurrency(availableBalance)}\n📝 *Código:* #${creditCode}${notesText}\n\nApresente esta mensagem na sua próxima visita para utilizar seu saldo!\n\nAguardamos você!`;
    const phone = credit.customer_phone?.replace(/\D/g, '') || '';
    if (phone) {
      const waLink = `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(message)}`;
      window.open(waLink, "_blank");
      onOpenChange(false);
    } else {
      toast({ title: "Sem telefone", description: "O cliente não tem um telefone cadastrado para enviar a mensagem.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl flex flex-col max-h-[95vh]">
        <DialogHeader className="p-6 bg-amber-600 text-white shrink-0 sticky top-0 z-20">
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <Gift className="w-6 h-6 text-amber-200" />
            Voucher de Crédito
          </DialogTitle>
          <DialogDescription className="text-amber-100 font-bold text-xs uppercase tracking-widest">
            Enviar comprovante de saldo para {name}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <Button 
            onClick={handleGenerateImage}
            disabled={loading}
            className="w-full h-16 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-200 flex justify-start gap-4 px-6 transition-all group"
          >
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-sm uppercase">Gerar Imagem do Vale</span>
              <span className="text-[10px] font-bold opacity-60">Cria imagem visual para WhatsApp</span>
            </div>
          </Button>

          <Button 
            onClick={handleSendText}
            className="w-full h-16 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-2 border-emerald-200 flex justify-start gap-4 px-6 transition-all group"
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-sm uppercase">Enviar Texto no WhatsApp</span>
              <span className="text-[10px] font-bold opacity-60">Envia apenas a mensagem de texto</span>
            </div>
          </Button>

          {imageGenerated && (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
              <p className="text-[10px] font-black text-center text-slate-500 uppercase tracking-widest">Imagem Gerada com Sucesso!</p>
              <img src={imageGenerated} alt="Vale Crédito" className="w-full rounded-lg shadow-md border border-slate-200" />
              <div className="flex gap-2">
                 <Button asChild variant="outline" className="flex-1 h-10 rounded-xl text-[10px] font-black">
                   <a href={imageGenerated} download={`Vale_Credito_${creditCode}.png`}>
                     <Download className="w-3.5 h-3.5 mr-2" /> BAIXAR
                   </a>
                 </Button>
                 <Button 
                    variant="outline" 
                    className="flex-1 h-10 rounded-xl text-[10px] font-black"
                    onClick={handleGenerateImage}
                 >
                    <Copy className="w-3.5 h-3.5 mr-2" /> COPIAR
                 </Button>
              </div>
            </div>
          )}
        </div>

        {/* HIDDEN VOUCHER FOR IMAGE GENERATION */}
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -10, opacity: 0, pointerEvents: 'none' }}>
           <div 
             ref={voucherRef} 
             style={{ 
               width: '600px', 
               backgroundColor: '#ffffff', 
               borderRadius: '32px',
               fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
               display: 'flex',
               flexDirection: 'column',
               boxSizing: 'border-box',
               overflow: 'hidden',
               border: '2px solid #f59e0b'
             }}
           >
              <div style={{ backgroundColor: '#f59e0b', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-1px', margin: '0 0 4px 0', lineHeight: 1 }}>Balneário Lessa</h1>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Vale Crédito Digital</p>
                 </div>
                 <div style={{ backgroundColor: '#ffffff', color: '#b45309', fontSize: '12px', fontWeight: 900, padding: '8px 16px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Crédito Ativo
                 </div>
              </div>
              
              <div style={{ display: 'flex', padding: '32px', gap: '24px', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fffbeb', padding: '24px', borderRadius: '24px', border: '1px solid #fde68a' }}>
                    <div style={{ flex: 1 }}>
                       <p style={{ fontSize: '12px', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Titular do Crédito</p>
                       <p style={{ fontSize: '20px', fontWeight: 900, color: '#78350f', margin: 0 }}>{name}</p>
                       {credit.customer_phone && <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', margin: '4px 0 0 0' }}>{credit.customer_phone}</p>}
                    </div>
                    <div style={{ textAlign: 'right', paddingLeft: '24px', borderLeft: '2px dashed #fde68a' }}>
                       <p style={{ fontSize: '12px', fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Saldo Disponível</p>
                       <p style={{ fontSize: '32px', fontWeight: 900, color: '#047857', margin: 0 }}>{formatCurrency(availableBalance)}</p>
                    </div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                       <p style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Código de Autorização</p>
                       <p style={{ fontSize: '18px', fontWeight: 900, color: '#334155', fontFamily: 'monospace', letterSpacing: '2px', margin: 0 }}>#{creditCode}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                       <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, margin: 0 }}>Apresente este voucher na bilheteria</p>
                       <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, margin: 0 }}>para utilizar o seu saldo.</p>
                    </div>
                 </div>

                 {credit.notes && (
                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                       <p style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Motivo / Observação</p>
                       <p style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: 0 }}>{credit.notes}</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
