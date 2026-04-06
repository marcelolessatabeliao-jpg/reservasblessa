import fs from 'fs';

const adminPath = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx';
const originalPath = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/tmp/original_admin_utf8.tsx';

let adminContent = fs.readFileSync(adminPath, 'utf8');
let originalContent = fs.readFileSync(originalPath, 'utf8');

// 1. Reconstruct the handleQuadFileUpload closure part
const handleQuadStartMarker = "const isOrder = resId.toString().startsWith('order-');";
const handleQuadEndMarker = "const renderDashboard = () => {";

// 2. Reconstruct the renderDashboard function
const dashboardEndMarker = "const renderKioskTab = () => {";

// Find positions in Admin.tsx (corrupted file)
const adminStartIndex = adminContent.indexOf(handleQuadStartMarker);
const adminEndIndex = adminContent.indexOf(dashboardEndMarker);

if (adminStartIndex === -1 || adminEndIndex === -1) {
    console.error("Could not find markers in Admin.tsx", { adminStartIndex, adminEndIndex });
    process.exit(1);
}

// Find clean code in originalContent
const originalStartIndex = originalContent.indexOf(handleQuadStartMarker);
const originalEndIndex = originalContent.indexOf(dashboardEndMarker);

if (originalStartIndex === -1 || originalEndIndex === -1) {
    console.error("Could not find markers in originalContent", { originalStartIndex, originalEndIndex });
    process.exit(1);
}

// Extract clean fragment
let cleanFragment = originalContent.substring(originalStartIndex, originalEndIndex);

// Apply the /3 quadricycle limit fix inside the fragment
cleanFragment = cleanFragment.replace(/{count}\/5 ocupados/g, "{count}/3 ocupados");

// Replace the corrupted block in Admin.tsx
const newAdminContent = adminContent.substring(0, adminStartIndex) + cleanFragment + adminContent.substring(adminEndIndex);

fs.writeFileSync(adminPath, newAdminContent);
console.log("Admin.tsx repaired successfully!");
