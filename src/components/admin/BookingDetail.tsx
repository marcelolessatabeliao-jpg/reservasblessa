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
    <div className="space-y-4">
      {/* ROW 1: Info + Entradas + Badges lado a lado */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            <span className="text-[9px] font-bold uppercase text-emerald-600/50 tracking-wider">ID</span>
            <span className="font-black text-emerald-950 text-xs">#{booking.id.slice(0, 10)}</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
            <span className="text-[9px] font-bold uppercase text-emerald-600/50 tracking-wider">Data</span>
            <span className="font-bold text-emerald-800 text-xs">
              {booking.created_at ? format(new Date(booking.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-100">
            <span className="font-black text-emerald-950 text-sm">{booking.adults}</span>
            <span className="text-[9px] font-bold uppercase text-emerald-600/50">adultos</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-100">
            <span className="font-black text-emerald-950 text-sm">{children.length}</span>
            <span className="text-[9px] font-bold uppercase text-emerald-600/50">crianças</span>
          </div>
          {booking.is_associado && <Badge className="bg-amber-400 text-amber-950 border-none text-[8px] font-black uppercase px-2 h-5 rounded-full">SÓCIO</Badge>}
          {booking.has_donation && <Badge className="bg-emerald-500 text-white border-none text-[8px] font-black uppercase px-2 h-5 rounded-full">DOAÇÃO</Badge>}
          <div className="ml-auto flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded-xl">
            <span className="text-[9px] font-bold uppercase tracking-wider">Total</span>
            <span className="font-black text-lg">{formatCurrency(booking.total_amount)}</span>
          </div>
      </div>

      {/* ROW 2: Estruturas (quiosques, quads, adicionais) lado a lado */}
      {(kiosks.length > 0 || quads.length > 0 || additionals.length > 0) && (
        <div className="flex flex-wrap gap-2">
           {kiosks.map((k: any, i: number) => (
             <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-emerald-100 text-xs">
                <span className="font-bold text-emerald-900">Quiosque {k.kiosk_id || k.id || '?'}</span>
                <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600 h-4 px-1.5">DIA</Badge>
             </div>
           ))}
           {quads.map((q: any, i: number) => (
             <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-blue-100 text-xs">
                <span className="font-bold text-blue-900">Quad {q.time_slot}</span>
                <Badge variant="outline" className="text-[8px] border-blue-200 text-blue-600 h-4 px-1.5">{q.quantity}x</Badge>
             </div>
           ))}
           {additionals.map((a: any, i: number) => (
             <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-amber-100 text-xs">
                <span className="font-bold text-amber-900">{a.name || a.id}</span>
             </div>
           ))}
        </div>
      )}

      {/* ROW 3: Produtos/Combo em GRID de 2 ou 3 colunas */}
      {items.length > 0 && (
        <div className="space-y-2">
           <h4 className="font-black text-emerald-600 uppercase text-[9px] tracking-widest flex items-center gap-1.5">
             <span className="w-1 h-1 bg-emerald-500 rounded-full" /> Checkout de Produtos
           </h4>
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
             {items.map((item, i) => (
               <div key={i} className={cn(
                 "flex items-center justify-between border p-2.5 rounded-xl transition-all text-xs",
                 item.is_redeemed 
                   ? "bg-green-50/50 border-green-100 opacity-70" 
                   : "bg-white border-emerald-100/50 hover:border-emerald-200"
               )}>
                 <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className={cn("font-bold text-xs truncate", item.is_redeemed ? "text-green-700 line-through" : "text-emerald-950")}>
                       {item.quantity}x {item.product_id}
                    </span>
                    <span className="text-[8px] text-emerald-800/30 font-bold uppercase tracking-wider flex items-center gap-1">
                       {item.is_redeemed ? (
                         <><CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> Usado</>
                       ) : "Aguardando"}
                    </span>
                 </div>
                 <Button
                   size="sm"
                   variant={item.is_redeemed ? "default" : "outline"}
                   className={cn(
                     "rounded-lg font-black text-[8px] uppercase h-7 px-2.5 shrink-0",
                     item.is_redeemed 
                       ? "bg-green-100 hover:bg-green-200 text-green-700 border-none" 
                       : "border hover:bg-emerald-600 hover:text-white"
                   )}
                   onClick={(e) => {
                     e.stopPropagation();
                     handleToggleItemStatus(item.id, item.is_redeemed, item.product_id);
                   }}
                 >
                   {item.is_redeemed ? "ESTORNAR" : "MARCAR USO"}
                 </Button>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}
