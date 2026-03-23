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
}

export interface EntryBooking {
  name: string;
  phone: string;
  visitDate: Date | null;
  adults: AdultInfo[];
  children: ChildInfo[];
  dayOfWeek: 'sexta' | 'sabado' | 'domingo' | 'segunda';
}

export type KioskType = 'menor' | 'maior';
export type QuadType = 'individual' | 'dupla' | 'adulto-crianca';
export type QuadTime = '09:00' | '10:30' | '14:00' | '15:30';

export type AdditionalService = 'pesca' | 'futebol-sabao';

export interface KioskItem {
  type: KioskType;
  quantity: number;
  date: Date | null;
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
}

export const ENTRY_PRICE = 50;
export const ENTRY_HALF_PRICE = 25;

export const KIOSK_INFO: Record<KioskType, { price: number; capacity: string; available: number; label: string }> = {
  menor: { price: 75, capacity: 'Até 15 pessoas', available: 4, label: 'Quiosque Menor' },
  maior: { price: 100, capacity: '20 a 25 pessoas', available: 1, label: 'Quiosque Maior' },
};

export const QUAD_PRICES: Record<QuadType, number> = {
  individual: 150,
  dupla: 250,
  'adulto-crianca': 200,
};

export const QUAD_LABELS: Record<QuadType, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança',
};

export const QUAD_TIMES: QuadTime[] = ['09:00', '10:30', '14:00', '15:30'];

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
  if (!date) return 0;
  const d = new Date(date);
  const day = d.getDay();
  if (day === 1 || day === 5) return 0.2;
  if (day === 0 || day === 6) return 0.1;
  return 0;
}

export function isOperatingDay(date: Date | string): boolean {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 1 || day === 5 || day === 6;
}

export function getPersonPrice(
  person: AdultInfo | ChildInfo, 
  defaultGratuity: boolean, 
  isSunday: boolean,
  getPrice: (type: string, fallback: number) => number
): number {
  if (defaultGratuity || person.isPCD || person.isTEA || person.isBirthday) {
    return 0;
  }
  
  const hasProfessionalDiscount = person.isTeacher || person.isServer || person.isStudent || (person as any).isBloodDonor;
  const hasDonationDiscount = person.takeDonation && !isSunday;

  if (hasProfessionalDiscount || hasDonationDiscount) {
    return getPrice('entry_half', 25);
  }

  return getPrice('entry_full', 50);
}

export function calculateEntryTotal(entry: EntryBooking, getPrice: (type: string, fb: number) => number): number {
  let total = 0;
  const isSunday = entry.dayOfWeek === 'domingo';

  for (const adult of entry.adults) {
    total += getPersonPrice(adult, adult.age >= 60, isSunday, getPrice) * (adult.quantity || 1);
  }

  for (const child of entry.children) {
    total += getPersonPrice(child, child.age <= 11, isSunday, getPrice) * (child.quantity || 1);
  }

  return total;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const WHATSAPP_NUMBER = '556992626140';

export const OPERATING_HOURS = 'Aberto das 9h às 17h';
export const OPERATING_DAYS = 'Sextas, Sábados, Domingos, Segundas e Feriados';
