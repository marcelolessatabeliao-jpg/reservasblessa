import { BookingState, KIOSK_INFO, QUAD_LABELS, QUAD_PRICES, ADDITIONAL_INFO, getQuadDiscount, formatCurrency, getPersonPrice } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { formatPhone } from '@/lib/utils/format';

export function buildWhatsAppMessage(booking: BookingState, total: number, isPrepay: boolean = false, code?: string, getPrice?: (type: string, fb: number) => number): string {
  const { entry } = booking;
  const safeGetPrice = getPrice || ((t: string, fb: number) => fb);
  const isSunday = entry.dayOfWeek === 'domingo';
  
  // Mensagem inicial com estilo premium
  let msg = `\uD83C\uDF0A *BALNE\u00C1RIO LESSA*\n`;
  msg += `Gostaria de confirmar uma reserva${isPrepay ? ' e j\u00E1 realizar o pagamento via Pix \uD83D\uDCA0' : ''}.\n\n`;

  if (code && isPrepay) {
    msg += `\u2705 *Confirma\u00E7\u00E3o:* Pago\n`;
    msg += `\uD83C\uDFAB *C\u00F3digo do Voucher:* ${code}\n`;
    msg += `\uD83D\uDD17 *Link do Voucher:* https://reservas.balneariolessa.com.br/voucher/${code}\n`;
    msg += `\uD83D\uDCCC *Pr\u00E9-reserva:* #${code}\n\n`;
  }

  msg += `*DADOS DO CLIENTE*\n`;
  if (entry.name) msg += `\uD83D\uDC64 *Nome:* ${entry.name}\n`;
  if (entry.phone) msg += `\uD83D\uDCF1 *Telefone:* ${formatPhone(entry.phone)}\n`;
  if (entry.visitDate) msg += `\uD83D\uDDD3\uFE0F *Data da Visita:* ${format(entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}\n`;
  msg += '\n';

  let paidAdultsStr = '';
  let paidChildrenStr = '';
  let freeItemsStr = '';

  if (entry.adults.length > 0) {
    entry.adults.forEach((a, i) => {
      const price = getPersonPrice(a, a.age >= 60, isSunday, safeGetPrice);
      const qty = a.quantity || 1;
      const totalItemPrice = price * qty;
      const amountPrefix = qty > 1 ? `${qty}x ` : '';
      
      let label = 'Adulto';
      let details = '';
      
      if (a.isTeacher) label = 'Professor';
      else if (a.isServer) label = 'Servidor P\u00FAblico';
      else if (a.isStudent) label = 'Estudante';
      else if ((a as any).isBloodDonor) label = 'Doador de Sangue/Medula';
      else if (a.isPCD) label = 'PCD/TEA';
      else if (a.isBirthday) label = 'Aniversariante';
      else if (a.takeDonation && !isSunday) details = ' (Ação Solidária)';
      else if (a.age >= 60) details = ' (Idoso)';

      if (price === 0) {
        freeItemsStr += `  ${amountPrefix}${label}${details} - Gr\u00E1tis\n`;
      } else {
        paidAdultsStr += `  ${amountPrefix}${label}${details} - ${formatCurrency(totalItemPrice)}\n`;
      }
    });
  }

  if (entry.children.length > 0) {
    entry.children.forEach((c, i) => {
      const qty = c.quantity || 1;
      const price = getPersonPrice(c, c.age <= 11, isSunday, safeGetPrice);
      const amountPrefix = qty > 1 ? `${qty}x ` : '';
      
      let details = '';
      if (c.isPCD) details = ' (PCD/TEA)';
      else if (c.isBirthday) details = ' (Aniversariante)';
      else if (c.takeDonation && !isSunday) details = ' (A\u00E7\u00E3o Solid\u00E1ria)';
      else if (c.isTeacher) details = ' (Professor)';
      else if (c.isServer) details = ' (Servidor)';
      else if (c.isStudent) details = ' (Estudante)';

      if (price === 0) {
        freeItemsStr += `  ${amountPrefix}Crian\u00E7a${details} - Gr\u00E1tis\n`;
      } else {
        paidChildrenStr += `  ${amountPrefix}Crian\u00E7a${details} - ${formatCurrency(price * qty)}\n`;
      }
    });
  }

  if (paidAdultsStr) {
    msg += `\uD83D\uDC65 *ADULTOS:*\n${paidAdultsStr}\n`;
  }
  if (paidChildrenStr) {
    msg += `\uD83E\uDDD2 *CRIAN\u00C7AS:*\n${paidChildrenStr}\n`;
  }
  if (freeItemsStr) {
    msg += `\uD83C\uDF81 *GRATUIDADES:*\n${freeItemsStr}\n`;
  }

  const activeKiosks = booking.kiosks.filter(k => k.quantity > 0);
  if (activeKiosks.length) {
    msg += `\u26FA *QUIOSQUE:*\n`;
    activeKiosks.forEach(k => {
      const basePrice = safeGetPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price);
      if (k.selectedIds && k.selectedIds.length > 0) {
        const ids = k.selectedIds.sort((a,b) => a-b).map(id => `N\u00BA ${String(id).padStart(2,'0')}`).join(', ');
        msg += `  ${ids} - ${formatCurrency(k.quantity * basePrice)}\n`;
      } else {
        msg += `  ${k.quantity} x ${KIOSK_INFO[k.type].label} - ${formatCurrency(k.quantity * basePrice)}\n`;
      }
    });
    msg += '\n';
  }

  const activeQuads = booking.quads.filter(q => q.quantity > 0);
  if (activeQuads.length) {
    msg += `\uD83D\uDE9C *QUADRICICLO:*\n`;
    activeQuads.forEach(q => {
      const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const d = q.date ? new Date(q.date) : null;
      const discount = getQuadDiscount(d);
      const basePrice = safeGetPrice(`quad_${q.type}`, fallbackMap[q.type]);
      const finalPrice = basePrice * (1 - discount);
      msg += `  ${q.quantity} x ${QUAD_LABELS[q.type]} - ${formatCurrency(q.quantity * finalPrice)}\n`;
      if (d) msg += `  \uD83D\uDCC5 Data: ${format(d, "dd/MM/yyyy", { locale: ptBR })}\n`;
      if (q.time) msg += `  \uD83D\uDD52 Hor\u00E1rio: ${q.time}\n`;
      if (discount > 0) msg += `  \uD83D\uDCC9 Desconto: ${discount * 100}%\n`;
    });
    msg += '\n';
  }

  const activeAdds = booking.additionals.filter(a => a.quantity > 0);
  if (activeAdds.length) {
    msg += `\u2728 *OUTROS SERVI\u00C7OS:*\n`;
    activeAdds.forEach(a => {
      const basePrice = safeGetPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price);
      msg += `  ${a.quantity} x ${ADDITIONAL_INFO[a.type].label} - ${formatCurrency(a.quantity * basePrice)}\n`;
    });
    msg += '\n';
  }

  msg += `\uD83D\uDCB0 *TOTAL DA RESERVA: ${formatCurrency(total)}*\n\nAguardo instru\u00E7\u00F5es para pagamento.`;
  return msg;
}
