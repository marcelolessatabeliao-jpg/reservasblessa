const fs = require('fs');
const path = require('path');

const adminPath = path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx');
const originalPath = path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/tmp/original_admin_utf8.tsx');

const adminContent = fs.readFileSync(adminPath, 'utf8');
const originalContent = fs.readFileSync(originalPath, 'utf8');

// The marker where handleQuadFileUpload starts being corrupted
const markerStart = "const isOrder = resId.toString().startsWith('order-');";
// The marker where the dashboard ends and the kiosk tab starts
const markerEnd = "const renderKioskTab = () => {";

const adminStartIndex = adminContent.indexOf(markerStart);
const adminEndIndex = adminContent.indexOf(markerEnd);

const originalStartIndex = originalContent.indexOf(markerStart);
const originalEndIndex = originalContent.indexOf(markerEnd);

if (adminStartIndex === -1 || adminEndIndex === -1 || originalStartIndex === -1 || originalEndIndex === -1) {
    console.error("Markers not found!");
    process.exit(1);
}

let patch = originalContent.substring(originalStartIndex, originalEndIndex);

// Apply the custom 0/3 quad capacity limit as requested previously
patch = patch.replace(/{count}\/5 ocupados/g, "{count}/3 ocupados");

const repairedContent = adminContent.substring(0, adminStartIndex) + patch + adminContent.substring(adminEndIndex);

fs.writeFileSync(adminPath, repairedContent, 'utf8');
console.log("Admin.tsx successfully repaired and restored!");
