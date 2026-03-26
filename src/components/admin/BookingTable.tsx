import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, UserCheck, Phone, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/booking-types';
import { BookingDetail } from './BookingDetail';
import { Textarea } from '@/components/ui/textarea';

import { formatPhone } from '@/lib/utils/format';

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
  updatingId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  waiting_local: { label: 'Via WhatsApp', variant: 'outline', icon: Clock },
  confirmed: { label: 'Confirmada', variant: 'secondary', icon: CheckCircle },
  paid: { label: 'Pago', variant: 'secondary', icon: CheckCircle },
  'checked-in': { label: 'Check-in ✓', variant: 'default', icon: UserCheck },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
};

export function BookingTable({ bookings, onStatusChange, onAddNote, updatingId }: BookingTableProps) {
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
        const totalPeople = booking.adults + childrenCount;

        return (
          <div key={booking.id} className="border border-border rounded-lg bg-card overflow-hidden">
            {/* Row */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedId(expanded ? null : booking.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground truncate">{booking.name}</p>
                  {booking.confirmation_code && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                      <Hash className="w-3 h-3" />
                      {booking.confirmation_code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {booking.visit_date ? format(new Date(booking.visit_date + 'T12:00:00'), "dd/MM (EEE)", { locale: ptBR }) : 'Data pendente'}
                  {' · '}{totalPeople} pessoa(s)
                  {booking.phone && (
                    <span className="inline-flex items-center gap-0.5 ml-2">
                      <Phone className="w-3 h-3" />
                      {formatPhone(booking.phone)}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={config.variant} className="gap-1">
                  <StatusIcon className="w-3 h-3" />
                  <span className="hidden sm:inline">{config.label}</span>
                </Badge>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatCurrency(booking.total_amount)}
                </span>
                {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
              <div className="px-4 pb-4 space-y-3">
                <BookingDetail booking={booking} />

                {/* Notes */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
                  {editingNoteId === booking.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Adicionar observação..."
                        className="text-sm min-h-[60px]"
                        maxLength={500}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveNote(booking.id)}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteText(booking.notes || '');
                        setEditingNoteId(booking.id);
                      }}
                    >
                      {booking.notes || 'Clique para adicionar...'}
                    </button>
                  )}
                </div>

                {/* Check-in time */}
                {booking.checked_in_at && (
                  <p className="text-xs text-whatsapp font-medium">
                    ✅ Check-in às {format(new Date(booking.checked_in_at), "HH:mm", { locale: ptBR })}
                  </p>
                )}

                {/* Status actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {booking.status !== 'confirmed' && booking.status !== 'checked-in' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingId === booking.id}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'confirmed', booking.is_order); }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Confirmar
                    </Button>
                  )}
                  {booking.status !== 'checked-in' && (
                    <Button
                      size="sm"
                      disabled={updatingId === booking.id}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'checked-in', booking.is_order); }}
                      className="bg-whatsapp hover:bg-whatsapp/90"
                    >
                      <UserCheck className="w-4 h-4 mr-1" /> Check-in
                    </Button>
                  )}
                  {booking.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === booking.id}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(booking.id, 'cancelled', booking.is_order); }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
