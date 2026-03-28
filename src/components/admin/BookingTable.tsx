import React, { useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, CheckCircle, XCircle, Clock, 
  UserCheck, Trash2, Plus, 
  Users, Calendar, Upload, FileCheck, Loader2,
  CalendarClock, StickyNote
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  pending: { label: 'PENDENTE', variant: 'outline', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  waiting_local: { label: 'WHATSAPP', variant: 'outline', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  paid: { label: 'PAGO OK', variant: 'secondary', icon: CheckCircle, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  'checked-in': { label: 'CHECK-IN ✓', variant: 'default', icon: UserCheck, color: 'text-white', bgColor: 'bg-emerald-600', borderColor: 'border-emerald-700' },
  cancelled: { label: 'CANCELADA', variant: 'destructive', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

export function BookingTable({ bookings, onStatusChange, onAddNote, onReschedule, onDelete, onRemoveItem, updatingId, onFileUpload, isUploading }: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100/50 text-emerald-900/40 font-black animate-in fade-in zoom-in-95 duration-500 uppercase tracking-widest">
        Nenhuma reserva encontrada.
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
       else if (action === 'delete') {
         onDelete(b.id, b.is_order);
         await new Promise(r => setTimeout(r, 200));
       }
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6 relative pb-28">
        {/* BARRA DE AÇÕES FLUTUANTE */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-10 py-6 rounded-[2.5rem] shadow-2xl border border-white/10 flex items-center gap-10 animate-in slide-in-from-bottom-12 duration-500 backdrop-blur-2xl">
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">Ações em Massa</span>
               <span className="text-3xl font-black tabular-nums">{selectedIds.size}</span>
             </div>
             <div className="h-14 w-px bg-white/10" />
             <div className="flex gap-4">
                <Button onClick={() => handleBulkAction('confirm')} className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs h-14 px-8 rounded-2xl uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/20">Confirmar</Button>
                <Button onClick={() => handleBulkAction('cancel')} className="bg-amber-500 hover:bg-amber-400 text-white font-black text-xs h-14 px-8 rounded-2xl uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20">Cancelar</Button>
                <Button onClick={() => handleBulkAction('delete')} variant="ghost" className="text-red-400 hover:text-red-100 hover:bg-red-950/40 font-black text-xs h-14 px-8 rounded-2xl">Excluir</Button>
             </div>
             <div className="h-14 w-px bg-white/10" />
             <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-white/40 font-black uppercase text-[10px] tracking-widest px-6 h-14 rounded-2xl">Limpar</Button>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-emerald-100/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-[#0b2b24]">
                  <tr className="text-[11px] font-black uppercase text-emerald-400/60 tracking-[0.2em]">
                     <th className="p-8 w-16 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === bookings.length && bookings.length > 0} 
                          onChange={toggleSelectAll} 
                          className="w-6 h-6 rounded-lg border-emerald-800 bg-emerald-900 shadow-sm cursor-pointer accent-emerald-500" 
                        />
                     </th>
                     <th className="p-8">Agenda / Operação</th>
                     <th className="p-8">Identificação Cliente</th>
                     <th className="p-8 text-center">Configuração</th>
                     <th className="p-8 text-right">Financeiro TOTAL</th>
                     <th className="p-8 text-center opacity-0">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-emerald-50">
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
                              "group transition-all cursor-pointer duration-300",
                              isSelected ? "bg-emerald-50" : "hover:bg-emerald-50/20",
                              expanded && "bg-emerald-50/50"
                            )}
                          >
                             <td className="p-8 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  onClick={(e) => toggleSelect(booking.id, e)} 
                                  onChange={() => {}} 
                                  className="w-6 h-6 rounded-lg border-emerald-200 bg-white cursor-pointer accent-emerald-600" 
                                />
                             </td>
                             <td className="p-8">
                                <div className="space-y-1.5 min-w-[140px]">
                                   <div className="flex items-center gap-2">
                                      <Calendar className={cn("w-4 h-4", isToday(bookingDate) ? "text-emerald-600" : "text-emerald-900/30")} />
                                      <span className={cn(
                                        "text-sm font-black uppercase tracking-tight",
                                        isToday(bookingDate) ? "text-emerald-600" : "text-emerald-950"
                                      )}>
                                         {format(bookingDate, "dd/MM/yyyy", { locale: ptBR })}
                                      </span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-emerald-900/40 uppercase tracking-widest pl-6">
                                         {format(bookingDate, "EEEE", { locale: ptBR })}
                                      </span>
                                   </div>
                                   <div className="pl-6 pt-1">
                                      <div className={cn(
                                        "flex items-center gap-1.5 font-black uppercase text-[8px] tracking-[0.15em] w-fit px-2 py-0.5 rounded-md border",
                                        config.bgColor, config.color, config.borderColor
                                      )}>
                                         <StatusIcon className="w-2.5 h-2.5" />
                                         <span>{config.label}</span>
                                      </div>
                                   </div>
                                </div>
                             </td>
                             <td className="p-8">
                                <div className="flex flex-col gap-1.5">
                                   <span className="font-black text-xl text-emerald-950 uppercase tracking-tighter leading-none hover:text-emerald-600 transition-colors">
                                     {booking.name || (booking as any).customer_name || 'CLIENTE GERAL'}
                                   </span>
                                   <div className="flex items-center gap-2">
                                      <span className="bg-emerald-50 text-emerald-800/40 border border-emerald-100 px-2 py-0.5 rounded-lg font-black text-[9px] uppercase tracking-widest">
                                         ID: {booking.id.slice(0, 8)}
                                      </span>
                                      {booking.is_associado && (
                                        <Badge className="bg-sun text-sun-dark border-none text-[8px] font-black uppercase px-2 h-4 rounded-full">Sócio</Badge>
                                      )}
                                   </div>
                                </div>
                             </td>
                             <td className="p-8 text-center">
                                <div className="inline-flex flex-col items-center justify-center bg-emerald-900/5 w-24 h-24 rounded-3xl border-2 border-emerald-900/5 hover:border-emerald-900/10 transition-all">
                                   <Users className="w-5 h-5 text-emerald-900/20 mb-1" />
                                   <span className="text-2xl font-black text-emerald-950 tracking-tighter">{totalPeople}</span>
                                   <span className="text-[8px] font-black opacity-30 uppercase tracking-[0.2em] leading-none">Pessoas</span>
                                </div>
                             </td>
                             <td className="p-8 text-right">
                                <div className="flex flex-col items-end">
                                   <span className="text-3xl font-black text-emerald-600 tracking-tighter drop-shadow-sm">{formatCurrency(booking.total_amount)}</span>
                                   <span className="text-[10px] font-black text-emerald-200 uppercase tracking-[0.2em] mt-1">Auditado OK</span>
                                </div>
                             </td>
                             <td className="p-8 text-center">
                                <Button size="icon" variant="ghost" className={cn(
                                  "h-12 w-12 rounded-2xl transition-all duration-300",
                                  expanded ? "bg-emerald-950 text-white rotate-180 shadow-lg shadow-emerald-950/20" : "text-emerald-300 hover:bg-emerald-50"
                                )}>
                                   <ChevronDown className="w-6 h-6" />
                                </Button>
                             </td>
                          </tr>
                          
                          {expanded && (
                            <tr>
                               <td colSpan={6} className="p-0 bg-emerald-50/30 border-y-2 border-emerald-100/50">
                                  <div className="p-10 space-y-10 animate-in slide-in-from-top-6 duration-500">
                                     <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border-2 border-emerald-200">
                                        <BookingDetail booking={booking} />
                                     </div>
                                     
                                     <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                                        {/* PAINEL DE AÇÕES RÁPIDAS */}
                                        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-emerald-100 flex flex-col justify-between space-y-8 relative overflow-hidden group">
                                           <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform"><CalendarClock className="w-24 h-24 text-emerald-900" /></div>
                                           <div className="relative z-10 space-y-8">
                                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-50 pb-6">
                                                 <div className="flex items-center gap-4">
                                                    <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm text-emerald-600">
                                                      <CalendarClock className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                       <h4 className="text-[10px] font-black uppercase text-emerald-900/30 tracking-[0.3em]">Painel de Controle</h4>
                                                       <p className="text-lg font-black text-emerald-950">Gerenciar Reserva</p>
                                                    </div>
                                                 </div>

                                                 {onFileUpload && (
                                                   <div className="flex items-center gap-2">
                                                      <input type="file" id={`upload-${booking.id}`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                                      <label htmlFor={`upload-${booking.id}`} className={cn(
                                                         "flex items-center gap-2.5 px-6 py-3 rounded-2xl cursor-pointer transition-all border-2 font-black text-[10px] uppercase tracking-widest shadow-sm hover:scale-105 active:scale-95",
                                                         booking.receipt_url 
                                                           ? "bg-emerald-600 border-emerald-600 text-white" 
                                                           : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                                      )}>
                                                         {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                                                         {booking.receipt_url ? 'COMPROVANTE OK' : 'ANEXAR COMPROVANTE'}
                                                      </label>
                                                   </div>
                                                 )}
                                              </div>
                                              
                                              {/* BOTÕES EM UMA LINHA */}
                                              <div className="flex flex-wrap md:flex-nowrap items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'paid', booking.is_order)} 
                                                   disabled={booking.status === 'paid' || updatingId === booking.id} 
                                                   className="flex-1 min-w-[110px] bg-[#006020] hover:bg-[#004d1a] text-white font-black uppercase text-[9px] h-14 rounded-2xl shadow-lg shadow-emerald-900/20 px-4 flex flex-col pt-1.5"
                                                 >
                                                    <CheckCircle className="w-4 h-4 mb-0.5" /> 
                                                    <span>EFETIVAR</span>
                                                 </Button>
                                                 
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'checked-in', booking.is_order)} 
                                                   className={cn(
                                                     "flex-1 min-w-[110px] border-2 font-black uppercase text-[9px] h-14 rounded-2xl shadow-sm px-4 flex flex-col pt-1.5",
                                                     booking.status === 'checked-in' 
                                                       ? "bg-[#006020] border-[#006020] text-white" 
                                                       : "bg-white border-[#006020] text-[#006020] hover:bg-emerald-50"
                                                   )}
                                                 >
                                                    <UserCheck className="w-4 h-4 mb-0.5" /> 
                                                    <span>CHECK-IN</span>
                                                 </Button>

                                                 <Button 
                                                   variant="outline" 
                                                   onClick={() => { const d = prompt("Nova Data (AAAA-MM-DD):", booking.visit_date); if (d) onReschedule(booking.id, d, booking.is_order); }} 
                                                   className="flex-1 min-w-[110px] border-2 border-[#0077b6] text-[#0077b6] hover:bg-blue-50 bg-white font-black uppercase text-[9px] h-14 rounded-2xl shadow-sm px-4 flex flex-col pt-1.5"
                                                 >
                                                    <Clock className="w-4 h-4 mb-0.5" /> 
                                                    <span>REAGENDAR</span>
                                                 </Button>

                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'cancelled', booking.is_order)} 
                                                   className="flex-1 min-w-[110px] border-2 border-amber-500 text-amber-600 hover:bg-amber-50 bg-white font-black uppercase text-[9px] h-14 rounded-2xl shadow-sm px-4 flex flex-col pt-1.5"
                                                 >
                                                    <XCircle className="w-4 h-4 mb-0.5" /> 
                                                    <span>CANCELAR</span>
                                                 </Button>

                                                 <Button 
                                                   onClick={(e) => { e.stopPropagation(); if (confirm('DELETAR AGORA? Esta ação é irreversível.')) onDelete(booking.id, booking.is_order); }} 
                                                   className="flex-1 min-w-[110px] border-2 border-red-500 text-red-600 hover:bg-red-50 bg-white font-black uppercase text-[9px] h-14 rounded-2xl shadow-sm px-4 flex flex-col pt-1.5"
                                                 >
                                                    <Trash2 className="w-4 h-4 mb-0.5" /> 
                                                    <span>EXCLUIR</span>
                                                 </Button>
                                              </div>
                                           </div>
                                        </div>

                                        {/* PAINEL DE OBSERVAÇÕES */}
                                        <div className="bg-emerald-950 text-white p-8 rounded-[2.5rem] shadow-xl border-2 border-emerald-900 flex flex-col space-y-6 relative overflow-hidden group">
                                           <div className="absolute -bottom-6 -right-6 p-10 opacity-5 group-hover:scale-110 transition-transform rotate-12"><StickyNote className="w-48 h-48" /></div>
                                           <div className="relative z-10">
                                              <div className="flex items-center gap-4 mb-6">
                                                 <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md">
                                                   <Plus className="w-6 h-6 text-emerald-400" />
                                                 </div>
                                                 <div>
                                                    <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Staff Only</h4>
                                                    <p className="text-lg font-black text-white">Observações Internas</p>
                                                 </div>
                                              </div>

                                              {editingNoteId === booking.id ? (
                                                 <div className="space-y-4">
                                                    <Textarea 
                                                       value={noteText} 
                                                       onChange={e => setNoteText(e.target.value)} 
                                                       placeholder="Digite os detalhes importantes..." 
                                                       className="rounded-3xl border-white/10 focus:ring-emerald-500/20 min-h-[160px] text-sm font-medium p-6 bg-white/5 text-white placeholder:text-white/20 leading-relaxed shadow-inner" 
                                                    />
                                                    <div className="flex gap-3">
                                                       <Button onClick={() => { onAddNote(booking.id, noteText, booking.is_order); setEditingNoteId(null); }} className="flex-1 bg-emerald-500 text-emerald-950 font-black uppercase text-[10px] h-12 rounded-xl tracking-widest shadow-lg shadow-emerald-500/20">SALVAR NOTA</Button>
                                                       <Button onClick={() => setEditingNoteId(null)} variant="ghost" className="font-black uppercase text-[10px] px-6 h-12 rounded-xl tracking-widest text-white/40 hover:text-white hover:bg-white/5">CANCELAR</Button>
                                                    </div>
                                                 </div>
                                              ) : (
                                                 <div 
                                                   onClick={() => { setEditingNoteId(booking.id); setNoteText(booking.notes || ''); }} 
                                                   className="group/note cursor-pointer min-h-[160px] p-8 rounded-[2rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center transition-all hover:bg-white/5 hover:border-white/20 shadow-sm"
                                                 >
                                                   {booking.notes ? (
                                                     <div className="w-full text-center">
                                                       <p className="text-base font-medium text-emerald-100 italic leading-relaxed mb-4">"{booking.notes}"</p>
                                                       <div className="inline-flex items-center gap-2 text-[8px] font-black uppercase text-emerald-400 opacity-0 group-hover/note:opacity-100 transition-all tracking-[0.2em] bg-white/10 px-3 py-1 rounded-full">Clique para Editar</div>
                                                     </div>
                                                   ) : (
                                                     <div className="flex flex-col items-center gap-3">
                                                       <Plus className="w-8 h-8 text-white/20 group-hover/note:text-emerald-400 group-hover/note:scale-110 transition-all" />
                                                       <span className="text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">Clique para anotar</span>
                                                     </div>
                                                   )}
                                                 </div>
                                              )}
                                           </div>
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
