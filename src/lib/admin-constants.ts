import { format } from 'date-fns';
import { KioskType, QuadType, QuadTime } from './booking-types';

export const KIOSKS = [
  { id: 1, name: 'QUIOSQUE - 01', price: 100, capacity: 'Até 30 pessoas', type: 'Maior' },
  { id: 2, name: 'QUIOSQUE - 02', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 3, name: 'QUIOSQUE - 03', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 4, name: 'QUIOSQUE - 04', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 5, name: 'QUIOSQUE - 05', price: 75, capacity: 'Até 15 pessoas', type: 'Menor' },
  { id: 6, name: 'QUIOSQUE - 06', price: 100, capacity: 'Até 15 pessoas', type: 'Maior', observation: 'área privilegiada ao lado da cachoeira do batistério' },
  { id: 7, name: 'QUIOSQUE - 07', price: 100, capacity: 'Até 15 pessoas', type: 'Maior', observation: 'área privilegiada ao lado da cachoeira do batistério' },
  { id: 8, name: 'QUIOSQUE - 08', price: 100, capacity: 'Até 15 pessoas', type: 'Maior', observation: 'área privilegiada ao lado da cachoeira do batistério' }
];

export const QUAD_TIMES: QuadTime[] = ['09:00', '10:30', '14:00', '15:30'];

export const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX / Transferência' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'cash', label: 'Dinheiro (Local)' }
];

export const QUAD_MODELS_LABELS: Record<string, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança'
};

export const BR_HOLIDAYS_2026 = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-05", 
  "2026-04-21", "2026-05-01", "2026-05-14", "2026-05-24", "2026-06-04", 
  "2026-07-09", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", 
  "2026-11-20", "2026-12-25"
];

export const isHoliday = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return BR_HOLIDAYS_2026.includes(dateStr);
};

export const isAllowedDay = (date: Date) => {
  const day = date.getDay();
  return day === 5 || day === 6 || day === 0 || day === 1 || isHoliday(date);
};
