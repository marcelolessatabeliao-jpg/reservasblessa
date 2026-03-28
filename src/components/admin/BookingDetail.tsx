import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/booking-types';
import { CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BookingDetailProps {
  booking: {
    id: string;
    adults: number;
    children?: any;
    kiosks?: any;
    quads?: any;
    additionals?: any;
    has_donation?: boolean | null;
    is_associado?: boolean | null;
    total_amount: number;
    created_at: string;
    order_items?: any[];
  };
  onRemoveItem?: (orderId: string, itemId: string, productId: string) => void;
}

export function BookingDetail({ booking, onRemoveItem }: BookingDetailProps) {
  const { toast } = useToast();
  const children = Array.isArray(booking.children) ? booking.children : [];
  const kiosks = Array.isArray(booking.kiosks) ? booking.kiosks : [];
  const quads = Array.isArray(booking.quads) ? booking.quads : [];
  const additionals = Array.isArray(booking.additionals) ? booking.additionals : (booking.additionals ? Object.entries(booking.additionals).map(([k, v]: any) => ({ id: k, ...v })) : []);
  const items = booking.order_items || [];

  const handleToggleItemStatus = async (itemId: string, currentStatus: boolean | null, productName: string) => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ 
          is_redeemed: !currentStatus, 
          redeemed_at: !currentStatus ? new Date().toISOString() : null 
        })
        .eq('id', itemId);
      
      if (error) throw error;
      toast({ 
        title: !currentStatus ? "Item Utilizado" : "Item Estornado",
        description: `${productName} foi marcado como ${!currentStatus ? 'utilizado' : 'não utilizado'}.`,
      });
    } catch (err) {
      console.error("Error updating item status:", err);
      toast({ title: "Erro ao atualizar item", variant: "destructive" });
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 p-6 bg-emerald-50/20 rounded-3xl border border-emerald-100/50 shadow-inner">
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
          <div className="flex flex-col">
            <p className="text-[10px] font-black uppercase text-emerald-800/40 tracking-widest leading-none mb-1">Identificação</p>
            <p className="text-sm font-bold text-emerald-950">#{booking.id.slice(0, 12)}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black uppercase text-emerald-800/40 tracking-widest leading-none mb-1">Data da Reserva</p>
             <p className="text-xs font-bold text-emerald-800">
               {booking.created_at ? format(new Date(booking.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '-'}
             </p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-display font-black text-emerald-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Resumo de Entradas
          </h4>
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm flex gap-6">
             <div className="flex flex-col">
                <span className="text-2xl font-black text-emerald-950">{booking.adults}</span>
                <span className="text-[9px] font-bold uppercase text-emerald-800/50">Adultos</span>
             </div>
             <div className="flex flex-col">
                <span className="text-2xl font-black text-emerald-950">{children.length}</span>
                <span className="text-[9px] font-bold uppercase text-emerald-800/50">Crianças</span>
             </div>
             {(booking.is_associado || booking.has_donation) && (
               <div className="ml-auto flex gap-2 self-center">
                  {booking.is_associado && <Badge className="bg-sun text-white border-0 font-bold text-[8px]">ASSOCIADO</Badge>}
                  {booking.has_donation && <Badge className="bg-emerald-500 text-white border-0 font-bold text-[8px]">DOAÇÃO OK</Badge>}
               </div>
             )}
          </div>
        </div>

        {(kiosks.length > 0 || quads.length > 0 || additionals.length > 0) && (
          <div className="space-y-4">
            <h4 className="font-display font-black text-emerald-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Estruturas e Lazer
            </h4>
            <div className="grid grid-cols-1 gap-2">
               {kiosks.map((k: any, i: number) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-900">Quiosque {k.kiosk_id || k.id || '?'}</span>
                    <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600">Aluguel Dia</Badge>
                 </div>
               ))}
               {quads.map((q: any, i: number) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-100">
                    <span className="text-xs font-bold text-blue-900">Quadriciclo {q.time_slot}</span>
                    <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">{q.quantity} UN</Badge>
                 </div>
               ))}
               {additionals.map((a: any, i: number) => (
                 <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-xs font-bold text-amber-900">{a.name || a.id}</span>
                    <span className="text-[10px] font-bold text-amber-600">INCLUÍDO</span>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
           <h4 className="font-display font-black text-emerald-600 uppercase text-[10px] tracking-widest flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Checkout de Produtos/Combo
           </h4>
           
           <div className="grid gap-2">
             {items.length > 0 ? (
               items.map((item, i) => (
                 <div key={i} className={cn(
                   "flex items-center justify-between border-2 p-3 rounded-2xl shadow-sm transition-all animate-in fade-in slide-in-from-right-4",
                   item.is_redeemed 
                     ? "bg-green-50/50 border-green-100 opacity-80" 
                     : "bg-white border-primary/5 hover:border-primary/20"
                 )}>
                   <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col">
                         <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-sm", item.is_redeemed ? "text-green-700 line-through" : "text-foreground")}>
                               {item.quantity}x {item.product_id}
                            </span>
                         </div>
                         <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                            {item.is_redeemed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {item.redeemed_at ? format(new Date(item.redeemed_at), "dd/MM HH:mm") : "Confirmado"}
                              </>
                            ) : "Aguardando utilização"}
                         </span>
                      </div>
                   </div>
                   
                   <Button
                     size="sm"
                     variant={item.is_redeemed ? "default" : "outline"}
                     className={cn(
                       "rounded-xl font-black text-[9px] uppercase h-8 px-4",
                       item.is_redeemed 
                         ? "bg-green-100 hover:bg-green-200 text-green-700 border-none px-3" 
                         : "border-2 hover:bg-primary hover:text-white px-4"
                     )}
                     onClick={(e) => {
                       e.stopPropagation();
                       handleToggleItemStatus(item.id, item.is_redeemed, item.product_id);
                     }}
                   >
                     {item.is_redeemed ? "ESTORNAR" : "MARCAR USO"}
                   </Button>
                 </div>
               ))
             ) : (
                <div className="p-8 border-2 border-dashed border-emerald-100 rounded-2xl flex flex-col items-center justify-center text-center">
                   <p className="text-[10px] font-bold text-emerald-800/30 uppercase tracking-widest">Nenhum item adicional</p>
                </div>
             )}
           </div>
        </div>

        <div className="pt-6 border-t border-emerald-100 flex justify-between items-end">
            <div className="flex flex-col">
               <span className="text-[10px] font-black text-emerald-800/40 uppercase tracking-widest mb-1">Investimento Total</span>
               <span className="text-3xl font-black text-emerald-600 leading-none">{formatCurrency(booking.total_amount)}</span>
            </div>
            {booking.total_amount > 0 && <Badge className="bg-emerald-600 text-white font-bold h-7 px-4 rounded-xl">LIQUIDADO</Badge>}
        </div>
      </div>
    </div>
  );
}
