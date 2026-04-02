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
  lastName?: string;
  phone: string;
  cpf?: string;
  email?: string;
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
}

export const ENTRY_PRICE = 49.90;
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
  const year = d.getFullYear();
  const month = d.getMonth();
  const dateNum = d.getDate();

  // Dias normais de funcionamento: Sexta (5), Sábado (6), Domingo (0), Segunda (1)
  const isNormalDay = day === 0 || day === 1 || day === 5 || day === 6;
  if (isNormalDay) return true;

  // Feriados 2026
  if (year === 2026) {
    const holidays = [
      { m: 0, d: 1 },  // Jan 1
      { m: 1, d: 16 }, // Feb 16 (Carnaval)
      { m: 1, d: 17 }, // Feb 17 (Carnaval)
      { m: 3, d: 3 },  // Apr 3 (Sexta Santa)
      { m: 3, d: 5 },  // Apr 5 (Páscoa)
      { m: 3, d: 21 }, // Apr 21 (Tiradentes)
      { m: 4, d: 1 },  // May 1 (Trabalhador)
      { m: 4, d: 14 }, // May 14 (Ascensão ?)
      { m: 4, d: 24 }, // May 24 (Nsa Sra Auxiliadora ?)
      { m: 5, d: 4 },  // Jun 4 (Corpus Christi)
      { m: 6, d: 9 },  // Jul 9 (Revolução Constitucionalista ?)
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

export function getPersonPrice(
  person: AdultInfo | ChildInfo, 
  defaultGratuity: boolean, 
  isSunday: boolean,
  getPrice: (type: string, fallback: number) => number
): number {
  // Gratuidades: PCD/TEA, Aniversariante, Idoso (60+), Criança (≤11)
  if (defaultGratuity || person.isPCD || person.isTEA || person.isBirthday) {
    return 0;
  }
  
  // Meia-entrada (R$ 25): Professor, Servidor, Estudante, Doador de Sangue, Adulto Solidário (traz doação)
  const hasProfessionalDiscount = person.isTeacher || person.isServer || person.isStudent || (person as any).isBloodDonor || (person as any).takeDonation;
  if (hasProfessionalDiscount) {
    return getPrice('entry_half', 25);
  }

  // Adulto Normal: R$ 50,00
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
