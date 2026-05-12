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
  MessageSquare, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Loader2,
  CheckCircle2,
  Download,
  Copy
} from 'lucide-react';
import { formatCurrency } from '@/lib/booking-types';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface VoucherShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  phone: string;
  dateStr: string;
  itemsList: string;
  code: string;
  onRefresh?: () => void;
}

export function VoucherShareDialog({
  open,
  onOpenChange,
  booking,
  phone,
  dateStr,
  itemsList,
  code,
  onRefresh
}: VoucherShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [imageGenerated, setImageGenerated] = useState<string | null>(null);
  const voucherRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const E_HERB = String.fromCodePoint(0x1F33F); // 🌿
  const E_CAL = String.fromCodePoint(0x1F4C5);  // 📅
  const E_USER = String.fromCodePoint(0x1F464); // 👤
  const E_NOTE = String.fromCodePoint(0x1F4DD); // 📝
  const E_MONEY = String.fromCodePoint(0x1F4B0); // 💰
  const E_SPARK = String.fromCodePoint(0x2728);  // ✨

  const name = booking.name || booking.customer_name || 'Cliente';

  const updateVoucherSent = async () => {
    if (booking.id && !booking.id.startsWith('order-')) {
      await supabase.from('orders')
        .update({ last_voucher_sent_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (onRefresh) onRefresh();
    }
  };

  const handleSendText = () => {
    const message = 
      E_HERB + " *BALNEÁRIO FAMÍLIA LESSA*\n\n" +
      "Esse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n" +
      E_CAL + " *Data:* " + dateStr + "\n" +
      E_USER + " *Titular:* " + name + "\n\n" +
      E_NOTE + " *Resumo do Pedido:*\n" + itemsList + "\n\n" +
      E_MONEY + " *Total:* " + formatCurrency(booking.total_amount) + "\n\n" +
      "Voucher: https://reservas.balneariolessa.com.br/voucher/" + code + "\n\n" +
      E_SPARK + " *Aguardamos vocês para o lazer que a sua família merece.*";

    const waLink = "https://api.whatsapp.com/send?phone=55" + phone + "&text=" + encodeURIComponent(message);
    window.open(waLink, "_blank");
    updateVoucherSent();
    onOpenChange(false);
  };

  const handleSendLink = () => {
    const message = "Olá! Segue o link do seu voucher para o Balneário Lessa. Sua reserva está confirmada!\n" +
      "https://reservas.balneariolessa.com.br/voucher/" + code + "\n\n" +
      "Aguardamos vocês!";
    
    const waLinkLink = "https://api.whatsapp.com/send?phone=55" + phone + "&text=" + encodeURIComponent(message);
    window.open(waLinkLink, "_blank");
    updateVoucherSent();
    onOpenChange(false);
  };

  const handleGenerateImage = async () => {
    setLoading(true);
    try {
      // Small delay to ensure render
      await new Promise(r => setTimeout(r, 100));
      
      if (voucherRef.current) {
        const canvas = await html2canvas(voucherRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const dataUrl = canvas.toDataURL('image/png');
        setImageGenerated(dataUrl);
        
        // Try to copy to clipboard if supported
        try {
           const blob = await (await fetch(dataUrl)).blob();
           await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
           ]);
           toast({ title: "Imagem Copiada!", description: "A imagem do voucher foi copiada. Agora basta colar no WhatsApp do cliente." });
        } catch (err) {
           console.log("Clipboard API failed, showing image instead", err);
           toast({ title: "Imagem Gerada!", description: "A imagem está pronta abaixo. Você pode baixar ou copiar." });
        }
        updateVoucherSent();
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white rounded-[2.5rem] overflow-hidden p-0 border-none shadow-2xl flex flex-col max-h-[95vh]">
        <DialogHeader className="p-6 bg-emerald-900 text-white shrink-0 sticky top-0 z-20">
          <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Enviar Voucher
          </DialogTitle>
          <DialogDescription className="text-emerald-100/60 font-bold text-xs uppercase tracking-widest">
            Escolha o formato de envio para {name}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {/* OPTION 1: TEXT + EMOJIS */}
          <Button 
            onClick={handleSendText}
            className="w-full h-16 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-2 border-emerald-200 flex justify-start gap-4 px-6 transition-all group"
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-sm uppercase">Opção 1 - Mensagem Completa</span>
              <span className="text-[10px] font-bold opacity-60">Texto organizado com emojis</span>
            </div>
          </Button>

          {/* OPTION 2: LINK ONLY */}
          <Button 
            onClick={handleSendLink}
            className="w-full h-16 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 border-2 border-blue-200 flex justify-start gap-4 px-6 transition-all group"
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-sm uppercase">Opção 2 - Apenas Link</span>
              <span className="text-[10px] font-bold opacity-60">Gera prévia visual no WhatsApp</span>
            </div>
          </Button>

          {/* OPTION 3: IMAGE */}
          <Button 
            onClick={handleGenerateImage}
            disabled={loading}
            className="w-full h-16 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-200 flex justify-start gap-4 px-6 transition-all group"
          >
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="flex flex-col items-start">
              <span className="font-black text-sm uppercase">Opção 3 - Gerar Imagem</span>
              <span className="text-[10px] font-bold opacity-60">Cria imagem para copiar e colar</span>
            </div>
          </Button>

          {imageGenerated && (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-3">
              <p className="text-[10px] font-black text-center text-slate-500 uppercase tracking-widest">Imagem Gerada com Sucesso!</p>
              <img src={imageGenerated} alt="Voucher" className="w-full rounded-lg shadow-md border border-slate-200" />
              <div className="flex gap-2">
                 <Button asChild variant="outline" className="flex-1 h-10 rounded-xl text-[10px] font-black">
                   <a href={imageGenerated} download={`Voucher_${code}.png`}>
                     <Download className="w-3.5 h-3.5 mr-2" /> BAIXAR
                   </a>
                 </Button>
                 <Button 
                    variant="outline" 
                    className="flex-1 h-10 rounded-xl text-[10px] font-black"
                    onClick={() => {
                       handleGenerateImage(); // Retry copy
                    }}
                 >
                    <Copy className="w-3.5 h-3.5 mr-2" /> COPIAR NOVAMENTE
                 </Button>
              </div>
            </div>
          )}
        </div>

        {/* HIDDEN VOUCHER FOR IMAGE GENERATION */}
        <div className="fixed -left-[2000px] top-0">
           <div ref={voucherRef} className="w-[400px] bg-white p-10 rounded-none border-t-[24px] border-emerald-900 flex flex-col items-center">
              <div className="text-center mb-8 w-full">
                 <h2 className="text-3xl font-black text-emerald-950 uppercase tracking-tighter leading-none mb-1">Voucher de Reserva</h2>
                 <p className="text-emerald-600 font-bold text-[11px] uppercase tracking-[0.2em]">Balneário Família Lessa</p>
              </div>
              
              <div className="space-y-6 w-full">
                 <div className="bg-emerald-50 p-6 rounded-[2rem] border-2 border-emerald-100 flex justify-between items-center shadow-sm">
                    <div>
                       <p className="text-[9px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Código de Confirmação</p>
                       <p className="text-2xl font-black text-emerald-900 font-mono tracking-[0.2em]">{code}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-emerald-100">
                       <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`} 
                        alt="QR" className="w-16 h-16" 
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50/80 p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Titular</p>
                       <p className="text-[13px] font-black text-slate-900 truncate leading-normal">{name}</p>
                    </div>
                    <div className="bg-slate-50/80 p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Data da Visita</p>
                       <p className="text-[13px] font-black text-slate-900 leading-normal">{dateStr}</p>
                    </div>
                 </div>

                 <div className="p-6 bg-white border-2 border-slate-100 rounded-[2rem] shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20"></div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumo do Pedido</p>
                    <div className="text-[11px] font-bold text-slate-800 whitespace-pre-wrap leading-relaxed">
                       {itemsList}
                    </div>
                 </div>

                 <div className="p-6 bg-emerald-950 rounded-[2rem] text-center shadow-xl border-t-4 border-emerald-500/30">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2">Total Pago</p>
                    <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(booking.total_amount)}</p>
                 </div>
              </div>

              <div className="mt-10 text-center pt-8 border-t-2 border-dashed border-slate-200 w-full">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Lazer que sua família merece</p>
                 <p className="text-[8px] font-bold text-slate-300 uppercase">www.balneariolessa.com.br</p>
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
