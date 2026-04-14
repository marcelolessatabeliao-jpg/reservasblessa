
import { getQuadDiscount, QUAD_PRICES } from './src/lib/booking-types';
import { parseToRODate } from './src/utils/date-utils';

const visit_date = '2026-04-20'; // Monday
const adults_solidarity = 3;
const quads = [
  { type: 'individual', quantity: 1 },
  { type: 'dupla', quantity: 1 }
];

const dateObj = parseToRODate(visit_date);
const dayOfWeek = dateObj.getDay();
const qD = getQuadDiscount(dateObj);

console.log('Date:', visit_date);
console.log('Day of Week:', dayOfWeek);
console.log('Discount (qD):', qD);

let total = adults_solidarity * 25;
console.log('Adults Total:', total);

quads.forEach(q => {
  const base = QUAD_PRICES[q.type as keyof typeof QUAD_PRICES] || 150;
  const unit = base * (1 - qD);
  const subtotal = unit * q.quantity;
  console.log(`Quad ${q.type}: base=${base}, unit=${unit}, subtotal=${subtotal}`);
  total += subtotal;
});

console.log('Final Total:', total);
