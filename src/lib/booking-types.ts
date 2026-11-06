import { parseToRODate } from '@/utils/date-utils';
import { format } from 'date-fns';

export interface AdultInfo {
  quantity?: number;
  age: number;
  takeDonation?: boolean;
  isTeacher?: boolean;
  isServer?: boolean;
  isStudent?: boolean;
  isBloodDonor?: boolean;
  isPCD?: boolean;
  isTEA?: boolean;
  isBirthday?: boolean;
  isMember?: boolean;
  isCounterPayment?: boolean;
}

export interface ChildInfo {
  quantity?: number;
  age: number;
  takeDonation?: boolean;
  isTeacher?: boolean;
  isServer?: boolean;
  isStudent?: boolean;
  isBloodDonor?: boolean;
  isPCD?: boolean;
  isTEA?: boolean;
  isBirthday?: boolean;
  isMember?: boolean;
  isCounterPayment?: boolean;
}

export interface EntryBooking {
  name: string;
  lastName?: string;
  phone: string;
  cpf?: string;
  email?: string;
  visitDate: Date | null;
  adults: AdultInfo[];
  children: ChildInfo[];
  dayOfWeek: 'sexta' | 'sabado' | 'domingo' | 'segunda';
}

export type KioskType = 'menor' | 'maior' | 'familiar';
export type QuadType = 'individual' | 'dupla' | 'adulto-crianca';
export type QuadTime = 
  | '08:00' 
  | '09:00' 
  | '10:00' 
  | '11:00' 
  | '12:00' 
  | '13:00' 
  | '14:00' 
  | '15:00' 
  | '16:00';

export type AdditionalService = 'pesca' | 'futebol-sabao';

export type ChalePackageType = 
  | '1-diaria' 
  | '2-diarias' 
  | 'combo-3d-2n' 
  | 'combo-2n-qui-sab'
  | 'combo-2n-sex-dom'
  | 'combo-2n-sab-seg'
  | 'combo-3n-qui-dom'
  | 'combo-3n-sex-seg'
  | 'combo-4n-qui-seg'
  | 'diaria-qui-sex'
  | 'diaria-sex-sab'
  | 'diaria-sab-dom'
  | 'diaria-dom-seg'
  | 'domingo-relax-single' 
  | 'domingo-relax-casal' 
  | 'fds-lessa' 
  | 'experiencia-lessa';

export type ChildAgeGroup = 'under11' | '12plus';

export interface ChaleBooking {
  packageType: ChalePackageType | null;
  chaleId?: number | null;
  chaleIds?: number[]; // Lista de chalés selecionados para reserva em conjunto
  chaleOccupancies?: Record<number, 'casal' | 'individual'>; // Ocupação individual ou casal por chalé
  adultsCount: number;
  childrenCount: number;
  childrenAges?: ('under11' | '12plus')[];
  chaleKids?: Record<number, ('under11' | '12plus')[]>;
  guestNames?: string[]; // Nome de cada hóspede para o check-in
  checkInDate: Date | null;
  checkOutDate: Date | null;
  stayOption?: 'sex-sab' | 'sab-dom' | 'sex-dom' | null;
  includeSundayDayUse?: boolean; // Se inclui permanência no parque no domingo até 17h
  notes?: string;
}

export interface CampingBooking {
  peopleCount: number; // total de campistas
  adultsCount?: number; // adultos pagantes (R$ 100 cada)
  childrenCount?: number; // crianças 0 a 11 anos (grátis)
  seniorsCount?: number; // idosos 60+ (grátis)
  date: Date | null;
  notes?: string;
}

export interface KioskItem {
  type: KioskType;
  quantity: number;
  date: Date | null;
  selectedIds?: number[];
}

export interface QuadItem {
  type: QuadType;
  quantity: number;
  date: Date | null;
  time: QuadTime | null;
}

export interface AdditionalItem {
  type: AdditionalService;
  quantity: number;
}

export interface BookingState {
  entry: EntryBooking;
  kiosks: KioskItem[];
  quads: QuadItem[];
  additionals: AdditionalItem[];
  chale: ChaleBooking;
  camping: CampingBooking;
}

