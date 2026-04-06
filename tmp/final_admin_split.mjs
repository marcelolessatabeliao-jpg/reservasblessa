import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD IMPORT
if (!content.includes("from '@/components/admin/InternalBookingAssistant'")) {
    content = content.replace("import { PaymentModal } from '@/components/booking/PaymentModal';", 
        "import { PaymentModal } from '@/components/booking/PaymentModal';\nimport { InternalBookingAssistant } from '@/components/admin/InternalBookingAssistant';");
}

// 2. REMOVE INTERNAL BOOKING STATE & LOGIC
// We remove:
// - isNewBookingOpen state
// - generatedPix state (internal to assistant now)
// - newBookingData state
// - handleCreateInternalBooking function
// - calculateTotal logic

content = content.replace(/const \[isNewBookingOpen, setIsNewBookingOpen\] = useState\(false\);/, '');
content = content.replace(/const \[generatedPix, setGeneratedPix\] = useState<\{encodedImage:string, payload:string\} \| null>\(null\);/, '');
content = content.replace(/const \[newBookingData, setNewBookingData\] = useState<any>\(\{[\s\S]*?\}\);/, '');

const handleCreateRegex = /const handleCreateInternalBooking = async \(\) => \{[\s\S]*?\};/;
content = content.replace(handleCreateRegex, '');

// 3. REPLACE TRIGGER BUTTON AT LINE ~1875
const triggerButtonRegex = /<Button\s+className="rounded-2xl bg-emerald-600[\s\S]*?<\/Button>/;
content = content.replace(triggerButtonRegex, '<InternalBookingAssistant onCreated={fetchData} isHoliday={isHoliday} isAllowedDay={isAllowedDay} />');

// 4. REMOVE THE ACTUAL DIALOG JSX (Line ~2140)
const dialogRegex = /<Dialog open=\{isNewBookingOpen\}[\s\S]*?<\/Dialog>/;
content = content.replace(dialogRegex, '{/* Assistente movido para InternalBookingAssistant.tsx */}');

// 5. ENCODING & CHARACTERS
content = content.replace(/â€¢/g, '-');
content = content.replace(/•/g, '-');

// 6. UI COMPACTION
content = content.replace(/p-10/g, 'p-6');
content = content.replace(/gap-10/g, 'gap-6');
content = content.replace(/space-y-10/g, 'space-y-6');

fs.writeFileSync(filePath, content);
console.log('Admin.tsx refactored and cleaned successfully.');
