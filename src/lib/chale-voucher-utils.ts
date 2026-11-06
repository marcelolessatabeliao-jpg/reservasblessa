import { CHALE_PACKAGES } from '@/lib/booking-types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  buildChaleTermsAcceptanceRecord,
  CHALE_TERMS_VERSION,
  ChaleTermsAcceptanceRecord
} from '@/components/booking/ChaleTermsModal';

export interface ParsedChaleDetails {
  isHospedagem: boolean;
  chaleIds: number[];
  chaleLabel: string;
  packageTitle: string;
  packageType: string;
  checkInDateStr: string;
  checkInTime: string;
  checkOutDateStr: string;
  checkOutTime: string;
  occupancyLabel: string;
  adultsCount: number;
  childrenCount: number;
  adultsList: { label: string; name: string; chaleId: number }[];
  childrenList: { label: string; name: string; ageLabel: string; chaleId: number }[];
  chalePrice: number;
  chaleGrossPrice: number;
  termsAcceptance: ChaleTermsAcceptanceRecord;
  otherItems: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    timeSlot?: string;
    details?: string;
  }[];
}

export const DEMO_HOSPEDAGEM_ORDER = {
  id: 'cha89310-0000-4000-8000-000000008931',
  confirmation_code: 'CHA-8931',
  customer_name: 'Carlos Oliveira',
  customer_phone: '(69) 99341-2290',
  customer_cpf: '123.456.789-00',
  visit_date: '2026-11-06',
  total_amount: 1174.50,
  payment_method: 'PIX',
  status: 'paid',
  notes: 'Reserva online - 10% de desconto aplicado. Hospedagem Chalé 01 + Quiosque 02 + Quadriciclo Dupla.',
  created_at: '2026-11-06T10:00:00.000Z',
  is_demo: true,
  order_items: [
    {
      id: 'demo-item-chale-1',
      product_id: 'Chalé 01: Combo Sex a Dom (2 Noites)',
      product_name: 'Chalé 01 — Combo Sex a Dom (2 Noites • 10% OFF)',
      quantity: 1,
      unit_price: 909.00,
      total_price: 909.00,
      metadata: {
        package_type: 'combo-2n-sex-dom',
        package_title: 'Combo 2 Noites — Sexta a Domingo (10% OFF)',
        chale_id: 1,
        chale_ids: [1],
        chalets_count: 1,
        chale_occupancies: { 1: 'casal' },
        chale_kids: { 1: ['under11'] },
        adults: 2,
        children: 1,
        children_ages: ['under11'],
        guest_names: [
          'Carlos Oliveira',
          'Fernanda Oliveira',
          'Lucas Oliveira (8 anos)'
        ],
        check_in_date: '2026-11-06',
        check_in_time: '15:00',
        check_out_date: '2026-11-08',
        check_out_time: '12:00 (Day Use no parque até 17:00)',
        include_sunday_day_use: true,
        chale_gross_price: 1010.00,
        chale_net_price: 909.00
      }
    },
    {
      id: 'demo-item-kiosk-2',
      product_id: 'Quiosque 02',
      product_name: 'Quiosque 02 (Médio • Churrasqueira, Pia e Grelha)',
      quantity: 1,
      unit_price: 90.00,
      total_price: 90.00,
      metadata: {
        selectedIds: [2]
      }
    },
    {
      id: 'demo-item-quad-1',
      product_id: 'Quad De Dupla',
      product_name: 'Passeio de Quadriciclo — De Dupla (2 Pessoas)',
      quantity: 1,
      unit_price: 175.50,
      total_price: 175.50,
      metadata: {
        time_slot: '10:00',
        time: '10:00'
      }
    }
  ],
  quad_reservations: [
    {
      quad_type: 'dupla',
      time_slot: '10:00',
      quantity: 1
    }
  ]
};

export function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const clean = dateStr.split('T')[0];
    const parsed = parseISO(clean);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, "dd/MM/yyyy (EEEE)", { locale: ptBR });
    }
  } catch {
    // ignore
  }
  return dateStr;
}

export function formatShortDateSafe(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const clean = dateStr.split('T')[0];
    const parsed = parseISO(clean);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, "dd/MM/yyyy", { locale: ptBR });
    }
  } catch {
    // ignore
  }
  return dateStr;
}

export function formatCpfDisplay(cpf?: string | null): string {
  if (!cpf) return 'Não informado';
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }
  return String(cpf);
}

export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return 'Não informado';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return String(phone);
}

