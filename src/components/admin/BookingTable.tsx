import React, { useState } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, CheckCircle, XCircle, Clock, 
  UserCheck, Trash2, Plus, 
  Users, Calendar, Upload, FileCheck, Loader2,
  CalendarClock, StickyNote, CalendarRange
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
  onRemoveReceipt?: (bookingId: string) => void;
  onRefresh?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  pending: { label: 'PENDENTE', variant: 'outline', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  waiting_local: { label: 'WHATSAPP', variant: 'outline', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  paid: { label: 'PAGO OK', variant: 'secondary', icon: CheckCircle, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  'checked-in': { label: 'CHECK-IN ✓', variant: 'default', icon: UserCheck, color: 'text-white', bgColor: 'bg-emerald-600', borderColor: 'border-emerald-700' },
  cancelled: { label: 'CANCELADA', variant: 'destructive', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

export function BookingTable({ bookings, onStatusChange, onAddNote, onReschedule, onDelete, onRemoveItem, updatingId, onFileUpload, isUploading, onRemoveReceipt, onRefresh }: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100/50 text-emerald-900/40 font-black animate-in fade-in zoom-in-95 duration-500 uppercase tracking-widest text-[10px]">
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
    <div className="space-y-6 relative pb-20">
        {selectedIds.size > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-8 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-12 duration-500 backdrop-blur-2xl">
             <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">Selecionados</span>
               <span className="text-xl font-black tabular-nums">{selectedIds.size}</span>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <div className="flex gap-2">
                <Button onClick={() => handleBulkAction('confirm')} className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider">Confirmar</Button>
                <Button onClick={() => handleBulkAction('cancel')} className="bg-amber-500 hover:bg-amber-400 text-white font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider">Cancelar</Button>
                <Button onClick={() => handleBulkAction('delete')} variant="ghost" className="text-red-400 hover:text-red-100 font-bold text-[10px] h-10 px-4 rounded-xl uppercase">Excluir</Button>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-white/40 font-bold uppercase text-[9px] px-4 h-10 rounded-xl">Limpar</Button>
          </div>
        )}

        <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-emerald-100/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead className="bg-[#0b2b24]">
                  <tr className="text-[10px] font-extrabold uppercase text-emerald-400/80 tracking-widest border-b border-white/5">
                     <th className="p-5 w-14 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === bookings.length && bookings.length > 0} 
                          onChange={toggleSelectAll} 
                          className="w-5 h-5 rounded-lg border-emerald-800 bg-emerald-900 shadow-sm cursor-pointer accent-emerald-500" 
                        />
                     </th>
                     <th className="p-5">Agenda / Operação</th>
                     <th className="p-5">Identificação Cliente</th>
                     <th className="p-5 text-center">Configuração</th>
                     <th className="p-5 text-right">Financeiro TOTAL</th>
                     <th className="p-5 text-center opacity-0 w-20">Ações</th>
                  </tr>
               </thead>
               <tbody className="divide-y-4 divide-emerald-100 bg-slate-50/30">
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
                              isSelected ? "bg-emerald-100/50" : "bg-white hover:bg-emerald-50",
                              expanded && "bg-emerald-100/30 shadow-inner"
                            )}
                          >
                             <td className="p-5 text-center">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  onClick={(e) => toggleSelect(booking.id, e)} 
                                  onChange={() => {}} 
                                  className="w-5 h-5 rounded-lg border-emerald-200 bg-white cursor-pointer accent-emerald-600" 
                                />
                             </td>
                             <td className="p-5">
                                <div className="space-y-1 min-w-[130px]">
                                   <div className="flex items-center gap-2">
                                      <Calendar className={cn("w-3.5 h-3.5", isToday(bookingDate) ? "text-emerald-600" : "text-emerald-900/30")} />
                                      <span className={cn(
                                        "text-[13px] font-bold uppercase tracking-tight",
                                        isToday(bookingDate) ? "text-emerald-600" : "text-emerald-950"
                                      )}>
                                         {format(bookingDate, "dd/MM/yyyy", { locale: ptBR })}
                                      </span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-emerald-900/40 uppercase tracking-widest pl-5">
                                         {format(bookingDate, "EEEE", { locale: ptBR })}
                                      </span>
                                   </div>
                                   <div className="pl-5 pt-1">
                                      <div className={cn(
                                        "flex items-center gap-1.5 font-extrabold uppercase text-[8px] tracking-wider w-fit px-2 py-0.5 rounded-md border shadow-sm",
                                        config.bgColor, config.color, config.borderColor
                                      )}>
                                         <StatusIcon className="w-2.5 h-2.5" />
                                         <span>{config.label}</span>
                                      </div>
                                   </div>
                                </div>
                             </td>
                             <td className="p-5">
                                <div className="flex flex-col gap-0.5">
                                   <span className="font-extrabold text-lg text-emerald-950 uppercase tracking-tight leading-tight group-hover:text-emerald-600 transition-colors">
                                     {booking.name || (booking as any).customer_name || 'CLIENTE GERAL'}
                                   </span>
                                   <div className="flex items-center gap-2">
                                      <span className="bg-emerald-50/50 text-emerald-800/40 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold text-[8px] uppercase tracking-widest">
                                         ID: {booking.id.slice(0, 8)}
                                      </span>
                                      {booking.is_associado && (
                                        <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] font-black uppercase px-2 h-4 rounded-full">Sócio</Badge>
                                      )}
                                   </div>
                                </div>
                             </td>
                             <td className="p-5 text-center">
                                <div className="inline-flex flex-col items-center justify-center bg-emerald-50 border-2 border-emerald-300 w-20 h-20 rounded-2xl shadow-sm group-hover:border-emerald-500 group-hover:scale-105 transition-all">
                                   <Users className="w-5 h-5 text-emerald-700 mb-1" />
                                   <span className="text-3xl font-black text-emerald-950 leading-none">{totalPeople}</span>
                                   <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mt-1">Pessoas</span>
                                </div>
                             </td>
                             <td className="p-5 text-right">
                                <div className="flex flex-col items-end">
                                   <span className="text-2xl font-extrabold text-emerald-600 tracking-tighter">{formatCurrency(booking.total_amount)}</span>
                                   <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Auditado OK</span>
                                </div>
                             </td>
                             <td className="p-5 text-center">
                                <Button size="icon" variant="ghost" className={cn(
                                  "h-12 w-12 rounded-2xl transition-all duration-300 border-2",
                                  expanded ? "bg-emerald-900 text-white border-emerald-950 rotate-180 shadow-lg" : "text-emerald-400 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                )}>
                                   <ChevronDown className="w-6 h-6" />
                                </Button>
                             </td>
                          </tr>
                          
                          {expanded && (
                             <tr className="border-x-4 border-emerald-200">
                                <td colSpan={6} className="p-0 bg-white border-y-4 border-emerald-200 shadow-2xl">
                                  <div className="p-6 space-y-6 animate-in slide-in-from-top-4 duration-500">
                                     <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100">
                                        <BookingDetail booking={booking} onRemoveReceipt={onRemoveReceipt} onRefresh={onRefresh} />
                                     </div>
                                     
                                     <div className="grid lg:grid-cols-2 gap-6 items-stretch">
                                  <div className="bg-white p-6 rounded-3xl shadow-lg border border-emerald-100 flex flex-col justify-between space-y-6 relative overflow-hidden group">
                                           <div className="relative z-10 space-y-6">
                                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-50 pb-4">
                                                 <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                                                      <CalendarClock className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                       <h4 className="text-[8px] font-black uppercase text-emerald-900/30 tracking-widest">Ações Rápidas</h4>
                                                       <p className="text-base font-extrabold text-emerald-950">Controle de Reserva</p>
                                                    </div>
                                                 </div>

                                                  {onFileUpload && (
                                                   <div className="flex items-center gap-2">
                                                      <input type="file" id={`upload-${booking.id}`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                                      <label htmlFor={`upload-${booking.id}`} className={cn(
                                                         "flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95",
                                                         booking.receipt_url 
                                                           ? "bg-emerald-600 border border-emerald-700 text-white" 
                                                           : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-800"
                                                      )}>
                                                         {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : booking.receipt_url ? <FileCheck className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                                                         {booking.receipt_url ? 'PAGO ✓' : 'ANEXAR COMPROVANTE'}
                                                      </label>
                                                   </div>
                                                 )}
                                              </div>
                                              
                                              {/* REAGENDAR inline input */}
                                              {rescheduleId === booking.id && (
                                                <div className="flex items-center gap-3 p-3 bg-blue-50/80 rounded-2xl border-2 border-blue-200 animate-in slide-in-from-top-2 duration-300">
                                                  <CalendarRange className="w-4 h-4 text-blue-700 shrink-0" />
                                                  <div className="flex-1">
                                                    <p className="text-[9px] font-black uppercase text-blue-700 tracking-wider mb-1">Nova Data</p>
                                                    <input
                                                      type="date"
                                                      className="w-full h-9 px-3 rounded-xl border border-blue-200 text-blue-950 font-bold text-sm bg-white focus:outline-blue-400"
                                                      value={rescheduleDate}
                                                      onChange={e => setRescheduleDate(e.target.value)}
                                                    />
                                                  </div>
                                                  <div className="flex gap-2">
                                                    <Button
                                                      size="sm"
                                                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] h-9 px-4 rounded-xl"
                                                      onClick={() => { if (rescheduleDate) { onReschedule(booking.id, rescheduleDate, booking.is_order); setRescheduleId(null); setRescheduleDate(''); } }}
                                                    >Confirmar</Button>
                                                    <Button size="sm" variant="ghost" className="h-9 font-bold text-[9px]" onClick={() => { setRescheduleId(null); setRescheduleDate(''); }}>Cancelar</Button>
                                                  </div>
                                                </div>
                                              )}

                                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'paid', booking.is_order)} 
                                                   disabled={booking.status === 'paid' || updatingId === booking.id} 
                                                   className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 border border-emerald-700 text-white font-bold uppercase text-[9px] h-12 rounded-xl shadow-sm flex flex-col items-center justify-center gap-0.5 transition-all"
                                                 >
                                                    <CheckCircle className="w-4 h-4" /> 
                                                    <span>EFETIVAR</span>
                                                 </Button>
                                                 
                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'checked-in', booking.is_order)} 
                                                   className={cn(
                                                     "border-2 font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm",
                                                     booking.status === 'checked-in' 
                                                       ? "bg-emerald-700 border-emerald-800 text-white" 
                                                       : "bg-white border-emerald-500 text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                                   )}
                                                 >
                                                    <UserCheck className="w-4 h-4" /> 
                                                    <span>CHECK-IN</span>
                                                 </Button>

                                                 <Button 
                                                   variant="outline" 
                                                   onClick={(e) => { e.stopPropagation(); setRescheduleId(rescheduleId === booking.id ? null : booking.id); setRescheduleDate(booking.visit_date || ''); }} 
                                                   className={cn(
                                                     "border-2 font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm",
                                                     rescheduleId === booking.id
                                                       ? "bg-blue-600 text-white border-blue-700"
                                                       : "border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-white"
                                                   )}
                                                 >
                                                    <CalendarRange className="w-4 h-4" /> 
                                                    <span>REAGENDAR</span>
                                                 </Button>

                                                 <Button 
                                                   onClick={() => onStatusChange(booking.id, 'cancelled', booking.is_order)} 
                                                   className="border-2 border-amber-300 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 bg-white font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                                                 >
                                                    <XCircle className="w-4 h-4" /> 
                                                    <span>CANCELAR</span>
                                                 </Button>

                                                 <Button 
                                                   onClick={(e) => { e.stopPropagation(); if (confirm('DELETAR AGORA? Esta ação não pode ser desfeita.')) onDelete(booking.id, booking.is_order); }} 
                                                   className="border-2 border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 bg-white font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                                                 >
                                                    <Trash2 className="w-4 h-4" /> 
                                                    <span>EXCLUIR</span>
                                                 </Button>
                                              </div>
                                           </div>
                                        </div>

                                        <div className="bg-emerald-950 text-white p-6 rounded-3xl shadow-lg border border-emerald-900 flex flex-col space-y-4">
                                           <div className="flex items-center gap-3">
                                              <StickyNote className="w-5 h-5 text-emerald-400" />
                                              <p className="text-sm font-extrabold uppercase tracking-widest text-white/40">Notas Internas</p>
                                           </div>

                                           {editingNoteId === booking.id ? (
                                              <div className="space-y-4">
                                                 <Textarea 
                                                    value={noteText} 
                                                    onChange={e => setNoteText(e.target.value)} 
                                                    placeholder="Anotações para a equipe..." 
                                                    className="rounded-2xl border-white/10 focus:ring-emerald-500/20 min-h-[100px] text-xs font-medium p-4 bg-white/5 text-white placeholder:text-white/20 shadow-inner" 
                                                 />
                                                 <div className="flex gap-2">
                                                    <Button onClick={() => { onAddNote(booking.id, noteText, booking.is_order); setEditingNoteId(null); }} className="flex-1 bg-emerald-500 text-emerald-950 font-bold uppercase text-[9px] h-10 rounded-xl tracking-wider">Salvar</Button>
                                                    <Button onClick={() => setEditingNoteId(null)} variant="ghost" className="font-bold uppercase text-[9px] px-4 h-10 rounded-xl text-white/40">Cancelar</Button>
                                                 </div>
                                              </div>
                                           ) : (
                                              <div 
                                                onClick={() => { setEditingNoteId(booking.id); setNoteText(booking.notes || ''); }} 
                                                className="group/note cursor-pointer min-h-[100px] p-4 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center transition-all hover:bg-white/5"
                                              >
                                                {booking.notes ? (
                                                  <div className="w-full text-center">
                                                    <p className="text-xs font-medium text-emerald-100 italic leading-relaxed">"{booking.notes}"</p>
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col items-center gap-2">
                                                    <Plus className="w-5 h-5 text-white/20 group-hover/note:text-emerald-400 transition-all" />
                                                    <span className="text-[8px] font-bold uppercase text-white/20 tracking-widest">Nova Anotação</span>
                                                  </div>
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
