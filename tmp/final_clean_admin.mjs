import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD IMPORT
if (!content.includes("from '@/components/admin/AdminDialogs'")) {
    content = content.replace("import { PaymentModal } from '@/components/booking/PaymentModal';", 
        "import { PaymentModal } from '@/components/booking/PaymentModal';\nimport { EditKioskDialog, EditQuadDialog } from '@/components/admin/AdminDialogs';");
}

// 2. REMOVE LOCAL DEFINITIONS (Everything after Admin function)
// We know Admin ends around line 2428.
// We'll search for the end of the Admin function and keep everything before it, plus any valid code after it that ISN'T the duplicates.
const adminEndMarker = "export default Admin;";
const parts = content.split('export default function Admin');
if (parts.length > 1) {
    const mainPart = parts[1].split('export default Admin;');
    // mainPart[0] is the body of Admin function
    // mainPart[1] is what comes after Admin function (where the helpers were)
    
    content = parts[0] + 'export default function Admin' + mainPart[0] + 'export default Admin;';
}

// 3. ENCODING & CHARACTERS
content = content.replace(/â€¢/g, '-');
content = content.replace(/•/g, '-');

// 4. UI COMPACTION (Replace large paddings/gaps)
content = content.replace(/p-10/g, 'p-6');
content = content.replace(/gap-10/g, 'gap-6');
content = content.replace(/space-y-10/g, 'space-y-6');
content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-[2rem]');
content = content.replace(/rounded-\[3rem\]/g, 'rounded-[2rem]');

// 5. FIX CALENDAR IF NEEDED
// Ensure ptBR and parseISO are used correctly
content = content.replace(/locale=\{ptBR\}/g, "locale={ptBR}");

fs.writeFileSync(filePath, content);
console.log('Admin.tsx refactored and cleaned.');
