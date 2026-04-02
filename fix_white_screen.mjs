import fs from 'fs';

// 1. Fix BookingTable.tsx
const btFile = 'src/components/admin/BookingTable.tsx';
let btContent = fs.readFileSync(btFile, 'utf8');

// Ensure QrCode import
if (!btContent.includes('QrCode')) {
  btContent = btContent.replace('  ChevronDown, CheckCircle, XCircle, Clock,', '  ChevronDown, CheckCircle, XCircle, Clock, QrCode,');
}

// Ensure onGeneratePayment prop in interface
if (!btContent.includes('onGeneratePayment?:')) {
  btContent = btContent.replace('  onRefresh?: () => void;', '  onRefresh?: () => void;\n  onGeneratePayment?: (id: string, isOrder: boolean) => void;');
}

// Ensure onGeneratePayment in component destructuring
if (!btContent.includes('onGeneratePayment,')) {
  btContent = btContent.replace('  onFileUpload, isUploading, onRemoveReceipt, onRefresh', '  onFileUpload, isUploading, onRemoveReceipt, onRefresh, onGeneratePayment');
}

// Ensure Gerar PIX button is there (Mobile)
if (!btContent.includes('Gerar PIX')) {
  const voucherTarget = /<Button onClick={[^>]*window\.open\("https:\/\/wa\.me\/55" \+ cleanPhone[^>]*>.*?Voucher<\/Button>/s;
  const pixBtn = `
                                      {booking.status === 'pending' && onGeneratePayment && (
                                        <Button 
                                          onClick={(e) => { e.stopPropagation(); onGeneratePayment(booking.id, !!booking.is_order); }} 
                                          className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white h-10 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5"
                                        >
                                          <QrCode className="w-4 h-4" />
                                          Gerar PIX
                                        </Button>
                                      )}`;
  btContent = btContent.replace(voucherTarget, (match) => pixBtn + '\n                                      ' + match);

  // Desktop
  const desktopTarget = '<Button onClick={(e) => {e.stopPropagation(); onStatusChange(booking.id, \'paid\', booking.is_order);}} className="bg-emerald-600';
  btContent = btContent.replace(desktopTarget, pixBtn + '\n                                      ' + desktopTarget);
}

fs.writeFileSync(btFile, btContent);
console.log('Fixed BookingTable.tsx');

// 2. Fix Admin.tsx (Ensure Dialog imports)
const adminFile = 'src/pages/Admin.tsx';
let adminContent = fs.readFileSync(adminFile, 'utf8');

if (!adminContent.includes('import { Dialog')) {
  const badgeImport = "import { Badge } from '@/components/ui/badge';";
  adminContent = adminContent.replace(badgeImport, badgeImport + "\nimport { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';");
}

fs.writeFileSync(adminFile, adminContent);
console.log('Fixed Admin.tsx');
