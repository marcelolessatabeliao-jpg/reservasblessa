import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { getBookedKioskIds } from '@/lib/booking-service';
import { getQuadDiscount } from '@/lib/booking-types';

const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01 (Grande)', price: 100, type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, type: 'Menor' }
];

const QUAD_MODELS_LABELS: Record<string, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança'
};

export function EditKioskDialog({ group, onClose, onUpdated, updateOrderTotal }: any) {
  const [selectedKiosks, setSelectedKiosks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchOccupied = async () => {
      if (!group?.reservation_date) return;
      const ids = await getBookedKioskIds(group.reservation_date);
      const currentIds = group.items.map((i: any) => i.kiosk_id).filter((id: any) => !isNaN(id)).map(Number);
      setBookedIds(ids.filter(id => !currentIds.includes(id)));
      setSelectedKiosks(currentIds);
    };
    fetchOccupied();
  }, [group]);

  const handleSave = async () => {
    if (selectedKiosks.length !== group.items.length) {
      toast({ title: 'Atenção', description: `Selecione exatamente ${group.items.length} quiosque(s).`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const orderId = group.items[0].order_id;
      for (let i = 0; i < group.items.length; i++) {
        const item = group.items[i];
        const newKioskId = selectedKiosks[i];
        const newKiosk = KIOSKS.find(k => k.id === newKioskId);

        await (supabase.from('kiosk_reservations') as any).update({
          kiosk_id: newKioskId,
          kiosk_type: newKiosk?.type === 'Maior' ? 'maior' : 'menor'
        }).eq('id', item.id);

        if (orderId && !String(orderId).startsWith('order-')) {
          const newPrice = newKiosk?.type === 'Maior' ? 100 : 75;
          const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
          const kioskItem = oItems?.find(oi => oi.product_id?.toLowerCase().includes('quiosque') || oi.product_name?.toLowerCase().includes('quiosque'));
          if (kioskItem) {
             await supabase.from('order_items').update({ unit_price: newPrice }).eq('id', kioskItem.id);
          }
        }
      }
      if (orderId) await updateOrderTotal(orderId);
      toast({ title: 'Sucesso!', description: 'Quiosques atualizados.' });
      onUpdated();
      onClose();
    } catch(e) { toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-primary uppercase">Mudar Quiosques</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase">Selecione {group.items.length} unidades para a data {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}:</p>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5].map(id => {
              const kiosk = KIOSKS.find(k => k.id === id);
              const isBooked = bookedIds.includes(id);
              const isSelected = selectedKiosks.includes(id);
              return (
                <button
                  key={id} disabled={isBooked || loading}
                  onClick={() => {
                    if (isSelected) setSelectedKiosks(prev => prev.filter(v => v !== id));
                    else if (selectedKiosks.length < group.items.length) setSelectedKiosks(prev => [...prev, id]);
                  }}
                  className={cn("p-3 rounded-2xl flex flex-col items-center gap-1 transition-all border-2", 
                    isBooked ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" :
                    isSelected ? "bg-emerald-600 border-emerald-700 text-white shadow-lg scale-105" :
                    "bg-white border-slate-100 hover:border-emerald-200 text-slate-700"
                  )}
                >
                  <span className="text-[10px] font-black uppercase">{kiosk?.name.replace('QUIOSQUE - ', 'Q-')}</span>
                  {isBooked && <span className="text-[8px] font-bold">OCUPADO</span>}
                </button>
              );
            })}
          </div>
          <div className="pt-4 flex gap-2">
             <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
             <Button className="flex-1 bg-primary rounded-xl font-black" onClick={handleSave} disabled={loading || selectedKiosks.length !== group.items.length}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditQuadDialog({ item, onClose, onUpdated, updateOrderTotal }: any) {
  const [model, setModel] = useState(item.quad_type || 'individual');
  const [time, setTime] = useState(item.time_slot || '09:00');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const orderId = item.order_id;
      const discount = getQuadDiscount(item.reservation_date);
      const prices: any = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const unitPrice = prices[model] * (1 - discount);
      await (supabase.from('quad_reservations') as any).update({ quad_type: model, time_slot: time, price: unitPrice * (item.quantity || 1) }).eq('id', item.id);
      if (orderId && !String(orderId).startsWith('order-')) {
         const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
         const quadItem = oItems?.find(oi => oi.product_id?.toLowerCase().includes('quad') || oi.product_name?.toLowerCase().includes('quad'));
         if (quadItem) {
            const newMeta = { ...(quadItem.metadata || {}), time_slot: time };
            await supabase.from('order_items').update({ unit_price: unitPrice, product_id: `Quadriciclo ${QUAD_MODELS_LABELS[model]}`, metadata: newMeta }).eq('id', quadItem.id);
         }
      }
      if (orderId) await updateOrderTotal(orderId);
      toast({ title: 'Sucesso!', description: 'Modelo atualizado.' });
      onUpdated();
      onClose();
    } catch(e) { toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white rounded-3xl p-6 shadow-3xl border-4 border-emerald-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-emerald-950 uppercase">Mudar Modelo / Horário</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-2xl shadow-xl">
                  {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="font-black uppercase text-xs py-3">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Horário</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-2xl shadow-xl">
                  {['09:00', '10:30', '14:00', '15:30'].map(t => (
                    <SelectItem key={t} value={t} className="font-black uppercase text-xs py-3">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="pt-4 flex gap-2">
             <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
             <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black" onClick={handleSave} disabled={loading}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