export function getLocalChaleOrdersForSearch(): any[] {
  const results: any[] = [DEMO_HOSPEDAGEM_ORDER];
  try {
    const raw = localStorage.getItem('lessa_admin_chale_reservations_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((res: any) => {
          if (!res || res.confirmationCode === 'CHA-8931') return;
          results.push({
            id: res.orderId || res.id || `local-${res.chaleId}`,
            confirmation_code: res.confirmationCode || `CHA-0${res.chaleId}`,
            customer_name: res.guestName || 'Hóspede Lessa',
            customer_phone: res.phone || '(69) 99341-2290',
            customer_cpf: res.cpf || '123.456.789-00',
            visit_date: res.checkInDate || '2026-11-06',
            total_amount: Number(res.totalPrice || 0),
            payment_method: res.paymentMethod || 'PIX',
            status: res.status || 'paid',
            notes: res.notes || 'Reserva de Hospedagem em Chalé',
            order_items: [
              {
                id: `local-item-${res.id}`,
                product_id: `Chalé ${String(res.chaleId || 1).padStart(2, '0')}: ${res.packageTitle || 'Hospedagem'}`,
                product_name: `Chalé ${String(res.chaleId || 1).padStart(2, '0')} — ${res.packageTitle || 'Hospedagem'}`,
                quantity: 1,
                unit_price: Number(res.totalPrice || 0),
                total_price: Number(res.totalPrice || 0),
                metadata: {
                  package_type: res.packageType || 'combo-2n-sex-dom',
                  package_title: res.packageTitle || 'Combo Final de Semana',
                  chale_id: Number(res.chaleId || 1),
                  chale_ids: [Number(res.chaleId || 1)],
                  chalets_count: 1,
                  chale_occupancies: { [Number(res.chaleId || 1)]: res.occupancyType || 'casal' },
                  adults: Number(res.adults || 2),
                  children: Number(res.children || 0),
                  guest_names: res.guestNames || [res.guestName || 'Titular do Chalé'],
                  check_in_date: res.checkInDate || '2026-11-06',
                  check_in_time: res.checkInTime || '15:00',
                  check_out_date: res.checkOutDate || '2026-11-08',
                  check_out_time: res.checkOutTime || '12:00'
                }
              }
            ]
          });
        });
      }
    }
  } catch {
    // ignore storage errors
  }
  return results;
}