export const CAMPING_PRICE_PER_PERSON = 100;

export interface ChalePackageInfo {
  id: ChalePackageType;
  title: string;
  period: string;
  nights: number;
  days: number;
  typeLabel: string;
  priceIndividual: number;
  priceCasal: number;
  basePrice: number;
  description: string;
  isPopular?: boolean;
  badge?: string;
  commercialHighlight?: string;
}

export const CHALE_PACKAGES: Record<ChalePackageType, ChalePackageInfo> = {
  'combo-2n-sex-dom': {
    id: 'combo-2n-sex-dom',
    title: 'Combo 2 noites — Sexta a Domingo',
    period: 'Sexta a Domingo (3 Dias + 2 Noites)',
    nights: 2,
    days: 3,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 639,
    priceCasal: 819,
    basePrice: 819,
    isPopular: true,
    badge: '🔥 10% OFF • SEX A DOM',
    commercialHighlight: 'Check-in sexta às 15h • Check-out domingo às 12h (Day Use no parque liberado até as 17h!)',
    description: 'Check-in sexta às 15h • Check-out domingo às 12h. Day use de sexta a domingo até as 17h e café da manhã incluso nas manhãs de sábado e domingo.'
  },
  'combo-2n-qui-sab': {
    id: 'combo-2n-qui-sab',
    title: 'Combo 2 noites — Quinta a Sábado',
    period: 'Quinta a Sábado (3 Dias + 2 Noites)',
    nights: 2,
    days: 3,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 522,
    priceCasal: 702,
    basePrice: 702,
    badge: '🌿 10% OFF • QUI A SÁB',
    commercialHighlight: 'Check-in quinta às 9h • Check-out sábado às 12h',
    description: 'Check-in quinta às 9h • Check-out sábado às 12h. Café da manhã incluso na sexta e sábado.'
  },
  'combo-2n-sab-seg': {
    id: 'combo-2n-sab-seg',
    title: 'Combo 2 noites — Sábado a Segunda',
    period: 'Sábado a Segunda (3 Dias + 2 Noites)',
    nights: 2,
    days: 3,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 531,
    priceCasal: 711,
    basePrice: 711,
    badge: '☀️ 10% OFF • SÁB A SEG',
    commercialHighlight: 'Check-in sábado às 15h • Check-out segunda às 12h (Domingo Day Use até 17h)',
    description: 'Check-in sábado às 15h • Check-out segunda às 12h. Day Use domingo até 17h. Segunda sem café e balneário fechado.'
  },
  'combo-3n-qui-dom': {
    id: 'combo-3n-qui-dom',
    title: 'Combo 3 noites — Quinta a Domingo',
    period: 'Quinta a Domingo (4 Dias + 3 Noites)',
    nights: 3,
    days: 4,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 855,
    priceCasal: 1125,
    basePrice: 1125,
    badge: '⭐ 10% OFF • QUI A DOM',
    commercialHighlight: 'Check-in quinta às 9h • Check-out domingo às 12h (Day Use no parque liberado até as 17h!)',
    description: 'Check-in quinta às 9h • Check-out domingo às 12h. Day use de sexta a domingo até as 17h e café da manhã incluso nas manhãs de sexta, sábado e domingo.'
  },
  'combo-3n-sex-seg': {
    id: 'combo-3n-sex-seg',
    title: 'Combo 3 noites — Sexta a Segunda',
    period: 'Sexta a Segunda (4 Dias + 3 Noites)',
    nights: 3,
    days: 4,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 837,
    priceCasal: 1107,
    basePrice: 1107,
    badge: '🌟 10% OFF • SEX A SEG',
    commercialHighlight: 'Check-in sexta às 15h • Check-out segunda às 12h (Segunda sem café/parque fechado)',
    description: 'Check-in sexta às 15h • Check-out segunda às 12h. Day use de sexta a domingo até as 17h. Segunda balneário fechado e sem café da manhã.'
  },
  'combo-4n-qui-seg': {
    id: 'combo-4n-qui-seg',
    title: 'Combo 4 noites — Quinta a Segunda (Maior Estadia)',
    period: 'Quinta a Segunda (5 Dias + 4 Noites)',
    nights: 4,
    days: 5,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 1053,
    priceCasal: 1413,
    basePrice: 1413,
    badge: '👑 MAIOR ESTADIA • 10% OFF',
    commercialHighlight: '5 dias no calendário e 4 pernoites! Check-in quinta às 9h • Check-out segunda às 12h (Economia de até R$ 137)',
    description: 'Check-in quinta às 9h • Check-out segunda às 12h. Acesso ao Day Use nos 3 dias em que o parque funciona (sex, sáb, dom). Segunda balneário fechado e sem café da manhã.'
  },
  'diaria-qui-sex': {
    id: 'diaria-qui-sex',
    title: 'Diária Quinta a Sexta',
    period: 'Quinta a Sexta (1 Noite)',
    nights: 1,
    days: 1,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 240,
    priceCasal: 340,
    basePrice: 340,
    description: 'Check-in quinta às 9h • Check-out sexta às 12h com café da manhã incluso na manhã de sexta.'
  },
  'diaria-sex-sab': {
    id: 'diaria-sex-sab',
    title: 'Diária Sexta a Sábado',
    period: 'Sexta a Sábado (1 Noite)',
    nights: 1,
    days: 1,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 340,
    priceCasal: 440,
    basePrice: 440,
    description: 'Check-in sexta às 15h • Check-out sábado às 12h com café da manhã incluso na manhã de sábado.'
  },
  'diaria-sab-dom': {
    id: 'diaria-sab-dom',
    title: 'Diária Sábado a Domingo',
    period: 'Sábado a Domingo (1 Noite)',
    nights: 1,
    days: 1,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 370,
    priceCasal: 470,
    basePrice: 470,
    description: 'Check-in sábado às 15h • Check-out domingo às 12h com café da manhã incluso e Day Use no parque liberado no domingo até as 17h!'
  },
  'diaria-dom-seg': {
    id: 'diaria-dom-seg',
    title: 'Diária Domingo a Segunda',
    period: 'Domingo a Segunda (1 Noite)',
    nights: 1,
    days: 1,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 220,
    priceCasal: 320,
    basePrice: 320,
    description: 'Check-in domingo às 15h • Check-out segunda às 12h (Segunda balneário fechado e sem café da manhã).'
  },
  // Aliases de retrocompatibilidade
  'combo-3d-2n': {
    id: 'combo-3d-2n',
    title: 'Combo 2 noites — Sexta a Domingo',
    period: 'Sexta a Domingo (3 Dias + 2 Noites)',
    nights: 2,
    days: 3,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 639,
    priceCasal: 819,
    basePrice: 819,
    isPopular: true,
    badge: '🔥 10% OFF • SEX A DOM',
    commercialHighlight: 'Check-in sexta às 15h • Check-out domingo às 12h (Day Use no parque liberado até as 17h!)',
    description: 'Check-in sexta às 15h • Check-out domingo às 12h. Day use de sexta a domingo até as 17h e café da manhã incluso.'
  },
  '1-diaria': {
    id: '1-diaria',
    title: '1 Diária',
    period: '1 Diária (Entrada 15h / Saída 12h)',
    nights: 1,
    days: 1,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 340,
    priceCasal: 390,
    basePrice: 390,
    description: 'Diária avulsa em meio à natureza com café incluso e Day Use conforme pacote.'
  },
  '2-diarias': {
    id: '2-diarias',
    title: '2 Diárias Consecutivas',
    period: '2 Diárias (Entrada 15h / Saída 12h)',
    nights: 2,
    days: 2,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 639,
    priceCasal: 729,
    basePrice: 729,
    description: '2 diárias consecutivas com 10% de desconto.'
  },
  'domingo-relax-single': {
    id: 'domingo-relax-single',
    title: '1 Diária (Individual)',
    period: '1 Diária',
    nights: 1,
    days: 1,
    typeLabel: 'Individual',
    priceIndividual: 220,
    priceCasal: 270,
    basePrice: 220,
    description: '1 diária individual.'
  },
  'domingo-relax-casal': {
    id: 'domingo-relax-casal',
    title: '1 Diária (Casal)',
    period: '1 Diária',
    nights: 1,
    days: 1,
    typeLabel: 'Casal',
    priceIndividual: 220,
    priceCasal: 270,
    basePrice: 270,
    description: '1 diária casal.'
  },
  'fds-lessa': {
    id: 'fds-lessa',
    title: 'Combo 2 noites — Sexta a Domingo',
    period: 'Sexta a Domingo (3 Dias + 2 Noites)',
    nights: 2,
    days: 3,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 639,
    priceCasal: 729,
    basePrice: 729,
    description: 'Combo Sexta a Domingo com 10% OFF.'
  },
  'experiencia-lessa': {
    id: 'experiencia-lessa',
    title: '2 Diárias',
    period: '2 Diárias Consecutivas',
    nights: 2,
    days: 2,
    typeLabel: 'Individual ou Casal',
    priceIndividual: 639,
    priceCasal: 729,
    basePrice: 729,
    description: '2 diárias consecutivas.'
  }
};

