import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Trash2, 
  Loader2,
  TrendingUp,
  ShoppingBag,
  Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from "@/lib/utils";
import { formatCurrency } from '@/lib/booking-types';

interface AdminVendasTabProps {
  orders: any[];
  vendasStatusFilter: string;
  setVendasStatusFilter: (status: string) => void;
  updatingId: string | null;
  markOrderAsPaid: (orderId: string) => Promise<any>;
  requestDelete: (item: any, type: string) => void;
  fetchData: () => void;
  toast: any;
  onConvertToCredit?: (order: any) => void;
}

export function AdminVendasTab({
  orders,
  vendasStatusFilter,
  setVendasStatusFilter,
  updatingId,
  markOrderAsPaid,
  requestDelete,
  fetchData,
  toast,
  onConvertToCredit
}: AdminVendasTabProps) {
  
  const filteredOrders = (orders || []).filter(o => {
    const status = (o.status || '').toLowerCase();
    
    if (vendasStatusFilter === 'all') return true;
    
    if (vendasStatusFilter === 'pending') {
      return status === 'pending' || 
             status === 'pendente' ||
             status === 'awaiting_payment' || 
             status === 'waiting_local' || 
             status === 'waiting_confirmation' ||
             status.includes('waiting') ||
             status.includes('aguardando');
    }
    
    if (vendasStatusFilter === 'paid') {
      return status === 'paid' || status === 'confirmed' || status === 'pago';
    }
    
    if (vendasStatusFilter === 'cancelled') {
      return status === 'cancelled' || status === 'canceled' || status === 'cancelado';
    }
    
    return status === vendasStatusFilter.toLowerCase();
  });

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border-2 border-emerald-100/50 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
             <h2 className="text-3xl font-black text-emerald-950 tracking-tight">Histórico de Vendas</h2>
             <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mt-1">Gestão de pedidos e pagamentos</p>
          </div>
          <div className="flex items-center gap-3">
              <Select value={vendasStatusFilter} onValueChange={setVendasStatusFilter}>
                <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-white border-2 border-emerald-100 shadow-sm font-bold text-emerald-900">
                  <SelectValue placeholder="Filtrar Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-2 border-emerald-100 shadow-2xl">
                  <SelectItem value="all" className="text-xs font-bold uppercase">Todos</SelectItem>
                  <SelectItem value="paid" className="text-xs font-bold uppercase text-whatsapp">Pagos / Confirmados</SelectItem>
                  <SelectItem value="pending" className="text-xs font-bold uppercase text-amber-600">Pendentes / Aguardando</SelectItem>
                  <SelectItem value="cancelled" className="text-xs font-bold uppercase text-red-500">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              <Badge className="bg-emerald-100 text-emerald-900 border-0 font-bold h-12 px-6 rounded-2xl flex items-center shadow-sm">Total: {filteredOrders.length}</Badge>
          </div>
       </div>
       <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
             <thead className="bg-emerald-50/50 text-[10px] font-black uppercase text-emerald-800 tracking-widest border-b-2 border-emerald-100">
                <tr>
                   <th className="px-6 py-5">ID / Data</th>
                   <th className="px-6 py-5">Cliente</th>
                   <th className="px-6 py-5">Total</th>
                   <th className="px-6 py-5">Status</th>
                   <th className="px-6 py-5 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-emerald-50">
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">Nenhum pedido encontrado.</td></tr>
                ) : filteredOrders.map(order => (
                   <tr key={order.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-6 py-5">
                         <div className="flex flex-col">
                            <span className="font-mono text-[10px] text-emerald-800/50">#{order.id.slice(0,8)}</span>
                            <span className="text-sm font-bold text-slate-900">{format(parseISO(order.created_at), 'dd/MM/yyyy')}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-900">
                         {order.customer_name || 'Cliente Geral'}
                      </td>
                      <td className="px-6 py-5 font-black text-emerald-600 text-lg">
                         {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-5">
                         <Badge className={cn(
                           "rounded-lg font-black text-[10px] px-3 py-1 shadow-sm",
                           (order.status === 'paid' || order.status === 'confirmed' || order.status === 'pago') ? "bg-whatsapp text-white" : 
                           (order.status === 'awaiting_payment' || order.status === 'pending' || order.status === 'pendente' || order.status === 'waiting_local' || order.status === 'waiting_confirmation' || order.status === 'waiting_local_confirmation' ? "bg-amber-400 text-amber-950" : "bg-red-500 text-white")
                         )}>
                            {order.status === 'paid' ? 'PAGO' : 
                             order.status === 'confirmed' ? 'CONFIRMADO' :
                             order.status === 'awaiting_payment' ? 'AGUARDANDO PGTO' : 
                             order.status === 'waiting_local' ? 'PAGTO LOCAL' :
                             order.status === 'waiting_confirmation' ? 'AGUARDANDO CONF.' :
                             order.status === 'waiting_local_confirmation' ? 'CONF. LOCAL' :
                             order.status.toUpperCase()}
                         </Badge>
                      </td>
                      <td className="px-6 py-5 text-right">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {order.status !== 'paid' && order.status !== 'confirmed' && (
                              <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-black shadow-md border-2 border-emerald-700" onClick={() => { markOrderAsPaid(order.id).then(() => { toast({ title: "✓ Efetivado!" }); fetchData(); }).catch(e => toast({ title: "Erro", description: e.message, variant: "destructive" })); }}>
                                {updatingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Efetivar'}
                              </Button>
                            )}
                             {onConvertToCredit && order.status !== 'cancelled' && order.status !== 'cancelado' && (
                               <Button 
                                 size="icon" variant="ghost" 
                                 className="h-9 w-9 text-purple-600 hover:bg-purple-50 rounded-xl" 
                                 onClick={() => onConvertToCredit(order)}
                                 title="Converter em Crédito"
                               >
                                 <Wallet className="w-4 h-4" />
                               </Button>
                             )}
                             <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => requestDelete(order, 'order')}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}
