import { BookingState, KIOSK_INFO, QUAD_LABELS, QUAD_PRICES, ADDITIONAL_INFO, CHALE_PACKAGES, CAMPING_PRICE_PER_PERSON, getQuadDiscount, formatCurrency, getPersonPrice, isSundayOrHoliday, calculateChaleTotal } from '@/lib/booking-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseToRODate } from '@/utils/date-utils';
import { formatPhone } from '@/lib/utils/format';

export function buildWhatsAppMessage(
  booking: BookingState, 
  total: number, 
  isPrepay: boolean = false, 
  code?: string, 
  getPrice?: (type: string, fb: number) => number,
  subtotal?: number,
  discount?: number
): string {
  const { entry } = booking;
  const safeGetPrice = getPrice || ((t: string, fb: number) => fb);
  const isSunday = entry.dayOfWeek === 'domingo' || isSundayOrHoliday(entry.visitDate);
  
  // Mensagem inicial com estilo premium usando emojis literais para garantir compatibilidade
  let msg = `🌿 *BALNEÁRIO FAMÍLIA LESSA*\n`;
  msg += `Gostaria de confirmar uma reserva${isPrepay ? ' e já realizar o pagamento via Pix \u{1F48E}' : ''}.\n\n`;

  if (code && isPrepay) {
    msg += `\u{2705} *Confirmação:* Pago\n`;
    msg += `\u{1F3AB} *Código do Voucher:* ${code}\n`;
    msg += `\u{1F517} *Link do Voucher:* https://reservas.balneariolessa.com.br/voucher/${code}\n`;
    msg += `\u{1F4CD} *Pré-reserva:* #${code}\n\n`;
  }

  msg += `*DADOS DO CLIENTE*\n`;
  if (entry.name) msg += `👤 *Nome:* ${entry.name}\n`;
  if (entry.phone) msg += `\u{1F4F1} *Telefone:* ${formatPhone(entry.phone)}\n`;
  if (entry.visitDate) msg += `\u{1F5D3}\u{FE0F} *Data da Visita:* ${format(parseToRODate(entry.visitDate), "dd/MM/yyyy (EEEE)", { locale: ptBR })}\n`;
  msg += '\n';

  let paidAdultsStr = '';
  let paidChildrenStr = '';
  let freeItemsStr = '';
  let counterItemsStr = '';

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

      if ((a as any).isCounterPayment) {
        counterItemsStr += `  ${amountPrefix}Entradas no Balcão - R$ 50,00 cada (a pagar na bilheteria)\n`;
      } else if (price === 0) {
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
      else if (c.isServer) details = ' (Servidor Público)';
      else if (c.isStudent) details = ' (Estudante)';

      if (price === 0) {
        freeItemsStr += `  ${amountPrefix}Criança${details} - Grátis\n`;
      } else {
        paidChildrenStr += `  ${amountPrefix}Criança${details} - ${formatCurrency(price * qty)}\n`;
      }
    });
  }

  if (paidAdultsStr) {
    msg += `\u{1F465} *ADULTOS (PAGAMENTO ONLINE):*\n${paidAdultsStr}\n`;
  }
  if (paidChildrenStr) {
    msg += `\u{1F9D2} *CRIANÇAS:*\n${paidChildrenStr}\n`;
  }
  if (counterItemsStr) {
    msg += `💵 *ENTRADAS NO BALCÃO (PAGAR NA BILHETERIA):*\n${counterItemsStr}  ⚠️ *Aviso:* Sem desconto online. Cobrado o valor normal de R$ 50,00 por entrada no balcão.\n\n`;
  }
  if (freeItemsStr) {
    msg += `\u{1F381} *GRATUIDADES:*\n${freeItemsStr}\n`;
  }

  const activeKiosks = booking.kiosks.filter(k => k.quantity > 0);
  if (activeKiosks.length) {
    msg += `\u{1F3AA} *QUIOSQUES:*\n`;
    activeKiosks.forEach(k => {
      const basePrice = safeGetPrice(`kiosk_${k.type}`, KIOSK_INFO[k.type].price);
      if (k.selectedIds && k.selectedIds.length > 0) {
        const idsWithObs = k.selectedIds.sort((a,b) => a-b).map(id => {
          const label = `Nº ${String(id).padStart(2,'0')}`;
          if (id >= 6 && id <= 8) return `${label} (Lado da Cachoeira)`;
          return label;
        }).join(', ');
        msg += `  ${idsWithObs} - ${formatCurrency(k.quantity * basePrice)}\n`;
      } else {
        msg += `  ${k.quantity} x ${KIOSK_INFO[k.type].label} - ${formatCurrency(k.quantity * basePrice)}\n`;
      }
    });
    msg += '\n';
  }

  const activeQuads = booking.quads.filter(q => q.quantity > 0);
  if (activeQuads.length) {
    msg += `\u{1F69C} *QUADRICICLOS:*\n`;
    activeQuads.forEach(q => {
      const fallbackMap: Record<string, number> = { individual: 130, dupla: 195, 'adulto-crianca': 195 };
      const d = q.date ? parseToRODate(q.date) : null;
      const discount = getQuadDiscount(d);
      const basePrice = safeGetPrice(`quad_${q.type}`, fallbackMap[q.type]);
      const finalPrice = basePrice * (1 - discount);
      msg += `  ${q.quantity} x ${QUAD_LABELS[q.type]} - ${formatCurrency(q.quantity * finalPrice)}\n`;
      if (d) msg += `  📅 Data: ${format(d, "dd/MM/yyyy", { locale: ptBR })}\n`;
      if (q.time) msg += `  \u{1F552} Horário: ${q.time}\n`;
      if (discount > 0) msg += `  \u{1F4C9} Desconto: ${Math.round(discount * 100)}%\n`;
    });
    msg += '\n';
  }

  const activeAdds = booking.additionals.filter(a => a.quantity > 0);
  if (activeAdds.length) {
    msg += `✨ *OUTROS SERVIÇOS:*\n`;
    activeAdds.forEach(a => {
      const basePrice = safeGetPrice(`add_${a.type}`, ADDITIONAL_INFO[a.type].price);
      msg += `  ${a.quantity} x ${ADDITIONAL_INFO[a.type].label} - ${formatCurrency(a.quantity * basePrice)}\n`;
    });
    msg += '\n';
  }

  // Hospedagem (Chalés)
  const activeChaleIds = (booking.chale?.chaleIds && booking.chale.chaleIds.length > 0)
    ? booking.chale.chaleIds
    : (booking.chale?.chaleId ? [booking.chale.chaleId] : []);
  if (booking.chale && booking.chale.packageType && activeChaleIds.length > 0) {
    const pkg = CHALE_PACKAGES[booking.chale.packageType];
    if (pkg) {
      const chaletsCount = activeChaleIds.length;
      const adults = Math.max(1, booking.chale.adultsCount || (chaletsCount * 2));
      const kids = booking.chale.childrenCount || 0;
      const totalChale = calculateChaleTotal(
        booking.chale.packageType,
        adults,
        kids,
        safeGetPrice,
        booking.chale.includeSundayDayUse,
        chaletsCount,
        booking.chale.checkInDate,
        booking.chale.checkOutDate,
        booking.chale.chaleOccupancies,
        activeChaleIds,
        booking.chale.childrenAges
      );

      msg += `🏡 *HOSPEDAGEM - CHALÉ:*\n`;
      msg += `  ${pkg.title}\n`;
      activeChaleIds.forEach(id => {
        const mode = (booking.chale.chaleOccupancies?.[id] || 'casal') === 'individual' ? 'Individual (1 Adulto)' : 'Casal (2 Adultos)';
        msg += `  🚪 Chalé ${String(id).padStart(2, '0')}: Modalidade ${mode}\n`;
      });
      if (kids > 0) {
        msg += `  👶 Adicionais: ${kids} Criança(s)\n`;
      }
      if (booking.chale.guestNames && booking.chale.guestNames.length > 0) {
        const filled = booking.chale.guestNames
          .map((n, i) => `${i + 1}. ${n.trim()}`)
          .filter(n => n.length > 3);
        if (filled.length > 0) {
          msg += `  📋 Hóspedes para Check-in:\n    ${filled.join('\n    ')}\n`;
        }
      }
      msg += `  💵 Valor Hospedagem: ${formatCurrency(totalChale)}\n\n`;
    }
  }

  // Camping
  if (booking.camping && (booking.camping.peopleCount > 0 || (booking.camping.adultsCount || 0) > 0)) {
    const payingAdults = booking.camping.adultsCount !== undefined ? booking.camping.adultsCount : booking.camping.peopleCount;
    const campingPrice = safeGetPrice('camping_per_person', CAMPING_PRICE_PER_PERSON);
    const totalCamping = payingAdults * campingPrice;
    msg += `⛺ *ÁREA DE CAMPING (PERNOITE):*\n`;
    msg += `  ${payingAdults} adulto(s) pagante(s) x ${formatCurrency(campingPrice)} = ${formatCurrency(totalCamping)}\n`;
    if ((booking.camping.childrenCount || 0) > 0) {
      msg += `  👶 ${booking.camping.childrenCount} criança(s) até 11 anos: Grátis\n`;
    }
    if ((booking.camping.seniorsCount || 0) > 0) {
      msg += `  🧓 ${booking.camping.seniorsCount} idoso(s) 60+: Grátis\n`;
    }
    msg += `  ☀️ Day use do dia seguinte incluso no balneário\n`;
    msg += `  ☕ Café da manhã NÃO incluso no camping\n`;
    msg += `  🔌 Permitido uso de banheiros e tomadas dos quiosques após 17h\n`;
    msg += `  🏕️ Barracas e equipamentos por conta do cliente\n`;
    msg += `  🍽️ Sem fornecimento de alimentação após 17h\n\n`;
  }

  if (discount && discount > 0) {
    const rawSubtotal = subtotal || (total + discount);
    msg += `📋 *Subtotal itens do site:* ${formatCurrency(rawSubtotal)}\n`;
    msg += `🏷️ *Desconto Reserva Online (10% OFF nos itens do site):* -${formatCurrency(discount)}\n`;
    msg += `💰 *TOTAL A PAGAR PELO SITE: ${formatCurrency(total)}*\n\n`;
  } else {
    msg += `💰 *TOTAL A PAGAR PELO SITE: ${formatCurrency(total)}*\n\n`;
  }
  if (counterItemsStr) {
    msg += `📌 *Lembrete:* As entradas no balcão serão pagas diretamente na bilheteria física pelo valor normal (sem desconto).\n\n`;
  }
  msg += `Aguardo instruções para pagamento.`;
  return msg;
}