export const CHALE_RULES = [
  'Horários da hospedagem: Check-in a partir das 15h (Quintas às 09h) e Check-out pontual até às 12h.',
  'Café da manhã servido das 7h às 9h nas manhãs de sexta, sábado e domingo.',
  'Segunda-feira: não haverá café da manhã nem funcionamento do parque balneário.',
  'Aos domingos, Day Use 100% incluso liberado no parque até as 17h para todos os hóspedes.',
  'Combos de 2 ou mais noites têm 10% de desconto automático sobre a soma das diárias.',
  'Capacidade máxima: 2 adultos por chalé (+ crianças).',
  'Crianças até 11 anos: adicional de R$ 50/diária (R$ 45/diária em combos). 12+ anos: R$ 100/diária (R$ 90/diária em combos).',
  'Nos pacotes com saída na segunda-feira, o check-out deverá ser organizado previamente, já que o balneário estará fechado.',
  'Permitido apenas animais de pequeno porte.',
  'Proibido fogueiras e churrasqueiras nos chalés.',
  'Proibido som automotivo/alto e fumar dentro dos chalés.'
];

export type ChaleModelType = 'alvenaria' | 'vidro';

export interface ChaleUnit {
  id: number;
  name: string;
  type: ChaleModelType;
  modelLabel: string;
  capacity: string;
  maxAdults: number;
  doubleBeds: number;
  singleBeds: number;
  isInitiallyUnavailable?: boolean;
  unavailableReason?: string;
  tag?: string;
}

