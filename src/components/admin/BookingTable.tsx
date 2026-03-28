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
      <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100/50 text-emerald-900/40 font-black animate-in fade-in zoom-in-95 duration-500 uppercase tracking-widest">
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
    <div className="space-y-6 relative pb-28">
        {/* BARRA DE AÇÕES FLUTUANTE PREMIUM */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-10 py-6 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(6,78,59,0.5)] border border-white/10 flex items-center gap-10 animate-in slide-in-from-bottom-12 duration-500 transition-all backdrop-blur-2xl">
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">Painel Gerencial</span>
               <span className="text-3xl font-black tabular-nums">{selectedIds.size} <span className="text-xs font-bold opacity-40 uppercase tracking-widest ml-1">itens</span></span>
             </div>
             <div className="h-14 w-px bg-white/10" />
             <div className="flex gap-4">
                <Button onClick={() => handleBulkAction('confirm')} className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs h-14 px-8 rounded-2xl uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20">Confirmar Seleção</Button>
                <Button onClick={() => handleBulkAction('cancel')} className="bg-red-500 hover:bg-red-400 text-white font-black text-xs h-14 px-8 rounded-2xl uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-500/20">Cancelar Todos</Button>
                <Button onClick={() => handleBulkAction('delete')} variant="ghost" className="text-red-300 hover:text-red-100 hover:bg-red-950/40 font-black text-xs h-14 px-8 rounded-2xl uppercase tracking-wider">Apagar Dados</Button>
             </div>
             <div className="h-14 w-px bg-white/10" />
             <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-white/40 font-black uppercase text-[10px] hover:text-white hover:bg-white/5 px-6 h-14 rounded-2xl tracking-[0.2em] transition-all">Limpar</Button>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-premium border border-emerald-100/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-[#0b2b24] border-b border-emerald-900 border-separate">
                  <tr className="text-[11px] font-black uppercase text-emerald-200/40 tracking-[0.2em]">
                     <th className="p-8 w-16 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === bookings.length && bookings.length > 0} 
                          onChange={toggleSelectAll} 
                          className="w-6 h-6 rounded-lg border-emerald-800 bg-emerald-900/50 text-emerald-400 cursor-pointer transition-all focus:ring-emerald-500/20" 
                        />
                     </th>
                     <th className="p-8">Agenda / Operação</th>
                     <th className="p-8">Identificação Cliente</th>
                     <th className="p-8 text-center">Configuração</th>
                     <th className="p-8 text-right">Financeiro TOTAL</th>
                     <th className="p-8 text-center opacity-0">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-emerald-50/60">
                  {bookings.map((booking) => {
                    const expanded = expandedId === booking.id;
                    const isSelected = selectedIds.has(booking.id);
                    const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                    const StatusIcon = config.icon;
                    
                    const bookingDate = parseISO(booking.visit_date || new Date().toISOString());
                    const childrenCount = Array.isArray(booking.children) ? booking.children.length : (typeof booking.children === 'number' ? booking.children : 0);
                    const totalPeople = (booking.adults || 0) + childrenCount;

                    return (
                       <React.Fragment key={booking.id}>
                          <tr 
                            onClick={() => setExpandedId(expanded ? null : booking.id)} 
                            className={cn(
                              "group transition-all cursor-pointer duration-500",
                              isSelected ? "bg-emerald-50" : "hover:bg-emerald-50/30",
                              expanded && "bg-emerald-50/50"
                            )}
                          >
                             <td className="p-8 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  onClick={(e) => toggleSelect(booking.id, e)} 
                                  onChange={() => {}} 
                                  className="w-6 h-6 rounded-lg border-emerald-200 bg-white text-emerald-600 cursor-pointer transition-all focus:ring-emerald-500/20" 
                                />
                             </td>
                             <td className="p-8">
                                <div className="flex flex-col gap-1.5">
                                   <span className={cn(
                                     "text-[13px] font-black uppercase tracking-tight",
                                     isToday(bookingDate) ? "text-emerald-600" : "text-emerald-950"
                                   )}>
                                      {format(bookingDate, "dd 'de' MMMM", { locale: ptBR })}
                                      <span className="ml-2 text-[10px] opacity-30">({format(bookingDate, "EEEE", { locale: ptBR })})</span>
                                   </span>
                                   <div className={cn(
                                     "flex items-center gap-2 font-black uppercase text-[9px] tracking-[0.15em] w-fit px-2.5 py-1 rounded-lg border",
                                     booking.status === 'paid' ? "text-emerald-600 bg-emerald-50 border-emerald-100" : 
                                     booking.status === 'cancelled' ? "text-red-500 bg-red-50 border-red-100" : 
                                     "text-emerald-950/40 bg-white border-emerald-100/50"
                                   )}>
                                      <StatusIcon className="w-3 h-3" />
                                      <span>{config.label}</span>
                                   </div>
                                </div>
                             </td>
                             <td className="p-8">
                                <div className="flex flex-col gap-1">
                                   <div className="flex items-center gap-3">
                                      <span className="font-black text-lg text-emerald-950 uppercase tracking-tighter leading-none">{booking.name}</span>
                                      {booking.is_associado && (
                                        <Badge className="bg-amber-400 text-amber-950 border-none text-[8px] font-black uppercase px-2.5 h-4 rounded-full shadow-lg shadow-amber-400/20">Sócio VIP</Badge>
                                      )}
                                   </div>
                                   <div className="flex items-center gap-4 mt-2 text-[11px] font-bold text-emerald-900/30 uppercase tracking-widest">
                                      <span className="bg-emerald-50/50 text-emerald-900/40 px-3 py-1 rounded-xl font-black text-[9px] border border-emerald-100/50">ID: {booking.id.slice(0, 8)}</span>
                                      <span className="flex items-center gap-2 text-emerald-950/40 hover:text-emerald-600 transition-colors">
                                        <Phone className="w-4 h-4" />
                                        {booking.phone}
                                      </span>
                                   </div>
                                </div>
                             </td>
                             <td className="p-8 text-center">
                                <div className="inline-flex items-center gap-2 bg-emerald-900/5 px-5 py-2.5 rounded-2xl border border-emerald-900/5">
                                   <Users className="w-4.5 h-4.5 text-emerald-900/20" />
                                   <span className="text-base font-black text-emerald-950 tracking-tighter">{totalPeople} <span className="text-[10px] opacity-30">PESSOAS</span></span>
                                </div>
                             </td>
                             <td className="p-8 text-right">
                                <div className="flex flex-col items-end">
                                   <span className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(booking.total_amount)}</span>
                                   <span className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em] mt-1">Valor Auditado</span>
                                </div>
                             </td>
                             <td className="p-8 text-center">
                                <Button size="icon" variant="ghost" className={cn(
                                  "h-12 w-12 rounded-[1.2rem] transition-all duration-500",
                                  expanded ? "bg-emerald-950 text-white rotate-180 scale-110 shadow-xl shadow-emerald-950/20" : "hover:bg-emerald-900/5 text-emerald-300"
                                )}>
                                   <ChevronDown className="w-6 h-6" />
                                </Button>
                             </td>
                          </tr>
                          
                          {expanded && (
                            <tr>
                               <td colSpan={6} className="p-0 bg-emerald-50/30 border-y border-emerald-100/50">
                                  <div className="p-10 space-y-10 animate-in slide-in-from-top-6 duration-700 ease-out">
                                     <div className="bg-white rounded-[2.5rem] p-10 shadow-premium border border-emerald-100/20">
                                        <BookingDetail booking={booking} />
                                     </div>
                                     
                                     <div className="grid lg:grid-cols-2 gap-12 items-stretch">
                                        <div className="bg-white p-10 rounded-[2.5rem] shadow-premium border border-emerald-100/20 flex flex-col justify-between space-y-8">
                                           <div>
                                              <div className="flex items-center justify-between mb-8">
                                                 <div className="flex items-center gap-4">
                                                    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                                                       <Calendar className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                       <h4 className="text-[11px] font-black uppercase text-emerald-900/30 tracking-[0.2em]">Painel Operacional</h4>
                                                       <p className="text-sm font-black text-emerald-950">Ações Rápidas de Reserva</p>
                                                    </div>
                                                 </div>
                                                 
                                                 {onFileUpload && (
                                                    <div className="flex items-center gap-2">
                                                       <input type="file" id={`upload-${booking.id}`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                                       <label htmlFor={`upload-${booking.id}`} className={cn(
                                                          "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl cursor-pointer transition-all border font-black text-[10px] uppercase tracking-widest",
                                                          booking.receipt_url 
                                                            ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                                                            : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 shadow-sm"
                                                       )}>
                                                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-4 h-4 text-white" /> : <Upload className="w-4 h-4" />}
                                                          {booking.receipt_url ? 'PAGAMENTO AUDITADO' : 'ANEXAR COMPROVANTE'}
                                                       </label>
                                                    </div>
                                                 )}
                                              </div>
                                              
                                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'paid', booking.is_order)} 
                                                   disabled={booking.status === 'paid' || updatingId === booking.id} 
                                                   className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] h-14 rounded-2xl tracking-wider shadow-xl shadow-emerald-600/20"
                                                 >
                                                    <CheckCircle className="w-4 h-4 mr-2" /> EFETIVAR
                                                 </Button>
                                                 
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'checked-in', booking.is_order)} 
                                                   variant="outline" 
                                                   className={cn(
                                                     "border-emerald-200 text-emerald-900 hover:bg-emerald-50 font-black uppercase text-[10px] h-14 rounded-2xl tracking-wider shadow-sm",
                                                     booking.status === 'checked-in' && "bg-emerald-950 text-white border-emerald-950"
                                                   )}
                                                 >
                                                    <UserCheck className="w-4 h-4 mr-2" /> CHECK-IN
                                                 </Button>
                                                 <Button 
                                                   variant="outline" 
                                                   onClick={() => { const d = prompt("Nova Data (AAAA-MM-DD):", booking.visit_date); if (d) onReschedule(booking.id, d, booking.is_order); }} 
                                                   className="border-blue-100 text-blue-600 hover:bg-blue-50 font-black uppercase text-[10px] h-14 rounded-2xl tracking-wider shadow-sm"
                                                 >
                                                    <Clock className="w-4 h-4 mr-2" /> REAGENDAR
                                                 </Button>
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'cancelled', booking.is_order)} 
                                                   variant="ghost" 
                                                   className="text-red-500 hover:bg-red-50 font-black uppercase text-[10px] h-14 rounded-2xl tracking-wider border border-transparent hover:border-red-100 transition-all"
                                                 >
                                                    <XCircle className="w-4 h-4 mr-2" /> CANCELAR
                                                 </Button>
                                                 <Button 
                                                   onClick={(e) => { e.stopPropagation(); if (confirm('Atenção: A deleção é PERMANENTE e remove todos os itens vinculados. Confirmar?')) onDelete(booking.id, booking.is_order); }} 
                                                   variant="ghost" 
                                                   className="text-emerald-950/20 hover:text-red-600 font-black uppercase text-[10px] h-14 rounded-2xl flex gap-2 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                                                 >
                                                    <Trash2 className="w-4 h-4 mr-2" /> EXCLUIR DEFINITIVO
                                                 </Button>
                                              </div>
                                           </div>
                                        </div>

                                        {/* PAINEL DE NOTAS DO STAFF */}
                                        <div className="bg-white p-10 rounded-[2.5rem] shadow-premium border border-emerald-100/20">
                                           <div className="flex items-center gap-4 mb-8">
                                              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm">
                                                 <Plus className="w-6 h-6 text-amber-600" />
                                              </div>
                                              <div>
                                                 <h4 className="text-[11px] font-black uppercase text-amber-900/30 tracking-[0.2em]">Memorial Interno</h4>
                                                 <p className="text-sm font-black text-amber-950">Observações Operacionais</p>
                                              </div>
                                           </div>

                                           {editingNoteId === booking.id ? (
                                              <div className="space-y-4">
                                                 <Textarea 
                                                    value={noteText} 
                                                    onChange={e => setNoteText(e.target.value)} 
                                                    placeholder="Digite observações importantes sobre este cliente ou pedido..." 
                                                    className="rounded-[2rem] border-emerald-100 focus:ring-emerald-500/20 min-h-[160px] text-sm font-black p-8 bg-emerald-50/30 text-emerald-950 placeholder:text-emerald-950/20 leading-relaxed shadow-inner" 
                                                 />
                                                 <div className="flex gap-3">
                                                    <Button onClick={() => { onAddNote(booking.id, noteText, booking.is_order); setEditingNoteId(null); }} className="flex-1 bg-emerald-950 text-white font-black uppercase text-[11px] h-14 rounded-2xl tracking-[0.2em] shadow-xl shadow-emerald-950/30">Gravar Nota</Button>
                                                    <Button onClick={() => setEditingNoteId(null)} variant="ghost" className="font-black uppercase text-[11px] px-8 h-14 rounded-2xl tracking-widest text-emerald-950/40 hover:text-emerald-950">Descartar</Button>
                                                 </div>
                                              </div>
                                           ) : (
                                              <div 
                                                onClick={() => { setEditingNoteId(booking.id); setNoteText(booking.notes || ''); }} 
                                                className="group cursor-pointer min-h-[224px] p-10 rounded-[2.5rem] border-2 border-dashed border-emerald-100 flex flex-col items-center justify-center transition-all hover:bg-emerald-50 hover:border-emerald-200 shadow-sm hover:shadow-lg"
                                              >
                                                 {booking.notes ? (
                                                   <div className="w-full text-center">
                                                     <p className="text-base font-black text-emerald-900/60 italic leading-relaxed mb-6">"{booking.notes}"</p>
                                                     <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 px-4 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all tracking-widest">Clique para Editar</span>
                                                   </div>
                                                 ) : (
                                                   <>
                                                     <div className="w-14 h-14 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center mb-5 group-hover:bg-emerald-600 group-hover:scale-110 transition-all shadow-sm">
                                                       <Plus className="w-7 h-7 text-emerald-400 group-hover:text-white transition-colors" />
                                                     </div>
                                                     <p className="text-[10px] font-black uppercase text-emerald-950/20 tracking-[0.3em] group-hover:text-emerald-600 transition-colors">Adicionar Observação</p>
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
