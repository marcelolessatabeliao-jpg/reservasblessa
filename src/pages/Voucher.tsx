import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, MapPin, Calendar, Users, Phone, ArrowLeft, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/booking-types';

export default function Voucher() {
  const { code } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVoucher() {
      if (!code) return;
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .eq('confirmation_code', code.toUpperCase())
        .single();
      
      if (data) setOrder(data);
      setLoading(true);
      
      // Verification
      setLoading(false);
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

  const visitDate = order.visit_date ? new Date(order.visit_date) : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans flex items-center justify-center">
      <div className="max-w-md w-full relative">
        
        {/* Ticket Perforation Effect Simulation (Top) */}
        <div className="absolute -top-3 left-0 right-0 flex justify-around px-4">
           {[...Array(12)].map((_, i) => <div key={i} className="w-4 h-4 bg-[#f8fafc] rounded-full" />)}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-muted-foreground/10">
          
          {/* Header */}
          <div className="bg-primary p-8 text-center text-white relative">
             <div className="absolute top-4 right-4 bg-sun text-primary-dark text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg">Entrada Confirmada</div>
             <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">Balneário Lessa</h1>
             <p className="text-primary-foreground/60 text-xs font-bold uppercase tracking-widest">Seu Voucher Digital</p>
          </div>

          <div className="p-8 space-y-8">
            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center space-y-4">
               <div className="p-4 bg-white border-4 border-primary/5 rounded-[2rem] shadow-inner mb-2">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${order.confirmation_code}`} 
                    alt="QR Code" 
                    className="w-40 h-40"
                  />
               </div>
               <div className="text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">CÓDIGO DE ACESSO</p>
                  <p className="text-3xl font-mono font-black text-primary tracking-widest">{order.confirmation_code}</p>
               </div>
            </div>

            {/* Visit Details */}
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-muted/30 p-4 rounded-2xl border border-muted-foreground/5">
                  <Calendar className="w-4 h-4 text-sun mb-2" />
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Data da Visita</p>
                  <p className="text-sm font-bold">{visitDate ? format(visitDate, "dd 'de' MMMM", { locale: ptBR }) : '—'}</p>
               </div>
               <div className="bg-muted/30 p-4 rounded-2xl border border-muted-foreground/5">
                  <Users className="w-4 h-4 text-sun mb-2" />
                  <p className="text-[9px] font-black text-muted-foreground uppercase">Titular</p>
                  <p className="text-sm font-bold truncate">{order.customer_name?.split(' ')[0]}</p>
               </div>
            </div>

            {/* Items Included */}
            <div className="space-y-4">
               <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-sun/20 to-transparent" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2">Itens Inclusos</span>
                  <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-sun/20 to-transparent" />
               </div>
               
               <div className="space-y-3">
                  {order.order_items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <div className={item.is_redeemed ? "bg-green-100 p-1.5 rounded-full" : "bg-primary/5 p-1.5 rounded-full"}>
                             <CheckCircle2 className={item.is_redeemed ? "w-3.5 h-3.5 text-green-600" : "w-3.5 h-3.5 text-primary/30"} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${item.is_redeemed ? "line-through opacity-50" : "text-foreground"}`}>
                               {item.quantity}x {item.product_id}
                            </p>
                            {item.is_redeemed && <span className="text-[8px] font-bold text-green-600 uppercase">Utilizado</span>}
                          </div>
                       </div>
                       <span className="text-xs font-black text-muted-foreground">#{(i+1).toString().padStart(2, '0')}</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Important Notes */}
            <div className="bg-sun/5 rounded-2xl p-5 border border-sun/20 space-y-2">
               <div className="flex items-center gap-2 text-primary">
                  <MapPin className="w-4 h-4" />
                  <p className="text-xs font-black uppercase">Como chegar</p>
               </div>
               <p className="text-[10px] text-primary/80 leading-relaxed font-medium">
                  Balneário Lessa - Balneário Camboriú, SC<br />
                  Apresente este QR Code na entrada para validação.
               </p>
            </div>
          </div>

          {/* Footer Area with Buttons */}
          <div className="p-8 pt-0 flex flex-col gap-3">
              <Button 
                onClick={() => window.print()}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary-dark text-white font-black shadow-lg flex gap-2"
              >
                <Download className="w-4 h-4" /> SALVAR / IMPRIMIR
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
                className="w-full h-12 rounded-2xl font-bold flex gap-2"
              >
                <Share2 className="w-4 h-4" /> COMPARTILHAR
              </Button>
          </div>
        </div>

        <div className="text-center mt-8 space-y-4">
           <Link to="/" className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 uppercase tracking-widest group">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Voltar para o Site
           </Link>
        </div>

      </div>
    </div>
  );
}
