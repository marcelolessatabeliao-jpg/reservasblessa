import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, MapPin, Calendar, Users, Phone, ArrowLeft, Download, Share2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import html2canvas from 'html2canvas';
import { formatCurrency } from '@/lib/booking-types';

import { parseToRODate } from '@/utils/date-utils';

export default function Voucher() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrBase64, setQrBase64] = useState<string>('');
  const [generatingImg, setGeneratingImg] = useState(false);
  const voucherRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchVoucher() {
      if (!code) return;
      let { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*), quad_reservations (*)`)
        .eq('confirmation_code', code)
        .maybeSingle() as any;
        
      if (!data && code.length >= 5 && code.length <= 8 && /^[a-zA-Z0-9]+$/.test(code)) {
        const prefix = code.toLowerCase().padEnd(8, '0');
        const minUuid = `${prefix}-0000-0000-0000-000000000000`;
        const maxUuid = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
        const { data: idData } = await supabase
          .from('orders')
          .select(`*, order_items (*), quad_reservations (*)`)
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .maybeSingle() as any;
          
        if (idData) {
          data = idData;
        }
      }
      
      if (data) setOrder(data);
      setLoading(true);
      
      // Verification
      setLoading(false);
      
      if (data?.id) {
         fetch(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${data.id?.replace(/-/g,'').slice(0,8).toUpperCase()}`)
           .then(res => res.blob())
           .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => setQrBase64(reader.result as string);
              reader.readAsDataURL(blob);
           })
           .catch(err => console.error('Failed to load QR', err));
      }
    }
    fetchVoucher();
  }, [code]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-primary/5 font-black text-primary animate-pulse">CARREGANDO VOUCHER...</div>;
  
  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-white">
      <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl">⚠️</div>
      <h1 className="text-2xl font-black text-primary uppercase">Voucher Não Encontrado</h1>
      <p className="text-muted-foreground max-w-xs">Verifique o código ou entre em contato com o suporte do Balneário Lessa.</p>
      <Link to="/"><Button variant="outline" className="rounded-full px-8">VOLTAR PARA O SITE</Button></Link>
    </div>
  );

  const visitDate = order.visit_date ? parseToRODate(order.visit_date) : null;

  const handleSaveImage = async () => {
    setGeneratingImg(true);
    try {
      if (voucherRef.current) {
        // Hide the buttons before capturing
        const buttonsArea = voucherRef.current.querySelector('.voucher-buttons') as HTMLElement;
        if (buttonsArea) buttonsArea.style.display = 'none';
        
        const canvas = await html2canvas(voucherRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        });
        
        if (buttonsArea) buttonsArea.style.display = 'flex'; // restore
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Voucher_${order.id?.replace(/-/g,'').slice(0,8).toUpperCase()}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "Sucesso!", description: "Imagem do voucher baixada com sucesso." });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível gerar a imagem.", variant: "destructive" });
    } finally {
      setGeneratingImg(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans flex items-center justify-center">
      <div className="max-w-3xl w-full relative">
        
        {/* Ticket Perforation Effect Simulation (Top) */}
        <div className="absolute -top-3 left-0 right-0 flex justify-around px-4">
           {[...Array(20)].map((_, i) => <div key={i} className="w-4 h-4 bg-[#f8fafc] rounded-full hidden md:block" />)}
           {[...Array(10)].map((_, i) => <div key={i} className="w-4 h-4 bg-[#f8fafc] rounded-full block md:hidden" />)}
        </div>

        <div ref={voucherRef} className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-muted-foreground/10">
          
          {/* Header */}
          <div className="bg-primary p-6 md:p-8 text-white flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left gap-4 relative">
             <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">Balneário Lessa</h1>
                <p className="text-primary-foreground/60 text-xs font-bold uppercase tracking-widest">Seu Voucher Digital</p>
             </div>
             <div className={`md:self-center self-center text-[11px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-tight shadow-lg ${
                order.status === 'paid' || order.status === 'confirmed' ? 'bg-sun text-emerald-950' : 'bg-amber-100 text-amber-900 border border-amber-300'
             }`}>
                {order.status === 'paid' || order.status === 'confirmed' ? 'Entrada Confirmada' : 'Aguardando Pgto'}
             </div>
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-5 gap-8">
            
            {/* Left Column: QR Code & Notes */}
            <div className="md:col-span-2 flex flex-col space-y-6">
              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center">
                 <div className="p-3 bg-white border-4 border-primary/5 rounded-[2rem] shadow-inner mb-2">
                    <img 
                      src={qrBase64 || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://reservas.balneariolessa.com.br/voucher/${order.id?.replace(/-/g,'').slice(0,8).toUpperCase()}`} 
                      alt="QR Code" 
                      className="w-32 h-32 md:w-40 md:h-40"
                      crossOrigin={qrBase64 ? undefined : "anonymous"}
                    />
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">CÓDIGO DE ACESSO</p>
                    <p className="text-2xl md:text-3xl font-mono font-black text-primary tracking-widest"># {order.id?.replace(/-/g,'').slice(0,8).toUpperCase()}</p>
                 </div>
              </div>

              {/* Important Notes */}
              <div className="bg-sun/5 rounded-2xl p-4 border border-sun/20 space-y-2 mt-auto">
                 <div className="flex items-center gap-2 text-primary">
                    <MapPin className="w-4 h-4" />
                    <p className="text-xs font-black uppercase">Localização</p>
                 </div>
                 <p className="text-[9px] md:text-[10px] text-primary/80 leading-relaxed font-medium">
                    Via Araras, Setor 09 – Ariquemes/RO<br />
                    Apresente este QR Code na entrada para validação.
                 </p>
                 <Button 
                   asChild
                   className="w-full bg-[#FFF033] hover:bg-[#e6d800] text-primary font-black rounded-xl text-[10px] h-9 shadow-sm border border-primary/10 mt-2"
                 >
                   <a href="https://maps.app.goo.gl/cegNBpNfLQwraW8v8" target="_blank" rel="noopener noreferrer">
                     📍 VER NO GOOGLE MAPS
                   </a>
                 </Button>
              </div>
            </div>

            {/* Right Column: Details & Items */}
            <div className="md:col-span-3 space-y-6">
              {/* Visit Details */}
              <div className="grid grid-cols-3 gap-2">
                 <div className="bg-muted/30 p-3 rounded-2xl border border-muted-foreground/5 text-center flex flex-col items-center justify-center">
                    <Calendar className="w-4 h-4 text-sun mb-1.5" />
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Data da Visita</p>
                    <p className="text-xs font-bold leading-tight">{visitDate ? format(visitDate, "dd 'de' MMMM", { locale: ptBR }) : '—'}</p>
                 </div>
                 <div className="bg-muted/30 p-3 rounded-2xl border border-muted-foreground/5 text-center flex flex-col items-center justify-center">
                    <Users className="w-4 h-4 text-sun mb-1.5" />
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Titular</p>
                    <p className="text-xs font-bold w-full px-1 break-words leading-tight">{order.customer_name}</p>
                 </div>
                 <div className="bg-muted/30 p-3 rounded-2xl border border-muted-foreground/5 text-center flex flex-col items-center justify-center">
                    <span className="font-black text-sun text-sm mb-1.5 leading-none">R$</span>
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Valor Total</p>
                    <p className="text-xs font-bold text-emerald-700 w-full px-1">{formatCurrency(order.total_amount || 0)}</p>
                 </div>
              </div>

              {/* Items Included */}
              <div className="space-y-4 flex-1">
                 <div className="flex items-center gap-2">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-sun/40 to-transparent" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Itens Inclusos</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-sun/40 to-transparent" />
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {order.order_items?.map((item: any, i: number) => {
                       const rawName = item.product_name || item.product_id || 'Serviço';
                       const unitPrice = item.unit_price ?? (item.total_price / (item.quantity || 1));
                       
                       let displayNameRaw = rawName.replace(/^1x\s*/i, '');
                       const isGenericAdult = rawName.toLowerCase() === 'adulto' || rawName.toLowerCase() === 'entrada';
                       if (isGenericAdult) {
                         if (Math.abs(unitPrice) < 0.01) {
                           displayNameRaw = 'Assinante Lessa Club';
                         } else if (unitPrice <= 25 && unitPrice > 0) {
                           displayNameRaw = 'Entrada Adulto Solidário';
                         } else {
                           displayNameRaw = 'Entrada Adulto Inteira';
                         }
                       }
                           
                       let displayName = displayNameRaw;
                       const lowerName = displayName.toLowerCase();
                       if (lowerName === 'adulto' || lowerName === 'criança' || lowerName === 'crianca' || lowerName === 'meia') {
                          displayName = `Entrada ${displayName.charAt(0).toUpperCase() + displayName.slice(1)}`;
                       }

                       return (
                         <div key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <div className={item.is_redeemed ? "bg-green-100 p-1 rounded-full shrink-0" : "bg-primary/5 p-1 rounded-full shrink-0"}>
                               <CheckCircle2 className={item.is_redeemed ? "w-3 h-3 text-green-600" : "w-3 h-3 text-primary/40"} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold break-words ${item.is_redeemed ? "line-through opacity-50" : "text-foreground"}`}>
                                 {item.quantity}x {displayName}
                              </p>
                              {((item.product_id || '').toLowerCase().includes('quad') || (item.product_name || '').toLowerCase().includes('quad')) && (() => {
                                 const timeSlot = item.metadata?.time_slot || 
                                    (order.quad_reservations?.find((q: any) => 
                                      (q.quad_type || q.type || '').toUpperCase() === (item.product_id || '').toUpperCase() || 
                                      (item.product_id || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase()) ||
                                      (item.product_name || '').toUpperCase().includes((q.quad_type || q.type || '').toUpperCase())
                                    )?.time_slot) || 
                                    (order.quad_reservations?.[0]?.time_slot);
                                 return timeSlot ? (
                                    <div className="mt-1">
                                       <span className="inline-flex items-center gap-1 text-emerald-950 font-black uppercase text-[10px] bg-sun/30 border border-sun/60 px-2 py-0.5 rounded shadow-sm">
                                          🕒 HORÁRIO: {timeSlot}
                                       </span>
                                    </div>
                                 ) : null;
                              })()}
                              {item.is_redeemed && <span className="block text-[8px] font-bold text-green-600 uppercase mt-0.5">Utilizado</span>}
                            </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
            </div>
          </div>

          {/* Footer Area with Buttons */}
          <div className="voucher-buttons p-8 pt-0 flex flex-col gap-3">
              <Button 
                onClick={handleSaveImage}
                disabled={generatingImg}
                className="w-full h-14 rounded-2xl bg-sun hover:bg-sun/90 text-emerald-950 font-black shadow-lg flex gap-2"
              >
                {generatingImg ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                BAIXAR VOUCHER (IMAGEM)
              </Button>
              <div className="flex gap-3">
                 <Button 
                   onClick={() => window.print()}
                   variant="outline"
                   className="flex-1 h-12 rounded-2xl font-bold flex gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all"
                 >
                   <Download className="w-4 h-4" /> IMPRIMIR
                 </Button>
                 <Button 
                   variant="ghost" 
                   onClick={() => {
                      if (navigator.share) {
                         navigator.share({
                            title: 'Meu Voucher Balneário Lessa',
                            url: window.location.href
                         });
                      }
                   }}
                   className="flex-1 h-12 rounded-2xl font-bold flex gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                 >
                   <Share2 className="w-4 h-4" /> COMPARTILHAR
                 </Button>
              </div>
          </div>
        </div>

        <div className="text-center mt-8 space-y-4">
           <button onClick={() => navigate(-1)} className="w-full text-xs font-bold text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 uppercase tracking-widest group cursor-pointer">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Voltar
           </button>
        </div>

      </div>
    </div>
  );
}
