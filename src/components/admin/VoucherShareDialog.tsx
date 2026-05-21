import React, { useState, useRef, useEffect } from 'react';
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
  Copy,
  MapPin,
  Calendar,
  Users
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
  const [qrBase64, setQrBase64] = useState<string>('');
  const voucherRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const E_HERB = '🌿'; 
  const E_CAL = '📅';  
  const E_USER = '👤'; 
  const E_NOTE = '📝'; 
  const E_MONEY = '💰'; 
  const E_SPARK = '✨';  

  const name = booking.name || booking.customer_name || 'Cliente';

  useEffect(() => {
    setImageGenerated(null);
    if (code) {
      fetch(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${code}`)
        .then(res => res.blob())
        .then(blob => {
           const reader = new FileReader();
           reader.onloadend = () => setQrBase64(reader.result as string);
           reader.readAsDataURL(blob);
        })
        .catch(err => console.error('Failed to load QR', err));
    }
  }, [booking?.id, code]);

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

        {/* HIDDEN VOUCHER FOR IMAGE GENERATION (Using inline styles to guarantee perfect html2canvas render, matching Voucher.tsx layout) */}
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -10, opacity: 0, pointerEvents: 'none' }}>
           <div 
             ref={voucherRef} 
             style={{ 
               width: '800px', 
               backgroundColor: '#ffffff', 
               borderRadius: '40px',
               fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
               display: 'flex',
               flexDirection: 'column',
               boxSizing: 'border-box',
               overflow: 'hidden'
             }}
           >
              {/* Header */}
              <div style={{ backgroundColor: '#064e3b', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-1px', margin: '0 0 4px 0', lineHeight: 1 }}>Balneário Lessa</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Seu Voucher Digital</p>
                 </div>
                 <div style={{ backgroundColor: '#FFF033', color: '#022c22', fontSize: '12px', fontWeight: 900, padding: '8px 16px', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {booking.status === 'paid' || booking.status === 'confirmed' ? 'Entrada Confirmada' : 'Aguardando Pgto'}
                 </div>
              </div>
              
              <div style={{ display: 'flex', padding: '32px 40px', gap: '32px' }}>
                 {/* Left Column */}
                 <div style={{ width: '35%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <div style={{ padding: '12px', backgroundColor: '#ffffff', borderRadius: '32px', border: '4px solid rgba(6, 78, 59, 0.05)', marginBottom: '8px' }}>
                          <img 
                            src={qrBase64 || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${code}`} 
                            alt="QR Code" 
                            style={{ width: '140px', height: '140px', display: 'block' }} 
                            crossOrigin={qrBase64 ? undefined : "anonymous"}
                          />
                       </div>
                       <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 4px 0' }}>Código de Acesso</p>
                          <p style={{ fontSize: '28px', fontWeight: 900, color: '#064e3b', fontFamily: 'monospace', letterSpacing: '2px', margin: 0 }}># {code}</p>
                       </div>
                    </div>
                    
                    <div style={{ backgroundColor: 'rgba(255, 240, 51, 0.05)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255, 240, 51, 0.2)', marginTop: 'auto' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#064e3b', marginBottom: '8px' }}>
                          <MapPin size={16} />
                          <p style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Localização</p>
                       </div>
                       <p style={{ fontSize: '10px', color: 'rgba(6, 78, 59, 0.8)', fontWeight: 500, lineHeight: 1.5, margin: '0 0 12px 0' }}>
                          Via Araras, Setor 09 – Ariquemes/RO<br />
                          Apresente este QR Code na entrada para validação.
                       </p>
                       <div style={{ backgroundColor: '#FFF033', color: '#064e3b', fontWeight: 900, borderRadius: '12px', fontSize: '10px', padding: '10px', textAlign: 'center' }}>
                         📍 VER NO GOOGLE MAPS
                       </div>
                    </div>
                 </div>

                 {/* Right Column */}
                 <div style={{ width: '65%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Top Stats */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                       <div style={{ flex: 1, backgroundColor: 'rgba(241, 245, 249, 0.5)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Calendar size={16} color="#eab308" style={{ marginBottom: '6px' }} />
                          <p style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Data da Visita</p>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{dateStr}</p>
                       </div>
                       <div style={{ flex: 1, backgroundColor: 'rgba(241, 245, 249, 0.5)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Users size={16} color="#eab308" style={{ marginBottom: '6px' }} />
                          <p style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Titular</p>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0, wordBreak: 'break-word' }}>{name}</p>
                       </div>
                       <div style={{ flex: 1, backgroundColor: 'rgba(241, 245, 249, 0.5)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: '#eab308', lineHeight: 1, marginBottom: '6px' }}>R$</span>
                          <p style={{ fontSize: '9px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Valor Total</p>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#047857', margin: 0 }}>{formatCurrency(booking.total_amount || 0)}</p>
                       </div>
                    </div>

                    {/* Items */}
                    <div style={{ flex: 1 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(250, 204, 21, 0.4), transparent)' }} />
                          <span style={{ fontSize: '10px', fontWeight: 900, color: '#064e3b', textTransform: 'uppercase', letterSpacing: '1px' }}>Itens Inclusos</span>
                          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(250, 204, 21, 0.4), transparent)' }} />
                       </div>
                       
                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          {booking.order_items?.map((item: any, i: number) => {
                             const rawName = item.product_name || item.product_id || 'Serviço';
                             const unitPrice = item.unit_price ?? (item.total_price / (item.quantity || 1));
                             const isAdulto = rawName.toLowerCase().includes('adulto') || rawName.toLowerCase().includes('entrada');
                             const isAdultoSolidario = isAdulto && unitPrice <= 25 && unitPrice > 0;
                             const isAssinante = isAdulto && Math.abs(unitPrice) < 0.01;
                             
                             let displayName = isAssinante
                               ? 'Assinante Lessa Club'
                               : isAdultoSolidario
                                 ? 'Entrada Adulto Solidário'
                                 : rawName.replace(/^1x\s*/i, '');
                             
                             const lowerName = displayName.toLowerCase();
                             if (lowerName === 'adulto' || lowerName === 'criança' || lowerName === 'crianca' || lowerName === 'meia') {
                                displayName = `Entrada ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`;
                             }

                             return (
                               <div key={i} style={{ width: 'calc(50% - 6px)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                  <div style={{ backgroundColor: item.is_redeemed ? '#dcfce7' : 'rgba(6, 78, 59, 0.05)', padding: '4px', borderRadius: '50%' }}>
                                     <CheckCircle2 size={12} color={item.is_redeemed ? "#16a34a" : "rgba(6, 78, 59, 0.4)"} />
                                  </div>
                                  <div>
                                     <p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0, textDecoration: item.is_redeemed ? 'line-through' : 'none', opacity: item.is_redeemed ? 0.5 : 1 }}>
                                        {item.quantity}x {displayName}
                                     </p>
                                     {((item.product_id || '').toLowerCase().includes('quad') || (item.product_name || '').toLowerCase().includes('quad')) && (
                                        <span style={{ display: 'inline-block', marginTop: '2px', color: '#064e3b', fontWeight: 900, fontSize: '9px', backgroundColor: 'rgba(250, 204, 21, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
                                           {(item.metadata?.time_slot || 
                                            (booking.quad_reservations?.find((q: any) => 
                                              (q.quad_type || q.type || '').toUpperCase() === (item.product_id || '').toUpperCase() || 
                                              (item.product_id || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase()) ||
                                              (item.product_name || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase())
                                            )?.time_slot) || 
                                            (booking.quad_reservations?.[0]?.time_slot) || '')}
                                        </span>
                                     )}
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
