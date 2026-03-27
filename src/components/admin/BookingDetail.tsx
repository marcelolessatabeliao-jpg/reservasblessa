import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/booking-types';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
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
}

export function BookingDetail({ booking }: BookingDetailProps) {
  const { toast } = useToast();
  const children = Array.isArray(booking.children) ? booking.children : [];
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
    <div className="grid gap-4 p-5 bg-muted/30 rounded-3xl border border-muted-foreground/10">
      <div className="flex justify-between items-center border-b border-muted-foreground/5 pb-3">
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">
          Reserva id: {booking.id.slice(0, 8)}
        </p>
        <p className="text-[10px] font-medium text-muted-foreground italic">
          {booking.created_at ? (() => {
            try {
              return format(new Date(booking.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
            } catch (e) {
              return 'Data Inválida';
            }
          })() : ''}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <p className="font-display font-black text-primary uppercase text-xs tracking-tighter flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-sun rounded-full" /> Itens Contratados
          </p>
          
          <div className="grid gap-2">
            {items.length > 0 ? (
              items.map((item, i) => (
                <div key={i} className={cn(
                  "flex items-center justify-between border-2 p-3 rounded-2xl shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2",
                  item.is_redeemed 
                    ? "bg-green-50/50 border-green-100 opacity-80" 
                    : "bg-white border-primary/5 hover:border-primary/20"
                )}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                       <span className={cn("font-bold text-sm", item.is_redeemed ? "text-green-700 line-through" : "text-foreground")}>
                          {item.quantity}x {item.product_id}
                       </span>
                       {item.is_redeemed && (
                         <Badge variant="default" className="bg-green-600 text-[8px] h-4 px-1.5 font-black uppercase">UTILIZADO</Badge>
                       )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                       {item.is_redeemed ? (
                         <>
                           <Clock className="w-3 h-3" />
                           {item.redeemed_at ? format(new Date(item.redeemed_at), "dd/MM HH:mm") : "Confirmado"}
                         </>
                       ) : "Aguardando utilização"}
                    </span>
                  </div>
                  
                  <Button
                    size="sm"
                    variant={item.is_redeemed ? "default" : "outline"}
                    className={cn(
                      "rounded-xl font-black text-[10px] uppercase h-9 shadow-none",
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
               <p className="text-xs text-muted-foreground italic pl-3">Nenhum item detalhado encontrado.</p>
            )}
          </div>
        </div>

        {/* Legacy / Simple Data display if order_items are empty but other props exist */}
        {items.length === 0 && (
          <div className="space-y-2 opacity-80">
             <p className="text-xs font-bold">{booking.adults} Adultos</p>
             {children.length > 0 && <p className="text-xs font-bold">{children.length} Crianças</p>}
          </div>
        )}

        <div className="pt-3 border-t border-muted-foreground/10 flex justify-between items-center">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor Total</span>
            <span className="text-lg font-black text-primary">{formatCurrency(booking.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
