import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The file is corrupted between line 460 and 507.
const startMarker = "const saveEditing = async (type: 'kiosk' | 'quad') => {";
const endMarker = "const openPaymentModal = (bookingId: string, isOrder?: boolean) => {";

const parts = content.split(startMarker);
if (parts.length > 1) {
    const subParts = parts[1].split(endMarker);
    if (subParts.length > 1) {
        // Find the END of the saveEditing function body (the first branch closing after startMarker)
        const saveEditingBodyEnd = subParts[0].lastIndexOf("};");
        if (saveEditingBodyEnd !== -1) {
             const cleanContent = parts[0] + startMarker + subParts[0].substring(0, saveEditingBodyEnd + 2) + "\n\n  " + endMarker + subParts[1];
             fs.writeFileSync(filePath, cleanContent);
             console.log('Admin.tsx surgically repaired.');
        } else {
             console.log('Could not find end of saveEditing');
        }
    } else {
        console.log('Could not find marker2');
    }
} else {
    console.log('Could not find marker1');
}
