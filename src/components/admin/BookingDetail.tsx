import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/booking-types';
import { CheckCircle2, Circle, Trash2, Eye, X, FileText, ExternalLink } from 'lucide-react';
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
    receipt_url?: string | null;
    name?: string;
    visit_date?: string;
  };
  onRemoveItem?: (orderId: string, itemId: string, productId: string) => void;
  onRemoveReceipt?: (bookingId: string) => void;
  onRefresh?: () => void;
}

export function BookingDetail({ booking, onRemoveItem, onRemoveReceipt, onRefresh }: BookingDetailProps) {
  const { toast } = useToast();
  const children = Array.isArray(booking.children) ? booking.children : [];
  const kiosks = Array.isArray(booking.kiosks) ? booking.kiosks : [];
  const quads = Array.isArray(booking.quads) ? booking.quads : [];
  const additionals = Array.isArray(booking.additionals) ? booking.additionals : (booking.additionals ? Object.entries(booking.additionals).map(([k, v]: any) => ({ id: k, ...v })) : []);
  
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [showResumo, setShowResumo] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Fetch items from DB fresh every time the booking changes, so state persists across navigations
  useEffect(() => {
    if (booking.order_items && booking.order_items.length > 0) {
      setLocalItems(booking.order_items);
    } else if (booking.id) {
      // Fetch fresh from DB
      setLoadingItems(true);
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', booking.id)
        .then(({ data, error }) => {
          if (!error && data) setLocalItems(data);
          setLoadingItems(false);
        });
    }
  }, [booking.id]);

  const handleToggleItemStatus = async (itemId: string, currentStatus: boolean | null, productName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic update
    setLocalItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, is_redeemed: !currentStatus } : item
    ));

    try {
      const { error } = await supabase
        .from('order_items')
        .update({
          is_redeemed: !currentStatus,
          redeemed_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      if (error) {
        setLocalItems(prev => prev.map(item =>
          item.id === itemId ? { ...item, is_redeemed: currentStatus } : item
        ));
        throw error;
      }

      toast({
        title: !currentStatus ? '✅ Item Utilizado' : '↩️ Item Estornado',
        description: `${productName} foi marcado como ${!currentStatus ? 'utilizado' : 'não utilizado'}.`,
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating item status:', err);
      toast({ title: 'Erro ao atualizar item', variant: 'destructive' });
    }
  };

  const handleRemoveReceipt = async () => {
    if (!confirm('Deseja remover o comprovante? O status de pagamento continuará, mas sem documento anexado.')) return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ receipt_url: null })
        .eq('id', booking.id);
      if (error) throw error;
      onRemoveReceipt?.(booking.id);
      toast({ title: '🗑️ Comprovante removido' });
    } catch {
      toast({ title: 'Erro ao remover comprovante', variant: 'destructive' });
    }
  };

  const displayId = booking.id.split('-')[0].toUpperCase();
  const childrenCount = children.length;
  const totalPeople = (booking.adults || 0) + childrenCount;

  // Build financial summary
  const kioskTotal = kiosks.reduce((s: number, k: any) => s + (k.price || 75), 0);
  const quadTotal = quads.reduce((s: number, q: any) => s + (q.price || 0), 0);
  const additionalsTotal = additionals.reduce((s: number, a: any) => s + (a.price || 0), 0);
  const itemsTotal = localItems.reduce((s: number, i: any) => s + (i.price || 0), 0);
  const discount = kioskTotal + quadTotal + additionalsTotal + itemsTotal - booking.total_amount;

  return (
    <div className="space-y-4">
      {/* Ver Resumo Completo Modal */}
      {showResumo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowResumo(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-emerald-900 text-white p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Resumo Completo</p>
                <h3 className="text-lg font-black">#{displayId} — {booking.name || 'Reserva'}</h3>
              </div>
              <button onClick={() => setShowResumo(false)} className="p-2 rounded-xl hover:bg-white/10 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* People */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-emerald-900">{booking.adults || 0}</p>
                  <p className="text-[9px] font-black uppercase text-emerald-600 tracking-wider mt-1">Adultos</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-900">{childrenCount}</p>
                  <p className="text-[9px] font-black uppercase text-blue-600 tracking-wider mt-1">Gratuidades</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 text-center border-2 border-slate-200">
                  <p className="text-2xl font-black text-slate-900">{totalPeople}</p>
                  <p className="text-[9px] font-black uppercase text-slate-600 tracking-wider mt-1">Total Pessoas</p>
                </div>
              </div>
              {/* Financial breakdown */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-3">Detalhamento Financeiro</p>
                {kioskTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">🏕️ Quiosques ({kiosks.length}x)</span>
                    <span className="font-black text-emerald-700">{formatCurrency(kioskTotal)}</span>
                  </div>
                )}
                {quadTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">🚴 Quadriciclos ({quads.length}x)</span>
                    <span className="font-black text-blue-700">{formatCurrency(quadTotal)}</span>
                  </div>
                )}
                {additionalsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">➕ Adicionais</span>
                    <span className="font-black text-amber-700">{formatCurrency(additionalsTotal)}</span>
                  </div>
                )}
                {localItems.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">🛒 Produtos/Loja</span>
                    <span className="font-black text-purple-700">{formatCurrency(itemsTotal)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-bold text-red-700">🏷️ Desconto/Ajuste</span>
                    <span className="font-black text-red-600">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-emerald-200 pt-3 mt-3">
                  <span className="font-black text-emerald-900 text-sm uppercase">TOTAL FINAL</span>
                  <span className="font-black text-emerald-700 text-xl">{formatCurrency(booking.total_amount)}</span>
                </div>
              </div>
              {/* Status info */}
              <div className="flex flex-wrap gap-2">
                {booking.is_associado && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Sócio Clube</Badge>}
                {booking.has_donation && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Solidário</Badge>}
                {booking.receipt_url && (
                  <a href={booking.receipt_url} target="_blank" rel="noopener noreferrer">
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Comprovante Anexado
                    </Badge>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROW 1: Info + Entradas + Badges */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 shadow-sm">
          <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">ID</span>
          <span className="font-black text-emerald-950 text-xs">#{displayId}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 shadow-sm">
          <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">Data</span>
          <span className="font-bold text-emerald-950 text-xs">
            {booking.created_at ? format(new Date(booking.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="font-black text-emerald-950 text-sm">{booking.adults || 0}</span>
          <span className="text-[9px] font-black uppercase text-slate-500">Adultos</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="font-black text-emerald-950 text-sm">{childrenCount}</span>
          <span className="text-[9px] font-black uppercase text-slate-500">Gratuidades</span>
        </div>
        {booking.is_associado && <Badge className="bg-amber-100 text-amber-800 border-2 border-amber-200 text-[9px] font-black uppercase px-2 h-6 rounded-full shadow-sm">SÓCIO CLUBE</Badge>}
        {booking.has_donation && <Badge className="bg-emerald-100 text-emerald-800 border-2 border-emerald-200 text-[9px] font-black uppercase px-2 h-6 rounded-full shadow-sm">SOLIDÁRIO</Badge>}

        {/* Receipt button with view/delete */}
        {booking.receipt_url && (
          <div className="flex items-center gap-1 ml-1">
            <a href={booking.receipt_url} target="_blank" rel="noopener noreferrer">
              <button className="flex items-center gap-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-l-xl border border-emerald-700 hover:bg-emerald-700 transition-all shadow-sm">
                <ExternalLink className="w-3 h-3" /> Ver Comprovante
              </button>
            </a>
            <button
              onClick={handleRemoveReceipt}
              className="flex items-center gap-1 bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-r-xl border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm"
              title="Remover comprovante"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowResumo(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border border-slate-200 transition-all shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" /> Ver Resumo Completo
          </button>
          <div className="flex items-center gap-3 bg-[#006020] text-white px-5 py-2 rounded-xl shadow-md border border-[#004d1a]">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100">Total</span>
            <span className="font-black text-lg">{formatCurrency(booking.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* ROW 2: Estruturas */}
      {(kiosks.length > 0 || quads.length > 0 || additionals.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {kiosks.map((k: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-emerald-200 text-xs shadow-sm">
              <span className="font-bold text-emerald-950">Quiosque {k.kiosk_id || k.id || '?'}</span>
              <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 font-bold h-4 px-1.5 bg-emerald-50">DIA</Badge>
            </div>
          ))}
          {quads.map((q: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-blue-200 text-xs shadow-sm">
              <span className="font-bold text-blue-950">Quad {q.time_slot}</span>
              <Badge variant="outline" className="text-[8px] border-blue-300 text-blue-700 font-bold h-4 px-1.5 bg-blue-50">{q.quantity}x</Badge>
            </div>
          ))}
          {additionals.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-amber-200 text-xs shadow-sm">
              <span className="font-bold text-amber-950">{a.name || a.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* ROW 3: Produtos */}
      {localItems.length > 0 && (
        <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
          <h4 className="font-black text-emerald-800 uppercase text-[10px] tracking-widest flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Checkout de Produtos Diários
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {localItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between border-4 p-4 rounded-[1.5rem] transition-all text-xs shadow-md',
                  item.is_redeemed
                    ? 'bg-emerald-100 border-emerald-400 opacity-95'
                    : 'bg-white border-slate-300 hover:border-emerald-500 hover:shadow-xl'
                )}
              >
                <div className="flex flex-col min-w-0 flex-1 mr-3">
                  <span className={cn('font-black text-[13px] truncate transition-colors uppercase', item.is_redeemed ? 'text-emerald-900 line-through' : 'text-slate-950')}>
                    {item.quantity}x {item.product_id || item.product_name || 'Produto'}
                  </span>
                  <span className={cn('text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-1.5', item.is_redeemed ? 'text-emerald-800' : 'text-slate-400')}>
                    {item.is_redeemed ? (<><CheckCircle2 className="w-4 h-4 text-emerald-600 shadow-sm" /> UTILIZADO</>) : (<><Circle className="w-4 h-4 text-slate-300" /> AGUARDANDO</>)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={item.is_redeemed ? 'default' : 'outline'}
                  className={cn(
                    'rounded-xl font-black text-[10px] uppercase h-10 px-4 shrink-0 transition-all border-2',
                    item.is_redeemed
                      ? 'bg-emerald-800 hover:bg-emerald-950 text-white border-emerald-900 shadow-lg'
                      : 'border-emerald-200 text-emerald-900 bg-emerald-50 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-xl'
                  )}
                  onClick={(e) => handleToggleItemStatus(item.id, item.is_redeemed, item.product_id || item.product_name, e)}
                >
                  {item.is_redeemed ? 'ESTORNAR' : 'MARCAR USO'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {loadingItems && (
        <div className="text-center py-4 text-emerald-600 text-xs font-bold animate-pulse">Carregando itens...</div>
      )}
    </div>
  );
}
