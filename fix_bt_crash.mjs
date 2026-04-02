import fs from 'fs';

const btFile = 'src/components/admin/BookingTable.tsx';
let btContent = fs.readFileSync(btFile, 'utf8');

// 1. Ensure QrCode is in imports
if (!btContent.includes('QrCode')) {
  btContent = btContent.replace('  ChevronDown, CheckCircle, XCircle, Clock,', '  ChevronDown, CheckCircle, XCircle, Clock, QrCode,');
}

// 2. Ensure getStatusConfig is defined
if (!btContent.includes('const getStatusConfig =')) {
  const statusConfigInsert = `const getStatusConfig = (booking: any) => {
  const baseConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  
  if (booking.status === 'paid' || booking.status === 'confirmed') {
    const payment = booking.payments?.[0];
    if (payment) {
      if (payment.metodo === 'PIX') return { ...baseConfig, label: 'PAGO VIA PIX' };
      if (payment.metodo === 'CREDIT_CARD' || payment.metodo === 'DEBIT_CARD' || payment.metodo === 'cartao') 
        return { ...baseConfig, label: 'PAGO VIA CARTÃO' };
    }
  }
  return baseConfig;
};\n\n`;
  btContent = btContent.replace('export function BookingTable', statusConfigInsert + 'export function BookingTable');
}

// 3. Fix destructuring in BookingTable
if (!btContent.includes('onGeneratePayment }')) {
  const oldDestructure = 'onRefresh }: BookingTableProps';
  const newDestructure = 'onRefresh, onGeneratePayment }: BookingTableProps';
  btContent = btContent.replace(oldDestructure, newDestructure);
}

fs.writeFileSync(btFile, btContent);
console.log('Fixed BookingTable.tsx - added missing function and prop destructuring.');
