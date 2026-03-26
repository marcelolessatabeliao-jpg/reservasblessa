import { formatCurrency, KIOSK_INFO, QUAD_LABELS, ADDITIONAL_INFO } from '@/lib/booking-types';
import type { KioskType, QuadType, AdditionalService } from '@/lib/booking-types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BookingDetailProps {
  booking: {
    adults: number;
    children?: any;
    kiosks?: any;
    quads?: any;
    additionals?: any;
    has_donation?: boolean | null;
    is_associado?: boolean | null;
    total_amount: number;
    created_at: string;
  };
}

export function BookingDetail({ booking }: BookingDetailProps) {
  const children = Array.isArray(booking.children) ? booking.children : [];
  const kiosks = Array.isArray(booking.kiosks) ? booking.kiosks : [];
  const quads = Array.isArray(booking.quads) ? booking.quads : [];
  const additionals = Array.isArray(booking.additionals) ? booking.additionals : [];

  return (
    <div className="grid gap-3 text-sm p-4 bg-muted/50 rounded-lg">
      {/* Reserva criada em */}
      <p className="text-xs text-muted-foreground">
        Reserva feita em {booking.created_at ? format(new Date(booking.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não disponível'}
      </p>

      {/* Pessoas */}
      <div>
        <p className="font-semibold text-foreground mb-1">Pessoas</p>
        <p>{booking.adults} adulto(s)</p>
        {(Array.isArray(booking.children) ? booking.children.length > 0 : (Number(booking.children) > 0)) && (
          <p>
            {Array.isArray(booking.children) ? booking.children.length : booking.children} criança(s)
            {Array.isArray(booking.children) && booking.children.length > 0 && ': '}
            {Array.isArray(booking.children) && booking.children.map((c: any, i: number) => (
              <span key={i}>
                {c.age} anos{c.isStudent ? ' (estudante)' : ''}
                {i < (booking.children?.length ?? 0) - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="flex gap-2 flex-wrap">
        {booking.is_associado && <Badge variant="secondary">Associado</Badge>}
        {booking.has_donation && <Badge variant="outline">Doação 1kg</Badge>}
      </div>

      {/* Quiosques */}
      {kiosks.length > 0 && (
        <div>
          <p className="font-semibold text-foreground mb-1">Quiosques</p>
          {kiosks.map((k: any, i: number) => (
            <p key={i}>
              {KIOSK_INFO[k.type as KioskType]?.label || k.type} × {k.quantity}
            </p>
          ))}
        </div>
      )}

      {/* Quadriciclos */}
      {quads.length > 0 && (
        <div>
          <p className="font-semibold text-foreground mb-1">Quadriciclos</p>
          {quads.map((q: any, i: number) => (
            <p key={i}>
              {QUAD_LABELS[q.type as QuadType] || q.type} × {q.quantity}
              {q.time && ` — ${q.time}`}
            </p>
          ))}
        </div>
      )}

      {/* Adicionais */}
      {additionals.length > 0 && (
        <div>
          <p className="font-semibold text-foreground mb-1">Adicionais</p>
          {additionals.map((a: any, i: number) => (
            <p key={i}>
              {ADDITIONAL_INFO[a.type as AdditionalService]?.label || a.type} × {a.quantity}
            </p>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="pt-2 border-t border-border">
        <p className="font-bold text-foreground text-base">
          Total: {formatCurrency(booking.total_amount)}
        </p>
      </div>
    </div>
  );
}
