import React, { useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, 
  UserCheck, Phone, Hash, MessageCircle, Trash2, Plus, 
  Users, DollarSign, Calendar, Upload, FileCheck, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';
import { BookingDetail } from './BookingDetail';
import { Textarea } from '@/components/ui/textarea';
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
  receipt_url?: string | null;
}

interface BookingTableProps {
  bookings: Booking[];
  onStatusChange: (bookingId: string, status: string, isOrder?: boolean) => void;
  onAddNote: (bookingId: string, notes: string, isOrder?: boolean) => void;
  onReschedule: (bookingId: string, newDate: string, isOrder?: boolean) => void;
  onDelete: (bookingId: string, isOrder?: boolean) => void;
  onRemoveItem: (orderId: string, itemId: string, productId: string) => void;
  updatingId: string | null;
  onFileUpload?: (file: File, id: string, isOrder: boolean) => Promise<void>;
  isUploading?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  waiting_local: { label: 'Via WhatsApp', variant: 'outline', icon: Clock },
  paid: { label: 'Pago', variant: 'secondary', icon: CheckCircle },
  'checked-in': { label: 'Check-in ✓', variant: 'default', icon: UserCheck },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
};

export function BookingTable({ bookings, onStatusChange, onAddNote, onReschedule, onDelete, onRemoveItem, updatingId, onFileUpload, isUploading }: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-3xl border border-dashed border-border text-muted-foreground font-medium animate-in fade-in zoom-in-95 duration-500">
        Nenhuma reserva encontrada para este período.
      </div>
    );
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(bookings.map(b => b.id)));
  };

  const handleBulkAction = async (action: 'confirm' | 'cancel' | 'delete') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'delete' && !confirm(`Atenção: Você irá apagar permanentemente ${ids.length} reservas. Continuar?`)) return;
    
    for (const id of ids) {
       const b = bookings.find(x => x.id === id);
       if (!b) continue;
       if (action === 'confirm') onStatusChange(b.id, 'paid', b.is_order);
       else if (action === 'cancel') onStatusChange(b.id, 'cancelled', b.is_order);
       else if (action === 'delete') onDelete(b.id, b.is_order);
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4 relative pb-28">
       {/* BARRA DE AÇÕES FLUTUANTE PREMIUM */}
       {selectedIds.size > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-foreground text-background px-8 py-5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sun opacity-90 mb-1">Ações em Massa</span>
              <span className="text-2xl font-black tabular-nums">{selectedIds.size} <span className="text-sm font-medium opacity-60">selecionados</span></span>
            </div>
            <div className="h-12 w-px bg-white/10" />
            <div className="flex gap-3">
               <Button onClick={() => handleBulkAction('confirm')} className="bg-whatsapp hover:bg-whatsapp-dark text-white font-black text-xs h-12 px-6 rounded-2xl uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg shadow-whatsapp/20">Confirmar</Button>
               <Button onClick={() => handleBulkAction('cancel')} className="bg-red-500 hover:bg-red-600 text-white font-black text-xs h-12 px-6 rounded-2xl uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20">Cancelar</Button>
               <Button onClick={() => handleBulkAction('delete')} variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 font-black text-xs h-12 px-6 rounded-2xl uppercase tracking-wider">Excluir Tudo</Button>
            </div>
            <div className="h-12 w-px bg-white/10" />
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-white font-black uppercase text-[10px] hover:bg-white/10 px-4 h-12 rounded-2xl tracking-widest">Limpar Seleção</Button>
         </div>
       )}

       <div className="bg-white rounded-2xl overflow-hidden shadow-card border border-border/50">
         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                 <tr className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider">
                    <th className="p-6 w-12 text-center">
                       <input 
                         type="checkbox" 
                         checked={selectedIds.size === bookings.length && bookings.length > 0} 
                         onChange={toggleSelectAll} 
                         className="w-5 h-5 rounded-lg border-slate-300 text-primary cursor-pointer transition-all focus:ring-primary/20" 
                       />
                    </th>
                    <th className="p-5">Agenda / Status</th>
                    <th className="p-6">Cliente (Identificação)</th>
                    <th className="p-6 text-center">Visitantes</th>
                    <th className="p-6 text-right">Montante</th>
                    <th className="p-6 text-center">Ações</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {bookings.map((booking) => {
                   const expanded = expandedId === booking.id;
                   const isSelected = selectedIds.has(booking.id);
                   const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                   const StatusIcon = config.icon;
                   
                   const parseBookingDate = (dateStr: string) => {
                     try {
                       return parseISO(dateStr);
                     } catch {
                       return new Date();
                     }
                   };
                   
                   const bookingDate = parseBookingDate(booking.visit_date);
                   const childrenCount = Array.isArray(booking.children) ? booking.children.length : (typeof booking.children === 'number' ? booking.children : 0);
                   const totalPeople = (booking.adults || 0) + childrenCount;

                   return (
                      <React.Fragment key={booking.id}>
                         <tr 
                           onClick={() => setExpandedId(expanded ? null : booking.id)} 
                           className={cn(
                             "group transition-all cursor-pointer duration-300",
                             isSelected ? "bg-primary/[0.03]" : "hover:bg-slate-50/80",
                             expanded && "bg-slate-50 shadow-inner"
                           )}
                         >
                            <td className="p-6 text-center">
                               <input 
                                 type="checkbox" 
                                 checked={isSelected} 
                                 onClick={(e) => toggleSelect(booking.id, e)} 
                                 onChange={() => {}} 
                                 className="w-5 h-5 rounded-lg border-slate-300 text-primary cursor-pointer transition-all focus:ring-primary/20" 
                               />
                            </td>
                            <td className="p-6">
                               <div className="flex flex-col">
                                  <span className={cn(
                                    "text-xs font-black uppercase tracking-tight",
                                    isToday(bookingDate) ? "text-primary" : "text-slate-900"
                                  )}>
                                     {format(bookingDate, "dd 'de' MMMM", { locale: ptBR })}
                                     <span className="ml-2 text-[10px] opacity-40">({format(bookingDate, "EEE", { locale: ptBR })})</span>
                                  </span>
                                  <div className={cn(
                                    "flex items-center gap-1.5 mt-2 font-black uppercase text-[10px] tracking-wider shrink-0",
                                    booking.status === 'paid' ? "text-whatsapp" : 
                                    booking.status === 'cancelled' ? "text-red-500" : 
                                    "text-slate-400"
                                  )}>
                                     <StatusIcon className="w-3.5 h-3.5" />
                                     <span>{config.label}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="p-6">
                               <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <span className="font-black text-base text-slate-800 uppercase tracking-tighter leading-none">{booking.name}</span>
                                     {booking.is_associado && (
                                       <Badge className="bg-sun/10 text-sun-dark border-sun/20 text-[8px] font-black uppercase px-2 h-4 rounded-full">VIP</Badge>
                                     )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                     <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-black text-[9px] border border-slate-200">#{booking.id.slice(0, 8)}</span>
                                     <span className="flex items-center gap-1.5 hover:text-primary transition-colors">
                                       <Phone className="w-3 h-3" />
                                       {booking.phone}
                                     </span>
                                  </div>
                               </div>
                            </td>
                            <td className="p-6 text-center">
                               <div className="inline-flex items-center gap-2 bg-slate-100/50 px-4 py-2 rounded-2xl border border-slate-200/50">
                                  <Users className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm font-black text-slate-700 tracking-tighter">{totalPeople}</span>
                               </div>
                            </td>
                            <td className="p-6 text-right">
                               <div className="flex flex-col items-end">
                                  <span className="text-lg font-black text-primary tracking-tighter">{formatCurrency(booking.total_amount)}</span>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.1em] mt-1">Total Confirmado</span>
                               </div>
                            </td>
                            <td className="p-6 text-center">
                               <Button size="icon" variant="ghost" className={cn(
                                 "h-10 w-10 rounded-2xl transition-all duration-300",
                                 expanded ? "bg-primary/10 text-primary rotate-180" : "hover:bg-slate-100 text-slate-300"
                               )}>
                                  <ChevronDown className="w-5 h-5" />
                               </Button>
                            </td>
                         </tr>
                         
                         {expanded && (
                           <tr>
                              <td colSpan={6} className="p-0 border-b border-slate-100">
                                 <div className="p-6 bg-muted/20 space-y-6 animate-in slide-in-from-top-4 duration-500 ease-out">
                                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/50">
                                       <BookingDetail booking={booking} />
                                    </div>
                                    
                                    <div className="grid lg:grid-cols-2 gap-10 items-stretch">
                                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/50 flex flex-col justify-between space-y-4">
                                          <div>
                                             <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                   <div className="p-2.5 bg-primary/5 rounded-xl">
                                                      <Calendar className="w-5 h-5 text-primary" />
                                                   </div>
                                                   <h4 className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider">Gestão Direta</h4>
                                                </div>
                                                
                                                {onFileUpload && (
                                                   <div className="flex items-center gap-2">
                                                      <input type="file" id={`upload-${booking.id}`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                                      <label htmlFor={`upload-${booking.id}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100 transition-all border border-blue-100 text-[9px] font-black uppercase tracking-widest">
                                                         {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                                         {booking.receipt_url ? 'PAGAMENTO OK' : 'ANEXAR COMPROVANTE'}
                                                      </label>
                                                   </div>
                                                )}
                                             </div>
                                             
                                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                                <Button 
                                                  onClick={() => onStatusChange(booking.id, 'paid', booking.is_order)} 
                                                  disabled={booking.status === 'paid' || updatingId === booking.id} 
                                                  className="bg-primary hover:bg-primary-dark text-white font-bold uppercase text-[9px] h-11 rounded-xl tracking-wider shadow-md shadow-primary/10"
                                                >
                                                   <CheckCircle className="w-3.5 h-3.5 mr-1" /> CONFIRMAR
                                                </Button>
                                                
                                                <Button 
                                                  onClick={() => onStatusChange(booking.id, 'checked-in', booking.is_order)} 
                                                  variant="outline" 
                                                  className={cn(
                                                    "border-primary text-primary hover:bg-primary/10 font-bold uppercase text-[9px] h-11 rounded-xl tracking-wider",
                                                    booking.status === 'checked-in' && "bg-primary text-white"
                                                  )}
                                                >
                                                   <UserCheck className="w-3.5 h-3.5 mr-1" /> CHECK-IN
                                                </Button>

                                                <Button 
                                                  variant="outline" 
                                                  onClick={() => { const d = prompt("Nova Data (AAAA-MM-DD):", booking.visit_date); if (d) onReschedule(booking.id, d, booking.is_order); }} 
                                                  className="border-blue-200 text-blue-600 hover:bg-blue-50 font-bold uppercase text-[9px] h-11 rounded-xl tracking-wider"
                                                >
                                                   <Clock className="w-3.5 h-3.5 mr-1" /> REAGENDAR
                                                </Button>

                                                <Button 
                                                  onClick={() => onStatusChange(booking.id, 'cancelled', booking.is_order)} 
                                                  variant="ghost" 
                                                  className="text-red-500 hover:bg-red-50 font-bold uppercase text-[9px] h-11 rounded-xl tracking-wider"
                                                >
                                                   <XCircle className="w-3.5 h-3.5 mr-1" /> CANCELAR
                                                </Button>

                                                <Button 
                                                  onClick={(e) => { e.stopPropagation(); if (confirm('Excluir permanentemente do banco de dados?')) onDelete(booking.id, booking.is_order); }} 
                                                  variant="ghost" 
                                                  className="text-slate-300 hover:text-red-600 font-bold uppercase text-[9px] h-11 rounded-xl flex gap-2"
                                                >
                                                   <Trash2 className="w-3.5 h-3.5 mr-1" /> EXCLUIR
                                                </Button>
                                             </div>
                                          </div>
                                       </div>

                                       {/* PAINEL DE NOTAS DO STAFF */}
                                       <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/50">
                                          <div className="flex items-center gap-3 mb-6">
                                             <div className="p-2.5 bg-sun/5 rounded-xl">
                                                <Plus className="w-5 h-5 text-sun-dark" />
                                             </div>
                                             <h4 className="text-[10px] font-bold uppercase text-muted-foreground/60 tracking-wider">Notas Internas</h4>
                                          </div>

                                          {editingNoteId === booking.id ? (
                                             <div className="space-y-3">
                                                <Textarea 
                                                   value={noteText} 
                                                   onChange={e => setNoteText(e.target.value)} 
                                                   placeholder="Observações importantes..." 
                                                   className="rounded-xl border-border focus:ring-primary/20 min-h-[120px] text-sm font-medium p-4 bg-muted/20" 
                                                />
                                                <div className="flex gap-2">
                                                   <Button onClick={() => { onAddNote(booking.id, noteText, booking.is_order); setEditingNoteId(null); }} className="flex-1 bg-foreground text-background font-bold uppercase text-[10px] h-10 rounded-xl tracking-wider">Salvar</Button>
                                                   <Button onClick={() => setEditingNoteId(null)} variant="ghost" className="font-bold uppercase text-[10px] px-5 h-10 rounded-xl tracking-wider">Cancelar</Button>
                                                </div>
                                             </div>
                                          ) : (
                                             <div 
                                               onClick={() => { setEditingNoteId(booking.id); setNoteText(booking.notes || ''); }} 
                                               className="group cursor-pointer min-h-[160px] p-6 rounded-2xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center transition-all hover:bg-primary/[0.02] hover:border-primary/20"
                                             >
                                                {booking.notes ? (
                                                  <div className="w-full">
                                                    <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-3">{booking.notes}</p>
                                                    <span className="text-[10px] font-bold uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity">Editar nota</span>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <div className="w-10 h-10 bg-muted/50 rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/5 transition-colors">
                                                      <Plus className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground/40 tracking-wider group-hover:text-primary transition-colors">Adicionar Observação</p>
                                                  </>
                                                )}
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </td>
                           </tr>
                         )}
                      </React.Fragment>
                   );
                 })}
              </tbody>
           </table>
         </div>
       </div>
    </div>
  );
}
