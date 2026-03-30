import { BookingState, KIOSK_INFO, QUAD_LABELS, QUAD_PRICES, ADDITIONAL_INFO, getQuadDiscount, formatCurrency, getPersonPrice } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { formatPhone } from '@/lib/utils/format';

export function buildWhatsAppMessage(booking: BookingState, total: number, isPrepay: boolean = false, code?: string, getPrice?: (type: string, fb: number) => number): string {
  const { entry } = booking;
  const safeGetPrice = getPrice || ((t: string, fb: number) => fb);
  const isSunday = entry.dayOfWeek === 'domingo';
  // Removido o código do WhatsApp conforme solicitado pelo usuário para segurança (cliente só recebe após pagar).
  let msg = `Olá, Balneário Lessa!\nGostaria de confirmar uma reserva${isPrepay ? ' e já realizar o pagamento via Pix' : ''}.\n\n`;
  // O código e voucher só aparecem se JÁ for um processo de pré-pagamento confirmado ou se explicitamente solicitado.
  // Por padrão, para contato inicial, omitimos para que o cliente pague primeiro e receba o voucher depois.
  if (code && isPrepay) {
    msg += `*Confirmação:* Pago ✅\n`;
    msg += `*Código do Voucher:* ${code}\n`;
    msg += `*Link do Voucher:* https://reservas.balneariolessa.com.br/voucher/${code}\n`;
    msg += `*Pré-reserva:* #${code}\n`;
  }
  if (entry.name) msg += `*Nome:* ${entry.name}\n`;
  if (entry.phone) msg += `*Telefone:* ${formatPhone(entry.phone)}\n`;
  if (entry.visitDate) msg += `*Data da visita:* ${format(entry.visitDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}\n`;
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
      else if (a.isServer) label = 'Servidor Público';
      else if (a.isStudent) label = 'Estudante';
      else if ((a as any).isBloodDonor) label = 'Doador de Sangue/Medula';
      else if (a.isPCD) label = 'PCD/TEA';
      else if (a.isBirthday) label = 'Aniversariante';
      else if (a.takeDonation && !isSunday) details = ' (Ação Solidária)';
      else if (a.age >= 60) details = ' (Idoso)';

      if (price === 0) {
        freeItemsStr += `  ${amountPrefix}${label}${details} - Grátis\n`;
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
      else if (c.takeDonation && !isSunday) details = ' (Ação Solidária)';
      else if (c.isTeacher) details = ' (Professor)';
      else if (c.isServer) details = ' (Servidor)';
      else if (c.isStudent) details = ' (Estudante)';

      if (price === 0) {
        freeItemsStr += `  ${amountPrefix}Criança${details} - Grátis\n`;
      } else {
        paidChildrenStr += `  ${amountPrefix}Criança${details} - ${formatCurrency(price * qty)}\n`;
      }
    });
  }

  if (paidAdultsStr) {
    msg += '*Adultos:*\n' + paidAdultsStr + '\n';
  }
  if (paidChildrenStr) {
    msg += '*Crianças:*\n' + paidChildrenStr + '\n';
  }
  if (freeItemsStr) {
    msg += '*Gratuidades:*\n' + freeItemsStr + '\n';
  }

  const activeKiosks = booking.kiosks.filter(k => k.quantity > 0);
  if (activeKiosks.length) {
    msg += '*Quiosque:*\n';
    activeKiosks.forEach(k => {
      const basePrice = safeGetPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price);
      if (k.selectedIds && k.selectedIds.length > 0) {
        const ids = k.selectedIds.sort((a,b) => a-b).map(id => `Nº ${String(id).padStart(2,'0')}`).join(', ');
        msg += `  ${ids} - ${formatCurrency(k.quantity * basePrice)}\n`;
      } else {
        msg += `  ${k.quantity} x ${KIOSK_INFO[k.type].label} - ${formatCurrency(k.quantity * basePrice)}\n`;
      }
    });
    msg += '\n';
  }

  const activeQuads = booking.quads.filter(q => q.quantity > 0);
  if (activeQuads.length) {
    msg += '*Passeio de Quadriciclo:*\n';
    activeQuads.forEach(q => {
      const fallbackMap: Record<string, number> = { individual: 150, dupla: 250, 'adulto-crianca': 200 };
      const d = q.date ? new Date(q.date) : null;
      const discount = getQuadDiscount(d);
      const basePrice = safeGetPrice(`quad_${q.type}`, fallbackMap[q.type]);
      const finalPrice = basePrice * (1 - discount);
      msg += `${q.quantity} x ${QUAD_LABELS[q.type]} - ${formatCurrency(q.quantity * finalPrice)}\n`;
      if (d) msg += `  Data: ${format(d, "dd/MM/yyyy", { locale: ptBR })}\n`;
      if (q.time) msg += `  Horário: ${q.time}\n`;
      if (discount > 0) msg += `  Desconto: ${discount * 100}%\n`;
    });
    msg += '\n';
  }

  const activeAdds = booking.additionals.filter(a => a.quantity > 0);
  if (activeAdds.length) {
    msg += '*Serviços Adicionais:*\n';
    activeAdds.forEach(a => {
      const basePrice = safeGetPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price);
      msg += `${a.quantity} x ${ADDITIONAL_INFO[a.type].label} - ${formatCurrency(a.quantity * basePrice)}\n`;
    });
    msg += '\n';
  }

  msg += `*Total da Reserva:* ${formatCurrency(total)}\n\nAguardo instruções para pagamento.`;
  return msg;
}
