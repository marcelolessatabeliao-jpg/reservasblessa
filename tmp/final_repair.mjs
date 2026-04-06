import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the end of saveEditing
const startSearch = "await fetchData();\n    } catch (err: any) {";
const startIndex = content.indexOf(startSearch);

if (startIndex === -1) {
    console.log('Start marker not found');
    process.exit(1);
}

// Find the start of openPaymentModal
const endSearch = "const openPaymentModal = (bookingId: string, isOrder?: boolean) => {";
const endIndex = content.indexOf(endSearch);

if (endIndex === -1) {
    console.log('End marker not found');
    process.exit(1);
}

// We want to keep everything up to the end of the catch block of saveEditing
// The catch block ends with a } and finally with a } and the function with a };
// Looking at Turn 246, line 460 is the }; of saveEditing.
// So we find the first }; after startIndex.

const functionEndIndex = content.indexOf('};', startIndex);
if (functionEndIndex === -1 || functionEndIndex > endIndex) {
    console.log('Function end not found or out of bounds');
    process.exit(1);
}

const cleanContent = content.substring(0, functionEndIndex + 2) + "\n\n  " + content.substring(endIndex);
fs.writeFileSync(filePath, cleanContent);
console.log('Admin.tsx repaired successfully via substring.');
