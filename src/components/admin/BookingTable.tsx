import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, UserCheck, Phone, Hash, MessageCircle, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';
import { BookingDetail } from './BookingDetail';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { formatPhone } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface Booking {
  id: string;
  name: string;
  phone: string | null;
  confirmation_code: string | null;
  visit_date: string;
  adults: number;
  children: any;
  kiosks?: any;
  quads?: any;
  additionals?: any;
  has_donation?: boolean | null;
  is_associado?: boolean | null;
  total_amount: number;
  status: string;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
  is_order?: boolean;
}

interface BookingTableProps {
  bookings: Booking[];
  onStatusChange: (bookingId: string, status: string, isOrder?: boolean) => void;
  onAddNote: (bookingId: string, notes: string, isOrder?: boolean) => void;
  onReschedule: (bookingId: string, newDate: string, isOrder?: boolean) => void;
  onDelete: (bookingId: string, isOrder?: boolean) => void;
  updatingId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  waiting_local: { label: 'Via WhatsApp', variant: 'outline', icon: Clock },
  paid: { label: 'Pago', variant: 'secondary', icon: CheckCircle },
  'checked-in': { label: 'Check-in ✓', variant: 'default', icon: UserCheck },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
};

export function BookingTable({ bookings, onStatusChange, onAddNote, onReschedule, onDelete, updatingId }: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma reserva encontrada
      </div>
    );
  }

  const handleSaveNote = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    onAddNote(bookingId, noteText, booking?.is_order);
    setEditingNoteId(null);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(newSet => new Set());
    } else {
      setSelectedIds(new Set(bookings.map(b => b.id)));
    }
  };

  const handleBulkAction = async (action: 'confirm' | 'cancel' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'delete' && !confirm(`Atenção: Você irá apagar ${ids.length} reservas. Continuar?`)) return;
    
    for (const id of ids) {
       const b = bookings.find(x => x.id === id);
       if (!b) continue;
       if (action === 'confirm') onStatusChange(b.id, 'paid', b.is_order);
       if (action === 'cancel') onStatusChange(b.id, 'cancelled', b.is_order);
       if (action === 'delete') onDelete(b.id, b.is_order);
    }
    
    // Clear selection after triggering the actions (state will update gradually via Admin.tsx)
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-3 relative pb-20">
      {/* Selecionar Todos Superior */}
      <div className="flex items-center gap-3 px-2">
        <input 
          type="checkbox" 
          checked={selectedIds.size === bookings.length && bookings.length > 0} 
          onChange={toggleSelectAll} 
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
        />
        <span className="text-xs font-bold text-muted-foreground uppercase">Selecionar Todos ({selectedIds.size})</span>
      </div>

      {bookings.map((booking) => {
        const expanded = expandedId === booking.id;
        const isSelected = selectedIds.has(booking.id);
        const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;
        const childrenCount = Array.isArray(booking.children) ? booking.children.length : (typeof booking.children === 'number' ? booking.children : 0);
        const totalPeople = (booking.adults || 0) + childrenCount;

        return (
          <div key={booking.id} className={cn("border rounded-[1.5rem] bg-card overflow-hidden shadow-sm hover:shadow-md transition-all", isSelected ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border")}>
            {/* Row */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expanded ? null : booking.id)}
            >
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={() => toggleSelect(booking.id)}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mb-1"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <a 
                    href={`https://wa.me/55${booking.phone?.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-black text-primary hover:underline flex items-center gap-1.5 truncate uppercase tracking-tight text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {booking.name}
                    <MessageCircle className="w-3.5 h-3.5 text-whatsapp" />
                  </a>
                  {booking.confirmation_code && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0 font-bold">
                      <Hash className="w-2.5 h-2.5" />
                      {booking.confirmation_code}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
                  <span className="font-black text-foreground uppercase">
                    {booking.visit_date ? format(new Date(booking.visit_date + 'T12:00:00'), "dd/MM (EEE)", { locale: ptBR }) : 'Data pendente'}
                  </span>
                  <span>•</span>
                  <span>{totalPeople} pessoa(s)</span>
                  
                  {booking.kiosks?.some((k: any) => k.quantity > 0) && (
                    <>
                      <span>•</span>
                      <span className="text-secondary font-black flex items-center gap-1 uppercase text-[9px]">
                        ⛺ {booking.kiosks.reduce((acc: number, k: any) => acc + k.quantity, 0)} Quiosque(s)
                      </span>
                    </>
                  )}

                  {booking.quads?.some((q: any) => q.quantity > 0) && (
                    <>
                      <span>•</span>
                      <span className="text-sun-dark font-black flex items-center gap-1 uppercase text-[9px]">
                        🚜 {booking.quads.reduce((acc: number, q: any) => acc + q.quantity, 0)} Quad(s)
                      </span>
                    </>
                  )}

                  {booking.additionals?.some((a: any) => a.quantity > 0) && (
                    <>
                      <span>•</span>
                      <span className="text-blue-600 font-black flex items-center gap-1 uppercase text-[9px]">
                        ✨ {booking.additionals.reduce((acc: number, a: any) => acc + a.quantity, 0)} Extra(s)
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right flex flex-col items-end">
                  <div className="text-lg font-black text-primary leading-none">
                    {formatCurrency(booking.total_amount)}
                  </div>
                  <Badge variant={config.variant} className="gap-1 mt-1 text-[9px] h-5 px-1.5 font-black uppercase tracking-wider">
                    <StatusIcon className="w-2.5 h-2.5" />
                    <span>{config.label}</span>
                  </Badge>
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
              <div className="px-4 pb-4 space-y-4 pt-2 border-t border-border/50">
                <BookingDetail booking={booking} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notes */}
                  <div className="bg-muted/30 p-3 rounded-2xl space-y-2 border border-border/50">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Informações Adicionais</p>
                    {editingNoteId === booking.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Adicionar observação..."
                          className="text-sm min-h-[60px] rounded-xl bg-white"
                          maxLength={1000}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-lg font-black h-8 px-4" onClick={() => handleSaveNote(booking.id)}>SALVAR</Button>
                          <Button size="sm" variant="ghost" className="rounded-lg font-black h-8 text-xs" onClick={() => setEditingNoteId(null)}>CANCELAR</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors text-left w-full pl-1 italic"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteText(booking.notes || '');
                          setEditingNoteId(booking.id);
                        }}
                      >
                        {booking.notes || 'Clique para adicionar observações...'}
                      </button>
                    )}
                  </div>

                  {/* Proof Attachment Placeholder */}
                  <div className="bg-whatsapp/5 p-3 rounded-2xl space-y-2 border border-whatsapp/10">
                    <p className="text-[10px] font-black text-whatsapp-dark uppercase tracking-widest pl-1">Comprovante de Pagamento</p>
                    <div className="flex flex-col gap-2">
                       <input 
                         type="file" 
                         id={`upload-${booking.id}`} 
                         hidden 
                         accept="image/*,.pdf" 
                         onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                               const ext = file.name.split('.').pop();
                               const path = `proofs/${booking.id}_${Date.now()}.${ext}`;
                               const { data, error } = await supabase.storage.from('vouchers' as any).upload(path, file);
                               if (error) throw error;
                               const link = supabase.storage.from('vouchers' as any).getPublicUrl(path).data.publicUrl;
                               const newNote = (booking.notes || '') + `\n[COMPROVANTE]: ${link}`;
                               onAddNote(booking.id, newNote, booking.is_order);
                               alert('Comprovante enviado!');
                            } catch (err: any) {
                               alert('Erro ao enviar: ' + err.message);
                            }
                         }}
                       />
                       <Button 
                         size="sm" 
                         variant="ghost" 
                         className="bg-white/50 hover:bg-white border-2 border-dashed border-whatsapp/20 h-14 rounded-xl text-whatsapp-dark font-black text-[10px] uppercase flex flex-col leading-tight"
                         onClick={() => document.getElementById(`upload-${booking.id}`)?.click()}
                       >
                          <Plus className="w-4 h-4 mb-1" />
                          Adicionar Comprovante
                          <span className="font-medium opacity-60">(PDF ou Imagem)</span>
                       </Button>
                    </div>
                  </div>
                </div>

                {/* Status actions row consolidated */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === booking.id}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'paid', booking.is_order); }}
                    className={cn("text-[11px] font-black uppercase rounded-xl h-10 px-4 border-2", booking.status === 'confirmed' || booking.status === 'paid' ? "bg-primary text-white" : "")}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> {booking.status === 'confirmed' || booking.status === 'paid' ? "Confirmado" : "Confirmar"}
                  </Button>

                  <Button
                    size="sm"
                    disabled={updatingId === booking.id}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'checked-in', booking.is_order); }}
                    className={cn("text-[11px] font-black uppercase rounded-xl h-10 px-4", booking.status === 'checked-in' ? "bg-whatsapp text-white" : "bg-whatsapp hover:bg-whatsapp/90 text-white")}
                  >
                    <UserCheck className="w-4 h-4 mr-2" /> Check-in
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === booking.id}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'cancelled', booking.is_order); }}
                    className="text-[11px] font-black uppercase rounded-xl h-10 px-4 text-destructive border-destructive/20 hover:bg-destructive/5"
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Cancelar
                  </Button>

                  {/* WhatsApp Sending */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] font-black uppercase rounded-xl h-10 px-4 border-whatsapp/20 text-whatsapp-dark hover:bg-whatsapp/5"
                    onClick={(e) => {
                       e.stopPropagation();
                       const msg = `Olá ${booking.name}, aqui está o seu voucher para o Balneário Lessa ✨\n\nCódigo: *${booking.confirmation_code}*\nVeja seu voucher aqui: https://reservas.balneariolessa.com.br/voucher/${booking.confirmation_code}\n\nApresente este código na bilheteria.`;
                       window.open(`https://wa.me/55${booking.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-2 text-whatsapp" /> Enviar Voucher
                  </Button>

                  {/* Reschedule */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] font-black uppercase rounded-xl h-10 px-4"
                    onClick={(e) => {
                       e.stopPropagation();
                       const newDate = prompt("Digite a nova data (AAAA-MM-DD):", booking.visit_date);
                       if (newDate && newDate !== booking.visit_date) {
                          onReschedule(booking.id, newDate, booking.is_order);
                       }
                    }}
                  >
                    <Clock className="w-4 h-4 mr-2" /> Reagendar
                  </Button>

                  <Button
                    size="sm"
                    disabled={updatingId === booking.id}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (confirm('⚠️ ATENÇÃO: Deseja EXCLUIR permanentemente este registro? Esta ação não pode ser desfeita.')) {
                        onDelete(booking.id, booking.is_order);
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase rounded-xl h-10 px-4 ml-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border-2 border-primary/20 p-3 z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5">
           <span className="font-black text-primary text-sm whitespace-nowrap px-2">
              {selectedIds.size} selecionado(s)
           </span>
           <div className="w-px h-8 bg-border"></div>
           <Button size="sm" variant="outline" className="h-10 border-green-600/30 text-green-700 hover:bg-green-50" onClick={() => handleBulkAction('confirm')}>
             <CheckCircle className="w-4 h-4 mr-2" /> Confirmar
           </Button>
           <Button size="sm" variant="outline" className="h-10 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => handleBulkAction('cancel')}>
             <XCircle className="w-4 h-4 mr-2" /> Cancelar
           </Button>
           <Button size="sm" className="h-10 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleBulkAction('delete')}>
             <Trash2 className="w-4 h-4 mr-2" /> Excluir
           </Button>
        </div>
      )}
    </div>
  );
}