export function extractChaleDetailsFromOrder(order: any): ParsedChaleDetails | null {
  if (!order || !Array.isArray(order.order_items)) return null;

  const chaleItem = order.order_items.find((item: any) => {
    const p = `${item.product_id || ''} ${item.product_name || ''}`.toLowerCase();
    return p.includes('chalé') || p.includes('chale') || p.includes('hospedagem');
  });

  if (!chaleItem) return null;

  let meta = chaleItem.metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  meta = meta || {};

  const chaleIds: number[] = Array.isArray(meta.chale_ids) && meta.chale_ids.length > 0
    ? meta.chale_ids.map(Number)
    : meta.chale_id
      ? [Number(meta.chale_id)]
      : [1];

  const chaleLabel = chaleIds.length > 1
    ? `Chalés ${chaleIds.map(id => String(id).padStart(2, '0')).join(', ')} (Alvenaria Tradicional)`
    : `Chalé ${String(chaleIds[0]).padStart(2, '0')} — Alvenaria Tradicional`;

  const pkgType = meta.package_type || 'combo-2n-sex-dom';
  const pkgDef = CHALE_PACKAGES[pkgType as keyof typeof CHALE_PACKAGES];
  const packageTitle = meta.package_title || (pkgDef ? pkgDef.title : (chaleItem.product_name || chaleItem.product_id || 'Pacote de Hospedagem'));

  const checkInDateStr = meta.check_in_date || order.visit_date || '';
  const checkInTime = meta.check_in_time || meta.check_in || '15:00';
  const checkOutDateStr = meta.check_out_date || '';
  const checkOutTime = meta.check_out_time || meta.check_out || '12:00 (Parque até 17:00)';

  const occupancies: Record<number, 'casal' | 'individual'> = meta.chale_occupancies || {};
  const kidsMap: Record<number, ('under11' | '12plus')[]> = meta.chale_kids || {};
  const childrenAges: ('under11' | '12plus')[] = Array.isArray(meta.children_ages) ? meta.children_ages : [];
  const rawNames: string[] = Array.isArray(meta.guest_names) ? meta.guest_names : [];

  const adultsCount = Number(meta.adults || chaleIds.reduce((acc, id) => acc + (occupancies[id] === 'individual' ? 1 : 2), 0) || 2);
  const childrenCount = Number(meta.children || childrenAges.length || 0);

  // Build structured Adults & Children lists with names
  const adultsList: { label: string; name: string; chaleId: number }[] = [];
  const childrenList: { label: string; name: string; ageLabel: string; chaleId: number }[] = [];

  let adultCursor = 0;
  let kidCursor = 0;

  chaleIds.forEach((cId) => {
    const mode = occupancies[cId] || (adultsCount === 1 && chaleIds.length === 1 ? 'individual' : 'casal');
    const cNum = String(cId).padStart(2, '0');

    // Adult 1
    const name1 = rawNames[adultCursor] || (adultCursor === 0 ? order.customer_name : `Hóspede Adulto ${adultCursor + 1}`);
    adultsList.push({
      label: `Adulto 1 • Titular (Chalé ${cNum})`,
      name: name1,
      chaleId: cId
    });
    adultCursor++;

    // Adult 2 if casal
    if (mode !== 'individual') {
      const name2 = rawNames[adultCursor] || `Acompanhante Adulto (Chalé ${cNum})`;
      adultsList.push({
        label: `Adulto 2 • Acompanhante (Chalé ${cNum})`,
        name: name2,
        chaleId: cId
      });
      adultCursor++;
    }

    // Children for this chalet
    const unitKids = kidsMap[cId] || (chaleIds.length === 1 ? childrenAges : []);
    if (Array.isArray(unitKids) && unitKids.length > 0) {
      unitKids.forEach((ageCode, kIdx) => {
        const kidName = rawNames[adultsCount + kidCursor] || `Criança ${kidCursor + 1}`;
        const ageLabel = ageCode === '12plus' ? '12+ anos' : 'Até 11 anos';
        childrenList.push({
          label: `Criança ${kIdx + 1} • Filho(a) (Chalé ${cNum})`,
          name: kidName,
          ageLabel,
          chaleId: cId
        });
        kidCursor++;
      });
    }
  });

  // Fallback if childrenCount > childrenList.length
  while (childrenList.length < childrenCount) {
    const idx = childrenList.length;
    const ageCode = childrenAges[idx] || 'under11';
    const kidName = rawNames[adultsCount + idx] || `Criança ${idx + 1}`;
    childrenList.push({
      label: `Criança ${idx + 1} • Filho(a) (Chalé ${String(chaleIds[0]).padStart(2, '0')})`,
      name: kidName,
      ageLabel: ageCode === '12plus' ? '12+ anos' : 'Até 11 anos',
      chaleId: chaleIds[0]
    });
  }

  const occupancyParts = chaleIds.map(id => {
    const m = occupancies[id] || (adultsCount === 1 && chaleIds.length === 1 ? 'individual' : 'casal');
    return chaleIds.length > 1
      ? `Chalé ${String(id).padStart(2, '0')}: ${m === 'individual' ? 'Individual (1 Adulto)' : 'Casal (2 Adultos)'}`
      : (m === 'individual' ? 'Individual (1 Adulto)' : 'Casal (2 Adultos)');
  });
  const occupancyLabel = `${occupancyParts.join(' · ')}${childrenCount > 0 ? ` + ${childrenCount} Criança(s)` : ''}`;

  const chalePrice = Number(meta.chale_net_price || chaleItem.unit_price || chaleItem.total_price || 0);
  const chaleGrossPrice = Number(meta.chale_gross_price || chalePrice);

  // Extract other items in the same reservation
  const otherItems = order.order_items
    .filter((i: any) => i !== chaleItem)
    .map((item: any) => {
      let iMeta = item.metadata;
      if (typeof iMeta === 'string') {
        try { iMeta = JSON.parse(iMeta); } catch { iMeta = {}; }
      }
      iMeta = iMeta || {};
      const qty = Number(item.quantity || 1);
      const uPrice = Number(item.unit_price || 0);
      const timeSlot = iMeta.time_slot || iMeta.time || order.quad_reservations?.[0]?.time_slot;
      return {
        name: item.product_name || item.product_id || 'Item Adicional',
        quantity: qty,
        unitPrice: uPrice,
        totalPrice: uPrice * qty,
        timeSlot
      };
    });

  // Extract or reconstruct Terms Acceptance Record
  let termsAcceptance: ChaleTermsAcceptanceRecord | null = meta.terms_acceptance || null;
  if (!termsAcceptance && typeof window !== 'undefined') {
    try {
      const codeKey = order.confirmation_code ? `lessa_terms_acceptance_${order.confirmation_code}` : null;
      const idKey = order.id ? `lessa_terms_acceptance_${order.id}` : null;
      const rawStored = (codeKey && localStorage.getItem(codeKey)) || (idKey && localStorage.getItem(idKey));
      if (rawStored) {
        termsAcceptance = JSON.parse(rawStored);
      }
    } catch {
      // ignore
    }
  }

  if (!termsAcceptance) {
    const fallbackDate = order.created_at ? new Date(order.created_at) : new Date('2026-11-06T10:00:00.000Z');
    termsAcceptance = buildChaleTermsAcceptanceRecord({
      guestName: order.customer_name || 'Hóspede Titular',
      guestCpf: order.customer_cpf || '',
      guestPhone: order.customer_phone || '',
      reservationCode: order.confirmation_code || String(order.id || '').slice(0, 8).toUpperCase(),
      orderId: String(order.id || ''),
      acceptedAt: isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate,
    });
  } else {
    termsAcceptance = {
      ...termsAcceptance,
      termsVersion: termsAcceptance.termsVersion || CHALE_TERMS_VERSION,
      reservationCode: termsAcceptance.reservationCode || order.confirmation_code || String(order.id || '').slice(0, 8).toUpperCase(),
      orderId: termsAcceptance.orderId || String(order.id || ''),
    };
  }

  return {
    isHospedagem: true,
    chaleIds,
    chaleLabel,
    packageTitle,
    packageType: pkgType,
    checkInDateStr,
    checkInTime,
    checkOutDateStr,
    checkOutTime,
    occupancyLabel,
    adultsCount,
    childrenCount,
    adultsList,
    childrenList,
    chalePrice,
    chaleGrossPrice,
    termsAcceptance,
    otherItems
  };
}
