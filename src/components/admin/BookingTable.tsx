import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, CheckCircle, XCircle, Clock, 
  UserCheck, Trash2, Plus, 
  Users, Calendar, Upload, FileCheck, Loader2,
  CalendarClock, StickyNote, CalendarRange,
  Search, Filter, MapPin, Phone, CreditCard, ChevronRight,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
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
      <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100/50 text-emerald-950/70 font-black animate-in fade-in zoom-in-95 duration-500 uppercase tracking-widest text-[10px]">
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
        {selectedIds.size > 0 && typeof document !== 'undefined' && createPortal(
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-8 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-12 duration-500 backdrop-blur-2xl">
             <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">Selecionados</span>
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
          </div>, document.body
        )}

        <div className="bg-transparent">
          {/* MOBILE CARDS VIEW */}
          <div className="md:hidden space-y-4 p-4 bg-slate-50/30">
             {bookings.map((booking) => {
                const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                const expanded = expandedId === booking.id;
                const bookingDate = parseISO(booking.visit_date || new Date().toISOString());
                const childrenCount = Array.isArray(booking.children) ? booking.children.length : (typeof booking.children === 'number' ? booking.children : 0);
                const totalPeople = (booking.adults || 0) + childrenCount;

                return (
                   <div key={booking.id} className={cn("p-4 space-y-4 mb-4 rounded-2xl border-2 border-emerald-100 shadow-sm", expanded ? "bg-emerald-50/30" : "bg-white")}>
                      <div className="flex items-center justify-between" onClick={() => setExpandedId(expanded ? null : booking.id)}>
                         <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1">
                               <Calendar className="w-3 h-3 text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md" />
                               <span className="text-[10px] font-black text-emerald-950 uppercase">{format(bookingDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                            <span className="text-base font-black text-emerald-950 uppercase tracking-tight leading-tight">
                               {booking.name || (booking as any).customer_name || 'CLIENTE GERAL'}
                            </span>
                         </div>
                         <div className="flex flex-col items-end gap-1.5">
                            <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md border text-[7px] font-black uppercase", config.bgColor, config.color, config.borderColor)}>
                               <StatusIcon className="w-2.5 h-2.5" />
                               {config.label}
                            </div>
                            <ChevronDown className={cn("w-5 h-5 text-emerald-200 transition-transform", expanded && "rotate-180 text-emerald-600")} />
                         </div>
                      </div>

                      {!expanded && (
                         <div className="flex items-center justify-between bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50">
                            <div className="flex items-center gap-2">
                               <Users className="w-3.5 h-3.5 text-emerald-700" />
                               <span className="text-xs font-black text-emerald-950">{totalPeople} Pessoas</span>
                            </div>
                            <span className="text-sm font-black text-emerald-600">{formatCurrency(booking.total_amount)}</span>
                         </div>
                      )}

                      {expanded && (
                         <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-white rounded-2xl p-4 shadow-inner border border-emerald-100/50 space-y-4">
                               <BookingDetail booking={booking} onRemoveReceipt={onRemoveReceipt} onRefresh={onRefresh} />
                               
                               <div className="space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">Pagamento / Comprovante</p>
                                  {onFileUpload && (
                                     <div className="flex flex-col gap-2">
                                        <input type="file" id={`m-up-${booking.id}`} className="hidden" onChange={e => e.target.files && onFileUpload(e.target.files[0], booking.id, !!booking.is_order)} />
                                        {booking.receipt_url ? (
                                           <div className="flex gap-2">
                                              <Button variant="outline" className="flex-1 h-10 rounded-xl bg-emerald-50 border-emerald-200 text-emerald-700 font-black text-[9px] uppercase" onClick={() => window.open(booking.receipt_url!)}>
                                                 <FileCheck className="w-3.5 h-3.5 mr-2" /> Ver Comprovante
                                              </Button>
                                              <Button variant="outline" className="w-10 h-10 rounded-xl bg-red-50 border-red-200 text-red-500 flex items-center justify-center" onClick={() => onRemoveReceipt?.(booking.id)}>
                                                 <Trash2 className="w-4 h-4" />
                                              </Button>
                                           </div>
                                        ) : (
                                           <label htmlFor={`m-up-${booking.id}`} className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-white border-2 border-dashed border-emerald-200 text-emerald-800 font-black text-[9px] uppercase cursor-pointer hover:bg-emerald-50 transition-all">
                                              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                              Anexar Comprovante
                                           </label>
                                        )}
                                     </div>
                                  )}
                               </div>
                               <div className="space-y-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">Ações e Controle</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                     <Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'paid', booking.is_order);}} className="bg-emerald-600 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm">Efetivar</Button>
                                      <Button onClick={(e) => {
                                         e.stopPropagation();
                                         const phone = booking.phone ? booking.phone.replace(/\D/g, '') : '';
                                         if (phone) {
                                             const codeStr = booking.confirmation_code ? '\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                             const linkStr = booking.confirmation_code ? '\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                             const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
                                             const amt = (booking.total_amount || 0).toFixed(2).replace('.', ',');
                                             const cname = booking.name || '';
                                             
                                             const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\n\n*Resumo da Reserva:*\nCliente: " + cname + "\nData: " + dtStr + "\nValor Total: R$ " + amt + codeStr + linkStr + "\n\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");
                                             window.open("https://wa.me/55" + phone + "?text=" + msg, '_blank');
                                         } else {
                                             alert('Telefone do cliente não encontrado!');
                                         }
                                      }} className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5"><FileCheck className="w-4 h-4" />Voucher</Button>
                                     <Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'checked-in', booking.is_order);}} className="bg-emerald-700 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm">Check-in</Button>
                                     <Button 
                                       variant="outline" 
                                       onClick={(e) => { e.stopPropagation(); setRescheduleId(rescheduleId === booking.id ? null : booking.id); setRescheduleDate(booking.visit_date || ''); }} 
                                       className={cn("h-10 rounded-xl text-[9px] font-black uppercase border-2 shadow-sm", rescheduleId === booking.id ? "bg-blue-600 text-white border-blue-700" : "border-blue-200 text-blue-700")}
                                     >Reagendar</Button>
                                     <Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, 'cancelled', booking.is_order);}} className="bg-amber-100 text-amber-700 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm border border-amber-200">Cancelar</Button>
                                  </div>
                                  
                                  {rescheduleId === booking.id && (
                                    <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-200 space-y-2 mt-2 animate-in slide-in-from-top-2">
                                       <p className="text-[8px] font-black uppercase text-blue-700">Nova Data:</p>
                                       <Popover>
                                          <PopoverTrigger asChild>
                                             <Button variant="outline" className="w-full h-10 justify-start text-xs font-bold bg-white border-blue-200 rounded-lg">
                                                <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                                                {rescheduleDate ? format(parseISO(rescheduleDate), 'dd/MM/yyyy') : 'Selecionar'}
                                             </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-2xl border-2 border-blue-100" align="center">
                                             <CalendarUI
                                               mode="single"
                                               selected={rescheduleDate ? parseISO(rescheduleDate) : undefined}
                                               onSelect={(date) => { if (date) setRescheduleDate(format(date, 'yyyy-MM-dd')); }}
                                               locale={ptBR}
                                               className="p-3"
                                               classNames={{
                                                  caption: "flex justify-center pt-1 relative items-center mb-2 bg-blue-600 rounded-lg py-2 text-white text-xs font-black uppercase",
                                                  nav_button: "h-6 w-6 bg-white/20 text-white rounded-md",
                                                  day_selected: "bg-blue-600 text-white font-black rounded-lg",
                                                  day_today: "bg-blue-100 text-blue-900 rounded-lg"
                                               }}
                                             />
                                          </PopoverContent>
                                       </Popover>
                                       <div className="flex gap-2">
                                          <Button disabled={!rescheduleDate} onClick={() => { onReschedule(booking.id, rescheduleDate, booking.is_order); setRescheduleId(null); }} className="flex-1 bg-blue-600 h-8 text-[8px] rounded-lg shadow-sm">Salvar</Button>
                                          <Button variant="ghost" onClick={() => setRescheduleId(null)} className="flex-1 h-8 text-[8px] rounded-lg">Sair</Button>
                                       </div>
                                    </div>
                                  )}
                               </div>
                            </div>
                         </div>
                      )}
                   </div>
                );
             })}
          </div>

          <div className="hidden md:block overflow-x-auto pb-10">
            <table className="w-full text-left border-separate border-spacing-y-3">
               <thead className="bg-[#0b2b24]">
                  <tr className="text-[10px] font-extrabold uppercase text-white tracking-widest">
                     <th className="p-5 w-14 text-center rounded-l-2xl">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === bookings.length && bookings.length > 0} 
                          onChange={toggleSelectAll} 
                          className="w-5 h-5 border-emerald-800 bg-emerald-900 shadow-sm cursor-pointer accent-emerald-500 rounded-md" 
                        />
                     </th>
                     <th className="p-5">Agenda / Operação</th>
                     <th className="p-5">Identificação Cliente</th>
                     <th className="p-5 text-center">Configuração</th>
                     <th className="p-5 text-right">Financeiro TOTAL</th>
                     <th className="p-5 text-center opacity-0 w-20 rounded-r-2xl">Ações</th>
                  </tr>
               </thead>
               <tbody className="bg-transparent">
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
                                      <Calendar className={cn("w-3.5 h-3.5", isToday(bookingDate) ? "text-emerald-600" : "text-emerald-700/60")} />
                                      <span className={cn(
                                        "text-[15px] font-black uppercase tracking-tight",
                                        isToday(bookingDate) ? "text-emerald-600" : "text-emerald-950"
                                      )}>
                                         {format(bookingDate, "dd/MM/yyyy", { locale: ptBR })}
                                      </span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest pl-6">
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
                                      <span className="bg-slate-100 text-slate-800 border-2 border-slate-200 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest">
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
                                   <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mt-0.5">Auditado OK</span>
                                </div>
                             </td>
                             <td className="p-5 text-center">
                                <Button size="icon" variant="ghost" className={cn(
                                  "h-12 w-12 rounded-2xl transition-all duration-300 border-2",
                                  expanded ? "bg-emerald-900 text-white border-emerald-950 rotate-180 shadow-lg" : "text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
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
                                                       <h4 className="text-[8px] font-black uppercase text-emerald-700/60 tracking-widest">Ações Rápidas</h4>
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
                                                   <Button 
                                                     onClick={(e) => {
                                                        e.stopPropagation();
                                                        const phone = booking.phone ? booking.phone.replace(/\D/g, '') : '';
                                                        if (phone) {
                                                            const codeStr = booking.confirmation_code ? '\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                                            const linkStr = booking.confirmation_code ? '\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                                            const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
                                                            const amt = (booking.total_amount || 0).toFixed(2).replace('.', ',');
                                                            const cname = booking.name || '';
                                                            
                                                            const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\n\n*Resumo da Reserva:*\nCliente: " + cname + "\nData: " + dtStr + "\nValor Total: R$ " + amt + codeStr + linkStr + "\n\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");
                                                            window.open("https://wa.me/55" + phone + "?text=" + msg, '_blank');
                                                        } else {
                                                            alert('Telefone não encontrado!');
                                                        }
                                                     }} 
                                                     className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
                                                   >
                                                      <FileCheck className="w-3.5 h-3.5" />
                                                      VOUCHER
                                                   </Button>
                                                 )}
                                              </div>
                                              
                                              {/* REAGENDAR Premium Calendar */}
                                              {rescheduleId === booking.id && (
                                                <div className="p-3 bg-blue-50/80 rounded-2xl border-2 border-blue-200 animate-in slide-in-from-top-2 duration-300 space-y-3">
                                                  <div className="flex items-center gap-2">
                                                     <CalendarRange className="w-4 h-4 text-blue-700 shrink-0" />
                                                     <p className="text-[9px] font-black uppercase text-blue-700 tracking-wider">Reagendar Reserva</p>
                                                  </div>
                                                  <div className="flex-1">
                                                     <Popover>
                                                       <PopoverTrigger asChild>
                                                         <Button 
                                                           variant="outline" 
                                                           className="w-full h-10 px-3 rounded-xl border border-blue-200 text-blue-950 font-bold text-sm bg-white hover:bg-blue-50 transition-all flex items-center justify-start gap-2"
                                                         >
                                                           <CalendarIcon className="w-4 h-4 text-blue-500" />
                                                           {rescheduleDate ? format(parseISO(rescheduleDate), 'dd/MM/yyyy') : 'Selecionar Nova Data'}
                                                         </Button>
                                                       </PopoverTrigger>
                                                       <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-2 border-blue-100 shadow-2xl" align="start">
                                                         <CalendarUI
                                                           mode="single"
                                                           selected={rescheduleDate ? parseISO(rescheduleDate) : undefined}
                                                           onSelect={(date) => { if (date) setRescheduleDate(format(date, 'yyyy-MM-dd')); }}
                                                           locale={ptBR}
                                                           className="p-3"
                                                           classNames={{
                                                             caption: "flex justify-center pt-1 relative items-center mb-2 bg-blue-600 rounded-xl py-3 border-2 border-blue-800 shadow-md w-full text-white text-xs font-black uppercase tracking-widest",
                                                             nav_button: "h-8 w-8 bg-white/20 text-white rounded-lg hover:bg-white/40 transition-all",
                                                             day_selected: "bg-blue-600 text-white font-black rounded-xl shadow-lg",
                                                             day_today: "bg-blue-100 text-blue-900 rounded-xl font-bold"
                                                           }}
                                                         />
                                                       </PopoverContent>
                                                     </Popover>
                                                  </div>
                                                  <div className="flex gap-2">
                                                    <Button
                                                      size="sm"
                                                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] h-9 px-4 rounded-xl shadow-sm"
                                                      disabled={!rescheduleDate}
                                                      onClick={() => { if (rescheduleDate) { onReschedule(booking.id, rescheduleDate, booking.is_order); setRescheduleId(null); setRescheduleDate(''); } }}
                                                    >Confirmar Novo Agendamento</Button>
                                                    <Button size="sm" variant="ghost" className="h-9 font-bold text-[9px]" onClick={() => { setRescheduleId(null); setRescheduleDate(''); }}>Voltar</Button>
                                                  </div>
                                                </div>
                                              )}

                                              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
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
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      const phone = booking.phone ? booking.phone.replace(/\D/g, '') : '';
                                                      if (phone) {
                                                          const codeStr = booking.confirmation_code ? '\n*Código do Voucher:* ' + booking.confirmation_code : '';
                                                          const linkStr = booking.confirmation_code ? '\n*Link do Voucher para Entrada:* https://reservas.balneariolessa.com.br/voucher/' + booking.confirmation_code : '';
                                                          const dtStr = booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '';
                                                          const amt = (booking.total_amount || 0).toFixed(2).replace('.', ',');
                                                          const cname = booking.name || '';
                                                          
                                                          const msg = encodeURIComponent("Olá! Sua reserva no Balneário Lessa foi *confirmada* e o pagamento foi *aprovado*! ✅\n\n*Resumo da Reserva:*\nCliente: " + cname + "\nData: " + dtStr + "\nValor Total: R$ " + amt + codeStr + linkStr + "\n\nApresente este voucher ou o link na portaria. Ficamos felizes em te receber!");
                                                          window.open("https://wa.me/55" + phone + "?text=" + msg, '_blank');
                                                      } else {
                                                          alert('Telefone não encontrado!');
                                                      }
                                                   }}
                                                   className="border-2 border-blue-300 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 bg-blue-50 font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm"
                                                 >
                                                    <FileCheck className="w-4 h-4" /> 
                                                    <span>VOUCHER</span>
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
                                              <StickyNote className="w-5 h-5 text-emerald-700" />
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
                                                    <Plus className="w-5 h-5 text-white/20 group-hover/note:text-emerald-700 transition-all" />
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
