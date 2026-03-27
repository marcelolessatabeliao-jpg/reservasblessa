import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, UserCheck, Phone, Hash, MessageCircle, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';
import { BookingDetail } from './BookingDetail';
import { Textarea } from '@/components/ui/textarea';

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

  return (
    <div className="space-y-3">
      {bookings.map((booking) => {
        const expanded = expandedId === booking.id;
        const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;
        const childrenCount = Array.isArray(booking.children) ? booking.children.length : (typeof booking.children === 'number' ? booking.children : 0);
        const totalPeople = (booking.adults || 0) + childrenCount;

        return (
          <div key={booking.id} className="border border-border rounded-[1.5rem] bg-card overflow-hidden shadow-sm hover:shadow-md transition-all">
            {/* Row */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expanded ? null : booking.id)}
            >
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
                       <Button size="sm" variant="ghost" className="bg-white/50 hover:bg-white border-2 border-dashed border-whatsapp/20 h-14 rounded-xl text-whatsapp-dark font-black text-[10px] uppercase flex flex-col leading-tight">
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
    </div>
  );
}