export const CHALE_UNITS: ChaleUnit[] = [
  // 6 Chalés de Alvenaria (5 disponíveis, 1 indisponível)
  { id: 1, name: 'Chalé 01 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: false },
  { id: 2, name: 'Chalé 02 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: false },
  { id: 3, name: 'Chalé 03 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: false },
  { id: 4, name: 'Chalé 04 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: false },
  { id: 5, name: 'Chalé 05 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: false },
  { id: 6, name: 'Chalé 06 - Alvenaria Tradicional', type: 'alvenaria', modelLabel: 'Alvenaria', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },

  // 6 Chalés de Vidro (mais caros, todos com a tarja indisponíveis)
  { id: 7,  name: 'Chalé 07 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
  { id: 8,  name: 'Chalé 08 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
  { id: 9,  name: 'Chalé 09 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
  { id: 10, name: 'Chalé 10 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
  { id: 11, name: 'Chalé 11 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
  { id: 12, name: 'Chalé 12 - Vidro Panorâmico', type: 'vidro', modelLabel: 'Vidro Panorâmico (Luxo)', capacity: 'Até 2 adultos', maxAdults: 2, doubleBeds: 1, singleBeds: 0, isInitiallyUnavailable: true, unavailableReason: 'Indisponível', tag: 'Indisponível' },
];


export const CHALE_NIGHT_RATES: Record<number, { label: string; individual: number; casal: number }> = {
  4: { label: 'Quinta para Sexta', individual: 240, casal: 340 },
  5: { label: 'Sexta para Sábado', individual: 340, casal: 440 },
  6: { label: 'Sábado para Domingo', individual: 370, casal: 470 },
  0: { label: 'Domingo para Segunda', individual: 220, casal: 320 },
};

export function calculateStayPricing(checkIn: Date | string | null, checkOut: Date | string | null) {
  if (!checkIn || !checkOut) {
    return {
      nightsCount: 0,
      totalIndividualGross: 0,
      totalCasalGross: 0,
      discountPct: 0,
      totalIndividual: 0,
      totalCasal: 0,
      hasSunday: false,
      hasMondayOut: false,
      hasThursdayIn: false,
      checkInHour: '15h',
      checkOutHour: '12h'
    };
  }

  const inDate = parseToRODate(checkIn);
  const outDate = parseToRODate(checkOut);

  let current = new Date(inDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(outDate);
  end.setHours(0, 0, 0, 0);

  let nightsCount = 0;
  let totalIndividualGross = 0;
  let totalCasalGross = 0;
  let hasSunday = false;
  const hasMondayOut = end.getDay() === 1;
  const hasThursdayIn = inDate.getDay() === 4;

  while (current < end && nightsCount < 10) {
    const day = current.getDay();
    if (day === 0 || current.getDay() === 6) {
      hasSunday = true;
    }
    const rate = CHALE_NIGHT_RATES[day] || { individual: 340, casal: 390 };
    totalIndividualGross += rate.individual;
    totalCasalGross += rate.casal;
    nightsCount++;
    current.setDate(current.getDate() + 1);
  }

  // 10% de desconto sobre a soma das diárias se for combo (>= 2 noites)
  const discountPct = nightsCount >= 2 ? 0.10 : 0;
  const totalIndividual = Math.round(totalIndividualGross * (1 - discountPct));
  const totalCasal = Math.round(totalCasalGross * (1 - discountPct));

  // Check-in na quinta às 9h ou 15h nos demais dias
  const checkInHour = hasThursdayIn ? '09h' : '15h';
  const checkOutHour = '12h';

  return {
    nightsCount,
    totalIndividualGross,
    totalCasalGross,
    discountPct,
    totalIndividual,
    totalCasal,
    hasSunday,
    hasMondayOut,
    hasThursdayIn,
    checkInHour,
    checkOutHour
  };
}

export function calculateChaleTotal(
  packageType: ChalePackageType | null,
  adultsCount: number,
  childrenCount: number = 0,
  getPrice?: (key: string, fb: number) => number,
  includeSundayDayUse?: boolean,
  chaletsCount: number = 1,
  checkInDate?: Date | string | null,
  checkOutDate?: Date | string | null,
  chaleOccupancies?: Record<number, 'casal' | 'individual'>,
  chaleIds?: number[],
  childrenAges?: ('under11' | '12plus')[]
): number {
  if (!packageType) return 0;
  const ids = (chaleIds && chaleIds.length > 0) ? chaleIds : Array.from({ length: Math.max(1, chaletsCount || 1) }, (_, i) => i + 1);
  const count = ids.length;

  let basePrice = 0;
  let nights = 1;

  if (checkInDate && checkOutDate) {
    const pricing = calculateStayPricing(checkInDate, checkOutDate);
    if (pricing.nightsCount > 0) {
      nights = pricing.nightsCount;
      if (chaleOccupancies && Object.keys(chaleOccupancies).length > 0) {
        basePrice = ids.reduce((acc, id) => {
          const occ = chaleOccupancies[id] || (adultsCount === 1 && count === 1 ? 'individual' : 'casal');
          return acc + (occ === 'individual' ? pricing.totalIndividual : pricing.totalCasal);
        }, 0);
      } else {
        const isIndividual = adultsCount === 1 && count === 1;
        basePrice = isIndividual ? pricing.totalIndividual : (pricing.totalCasal * count);
      }
    }
  }

  if (basePrice === 0) {
    const pkg = CHALE_PACKAGES[packageType];
    if (pkg) {
      nights = pkg.nights || 1;
      if (chaleOccupancies && Object.keys(chaleOccupancies).length > 0) {
        basePrice = ids.reduce((acc, id) => {
          const occ = chaleOccupancies[id] || (adultsCount === 1 && count === 1 ? 'individual' : 'casal');
          return acc + (occ === 'individual' ? pkg.priceIndividual : pkg.priceCasal);
        }, 0);
      } else {
        const isIndividual = adultsCount === 1 && count === 1;
        basePrice = isIndividual ? pkg.priceIndividual : (pkg.priceCasal * count);
      }
    }
  }

  // Crianças: Adicional conforme a tabela oficial do Balneário Lessa
  // O valor do adicional é somado de acordo com a quantidade de diárias (noites) selecionadas:
  // Até 11 anos: R$ 50/noite (em combos >= 2 noites recebe 10% OFF: 2 noites = R$ 90, 3 noites = R$ 135, 4 noites = R$ 180)
  // Acima de 12 anos: R$ 100/noite (em combos >= 2 noites recebe 10% OFF: 2 noites = R$ 180, 3 noites = R$ 270, 4 noites = R$ 360)
  let kidsCost = 0;
  const totalKids = childrenCount || 0;
  const discountPct = nights >= 2 ? 0.10 : 0;

  if (totalKids > 0) {
    if (childrenAges && childrenAges.length > 0) {
      for (let i = 0; i < totalKids; i++) {
        const age = childrenAges[i] || 'under11';
        const ratePerNight = (age === '12plus' ? 100 : 50);
        const kidGross = ratePerNight * nights;
        kidsCost += Math.round(kidGross * (1 - discountPct));
      }
    } else {
      const kidGross = 50 * nights * totalKids;
      kidsCost += Math.round(kidGross * (1 - discountPct));
    }
  }

  return basePrice + kidsCost;
}

export function calculateChaleGrossTotal(
  packageType: ChalePackageType | null,
  adultsCount: number,
  childrenCount: number = 0,
  chaletsCount: number = 1,
  checkInDate?: Date | string | null,
  checkOutDate?: Date | string | null,
  chaleOccupancies?: Record<number, 'casal' | 'individual'>,
  chaleIds?: number[],
  childrenAges?: ('under11' | '12plus')[]
): number {
  if (!packageType) return 0;
  const ids = (chaleIds && chaleIds.length > 0) ? chaleIds : Array.from({ length: Math.max(1, chaletsCount || 1) }, (_, i) => i + 1);
  const count = ids.length;

  let baseGross = 0;
  let nights = 1;

  if (checkInDate && checkOutDate) {
    const pricing = calculateStayPricing(checkInDate, checkOutDate);
    if (pricing.nightsCount > 0) {
      nights = pricing.nightsCount;
      if (chaleOccupancies && Object.keys(chaleOccupancies).length > 0) {
        baseGross = ids.reduce((acc, id) => {
          const occ = chaleOccupancies[id] || (adultsCount === 1 && count === 1 ? 'individual' : 'casal');
          return acc + (occ === 'individual' ? pricing.totalIndividualGross : pricing.totalCasalGross);
        }, 0);
      } else {
        const isIndividual = adultsCount === 1 && count === 1;
        baseGross = isIndividual ? pricing.totalIndividualGross : (pricing.totalCasalGross * count);
      }
    }
  }

  if (baseGross === 0) {
    const pkg = CHALE_PACKAGES[packageType];
    if (pkg) {
      nights = pkg.nights || 1;
      const indGross = Math.round(pkg.priceIndividual / 0.9);
      const casalGross = Math.round(pkg.priceCasal / 0.9);
      if (chaleOccupancies && Object.keys(chaleOccupancies).length > 0) {
        baseGross = ids.reduce((acc, id) => {
          const occ = chaleOccupancies[id] || (adultsCount === 1 && count === 1 ? 'individual' : 'casal');
          return acc + (occ === 'individual' ? indGross : casalGross);
        }, 0);
      } else {
        const isIndividual = adultsCount === 1 && count === 1;
        baseGross = isIndividual ? indGross : (casalGross * count);
      }
    }
  }

  let kidsGross = 0;
  const totalKids = childrenCount || 0;
  if (totalKids > 0) {
    if (childrenAges && childrenAges.length > 0) {
      for (let i = 0; i < totalKids; i++) {
        const age = childrenAges[i] || 'under11';
        kidsGross += (age === '12plus' ? 100 : 50) * nights;
      }
    } else {
      kidsGross = 50 * nights * totalKids;
    }
  }

  return baseGross + kidsGross;
}

export const ENTRY_PRICE = 49.90;
export const ENTRY_HALF_PRICE = 25;

export const KIOSK_INFO: Record<KioskType, { price: number; capacity: string; available: number; label: string }> = {
  maior:    { price: 150, capacity: 'Até 25 pessoas',  available: 1, label: 'Quiosque Grande'   },
  menor:    { price: 100, capacity: 'Até 15 pessoas',  available: 4, label: 'Quiosque Médio'    },
  familiar: { price: 75,  capacity: 'Até 5 pessoas',   available: 6, label: 'Quiosque Familiar' },
};

export const QUAD_PRICES: Record<QuadType, number> = {
  individual: 130,
  dupla: 195,
  'adulto-crianca': 195,
};

export const QUAD_LABELS: Record<QuadType, string> = {
  individual: 'Passeio Individual (40 min)',
  dupla: 'Passeio de Dupla (40 min)',
  'adulto-crianca': 'Passeio de Dupla (40 min)',
};

export const QUAD_TIMES: QuadTime[] = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
];

export const ADDITIONAL_INFO: Record<AdditionalService, { label: string; price: number; description: string }> = {
  'pesca': { 
    label: 'Pesca Esportiva', 
    price: 20, 
    description: 'Tenha acesso ao lago para pesca e se divirta-se pegando peixes de até 12kg!' 
  },
  'futebol-sabao': { 
    label: 'Futebol de Sabão', 
    price: 10, 
    description: 'Diversão garantida para grupos por 30 minutos!' 
  },
};

export function getQuadDiscount(date: Date | string | null): number {
  // Para os quadriciclos não terá 20% de desconto, apenas 10% fixo
  return 0.10;
}

export const HOLIDAY_STRINGS_2026 = [
  '2026-01-01', // Confraternização Universal
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-05', // Páscoa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalhador
  '2026-05-14', // Ascensão do Senhor
  '2026-05-24', // Nsa Sra Auxiliadora
  '2026-06-04', // Corpus Christi
  '2026-07-09', // Revolução Constitucionalista
  '2026-09-07', // Independência do Brasil
  '2026-10-12', // Nossa Senhora Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Dia da Consciência Negra (Sexta-feira)
  '2026-12-25', // Natal
];

export function isHolidayDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  if (typeof date === 'string') {
    const str = date.split('T')[0];
    if (HOLIDAY_STRINGS_2026.includes(str)) return true;
  }
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    if (HOLIDAY_STRINGS_2026.includes(`${y}-${m}-${d}`)) return true;
  }
  const d = parseToRODate(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const dateNum = d.getDate();

  if (year === 2026) {
    const holidays = [
      { m: 0, d: 1 },  // Jan 1
      { m: 1, d: 16 }, // Feb 16 (Carnaval)
      { m: 1, d: 17 }, // Feb 17 (Carnaval)
      { m: 3, d: 3 },  // Apr 3 (Sexta Santa)
      { m: 3, d: 5 },  // Apr 5 (Páscoa)
      { m: 3, d: 21 }, // Apr 21 (Tiradentes)
      { m: 4, d: 1 },  // May 1 (Trabalhador)
      { m: 4, d: 14 }, // May 14 (Ascensão)
      { m: 4, d: 24 }, // May 24 (Nsa Sra Auxiliadora)
      { m: 5, d: 4 },  // Jun 4 (Corpus Christi)
      { m: 6, d: 9 },  // Jul 9 (Revolução Constitucionalista)
      { m: 8, d: 7 },  // Sep 7 (Independência)
      { m: 9, d: 12 }, // Oct 12 (Nsa Sra Aparecida)
      { m: 10, d: 2 }, // Nov 2 (Finados)
      { m: 10, d: 15 },// Nov 15 (Proclamação República)
      { m: 10, d: 20 },// Nov 20 (Consciência Negra)
      { m: 11, d: 25 },// Dec 25 (Natal)
    ];
    return holidays.some(h => h.m === month && h.d === dateNum);
  }
  return false;
}

export function isSundayOrHoliday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  if (typeof date === 'string') {
    const str = date.split('T')[0];
    if (HOLIDAY_STRINGS_2026.includes(str)) return true;
  }
  if (date instanceof Date && date.getDay() === 0) return true;
  const d = parseToRODate(date);
  return d.getDay() === 0 || isHolidayDate(d);
}

export function isOperatingDay(date: Date | string): boolean {
  const d = parseToRODate(date);
  const day = d.getDay();

  // Dias normais de funcionamento: Sexta (5), Sábado (6), Domingo (0)
  const isNormalDay = day === 0 || day === 5 || day === 6;
  if (isNormalDay) return true;

  // Feriados 2026
  return isHolidayDate(d);
}

export function getPersonPrice(
  person: AdultInfo | ChildInfo, 
  defaultGratuity: boolean, 
  isSunday: boolean,
  getPrice: (type: string, fallback: number) => number
): number {
  // Gratuidades: PCD/TEA, Aniversariante, Idoso (60+), Criança (0 a 11), Assinante Lessa Club, Pagamento no Balcão
  if (defaultGratuity || person.isPCD || person.isTEA || person.isBirthday || person.isMember || person.isCounterPayment) {
    return 0;
  }
  
  // Meia-entrada (R$ 25): Professor, Servidor, Estudante, Doador de Sangue, Adulto Solidário (traz doação se NÃO for domingo/feriado)
  const isSolidarioValid = !isSunday && (person as any).takeDonation;
  const hasProfessionalDiscount = person.isTeacher || person.isServer || person.isStudent || (person as any).isBloodDonor || isSolidarioValid;
  if (hasProfessionalDiscount) {
    return getPrice('entry_half', 25);
  }

  // Adulto Normal: R$ 50,00 ou R$ 35,00 (ajustável via Admin)
  return getPrice('entry_full', 50);
}

export function calculateEntryTotal(entry: EntryBooking, getPrice: (type: string, fb: number) => number): number {
  let total = 0;
  const isSunday = entry.dayOfWeek === 'domingo' || isSundayOrHoliday(entry.visitDate);

  for (const adult of entry.adults) {
    total += getPersonPrice(adult, adult.age >= 60, isSunday, getPrice) * (adult.quantity || 1);
  }

  for (const child of entry.children) {
    total += getPersonPrice(child, child.age <= 11, isSunday, getPrice) * (child.quantity || 1);
  }

  return total;
}

export function formatCurrency(value?: number | null): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const WHATSAPP_NUMBER = '556992626140';

export const OPERATING_HOURS = 'Aberto das 9h às 17h';
export const OPERATING_DAYS = 'Sextas, Sábados, Domingos e Feriados';

// Hospedagem e Camping liberados a partir do dia 12 de Novembro de 2026 (bloqueados até 11/11/2026)
export const MIN_HOSPEDAGEM_CAMPING_DATE = '2026-11-12';

export function isDateAvailableForHospedagem(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = parseToRODate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return dateStr >= MIN_HOSPEDAGEM_CAMPING_DATE;
}

export function isChaleCheckInDay(date: Date | string): boolean {
  const d = parseToRODate(date);
  if (!isDateAvailableForHospedagem(d)) return false;
  const day = d.getDay();
  // Quinta (4), Sexta (5), Sábado (6), Domingo (0)
  return day === 4 || day === 5 || day === 6 || day === 0 || isHolidayDate(d);
}

export function isChaleCheckOutDay(date: Date | string): boolean {
  const d = parseToRODate(date);
  if (!isDateAvailableForHospedagem(d)) return false;
  const day = d.getDay();
  // Sexta (5), Sábado (6), Domingo (0), Segunda (1)
  return day === 5 || day === 6 || day === 0 || day === 1 || isHolidayDate(d);
}
