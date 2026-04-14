import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarClock, Check, Loader2, X, Clock, Pencil, Trash2 } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { KIOSKS, QUAD_TIMES, QUAD_MODELS_LABELS } from '@/lib/admin-constants';
import { getBookedKioskIds } from '@/lib/booking-service';
import { getQuadDiscount } from '@/lib/booking-types';
import { parseToRODate } from '@/utils/date-utils';
import { cn } from "@/lib/utils";

// --- DELETE CONFIRM DIALOG ---
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteConfirmDialog({ open, onOpenChange, onConfirm, loading }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl border-2 border-slate-300 shadow-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center border-2 border-red-200">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-black text-slate-900">Confirmar Exclusão</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-slate-600 font-bold">
            Deseja realmente remover esta reserva? Esta ação não pode ser desfeita e liberará o horário/espaço para novos clientes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-2 border-slate-200 bg-slate-100 font-black text-slate-700 hover:bg-slate-900 hover:text-white transition-all">Cancelar</AlertDialogCancel>
          <Button onClick={onConfirm} disabled={loading} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black h-10 px-6 shadow-md border-2 border-red-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Sim, Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- RESCHEDULE DIALOG ---
interface RescheduleDialogProps {
  data: { type: 'kiosk' | 'quad', group: any } | null;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  loading?: boolean;
  kioskReservations: any[];
  quadReservations: any[];
  isAllowedDay: (date: Date) => boolean;
}

export function RescheduleDialog({ 
  data, 
  onClose, 
  onConfirm, 
  loading, 
  kioskReservations, 
  quadReservations,
  isAllowedDay
}: RescheduleDialogProps) {
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (data?.group?.reservation_date) {
      setRescheduleDate(parseISO(data.group.reservation_date));
    }
  }, [data]);

  return (
    <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-[2rem] border-4 border-blue-200 shadow-3xl max-w-md bg-white p-0 overflow-hidden">
        <div className="bg-blue-600 p-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Reagendar Reserva</h3>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Selecione a nova data abaixo</p>
            </div>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 rounded-3xl border-2 border-slate-200 p-4 shadow-inner">
            <Calendar
              mode="single"
              selected={rescheduleDate}
              onSelect={setRescheduleDate}
              locale={ptBR}
              className="rounded-2xl"
              toDate={new Date(2030, 11, 31)}
              fromDate={new Date(2024, 0, 1)}
              disabled={(date) => !isAllowedDay(date) || isBefore(date, startOfDay(new Date()))}
              classNames={{
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center mb-2 bg-blue-800 rounded-xl py-3 border-2 border-blue-900 shadow-lg w-full",
                caption_label: "text-sm font-black text-white uppercase tracking-widest",
                nav: "flex items-center justify-between absolute inset-x-0 inset-y-0 px-6 pointer-events-none z-30",
                nav_button: "h-10 w-10 bg-blue-500 text-white border border-blue-400 hover:bg-blue-400 shadow-lg rounded-xl transition-all pointer-events-auto flex items-center justify-center",
                nav_button_previous: "relative left-0",
                nav_button_next: "relative right-0",
                day_selected: "bg-amber-400 text-amber-950 font-black hover:bg-amber-500 shadow-md",
                day_today: "bg-blue-100 text-blue-900 font-bold"
              }}
              components={{
                DayContent: ({ date }) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                  const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                  const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                  const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= 20;
                  const isFull = kiosksFull && quadsFull;
                  return (
                    <div className={cn("relative flex flex-col items-center p-0.5 rounded w-full h-full justify-center", isFull && "bg-red-50/50")}>
                      <span className={cn("text-[11px]", isFull && "text-red-600 font-black")}>{date.getDate()}</span>
                      <div className="flex gap-0.5 mt-0.5">
                        {hasKiosk && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", kiosksFull ? "bg-red-600" : "bg-emerald-600")} />}
                        {hasQuad && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", quadsFull ? "bg-red-600" : "bg-blue-600")} />}
                      </div>
                    </div>
                  );
                }
              }}
            />
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-2xl font-black border-2 border-slate-300 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-800 transition-all"
              onClick={onClose}
            >
              CANCELAR
            </Button>
            <Button 
              className="flex-1 h-12 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-2 border-blue-700"
              onClick={() => rescheduleDate && onConfirm(rescheduleDate)}
              disabled={loading || !rescheduleDate}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRMAR'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- EDIT KIOSK DIALOG ---
export function EditKioskDialog({ group, onClose, onUpdated, updateOrderTotal }: any) {
  const [selectedKiosks, setSelectedKiosks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookedIds, setBookedIds] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchOccupied = async () => {
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

// --- EDIT QUAD DIALOG ---
export function EditQuadDialog({ item, onClose, onUpdated, updateOrderTotal }: any) {
  const [model, setModel] = useState(item.quad_type || 'individual');
  const [time, setTime] = useState(item.time_slot || '09:00');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      const orderId = item.order_id;
      const discount = getQuadDiscount(parseToRODate(item.reservation_date));
      const prices: any = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const unitPrice = prices[model] * (1 - discount);
      await (supabase.from('quad_reservations') as any).update({ 
        quad_type: model, 
        time_slot: time, 
        price: unitPrice * (item.quantity || 1) 
      }).eq('id', item.id);
      
      if (orderId && !String(orderId).startsWith('order-')) {
         const { data: oItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
         const quadItem = oItems?.find(oi => oi.product_id?.toLowerCase().includes('quad') || oi.product_name?.toLowerCase().includes('quad'));
         if (quadItem) {
            const newMeta = { ...(quadItem.metadata || {}), time_slot: time };
            await supabase.from('order_items').update({ 
              unit_price: unitPrice, 
              product_id: `Quadriciclo ${QUAD_MODELS_LABELS[model] || model}`, 
              metadata: newMeta 
            }).eq('id', quadItem.id);
         }
      }
      if (orderId) await updateOrderTotal(orderId);
      toast({ title: 'Sucesso!', description: 'Reserva de Quadriciclo atualizada.' });
      onUpdated();
      onClose();
    } catch(e) { toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-primary uppercase">Mudar Modelo / Horário</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">Modelo</Label>
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
              <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">Horário</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-2xl shadow-xl">
                  {QUAD_TIMES.map(t => (
                    <SelectItem key={t} value={t} className="font-black uppercase text-xs py-3">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>

           <div className="pt-4 flex gap-2">
             <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onClose}>Cancelar</Button>
             <Button className="flex-1 bg-primary rounded-xl font-black" onClick={handleSave} disabled={loading}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
