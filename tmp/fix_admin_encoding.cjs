const fs = require('fs');
const path = require('path');

const adminPath = path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// A map of corrupted sequences to correct characters
const map = {
  '├º': 'ç',
  '├í': 'á',
  '├ú': 'ã',
  '├®': 'é',
  '├│': 'ó',
  '├║': 'ú',
  '├¡': 'í',
  '├Á': 'õ',
  '├┤': 'ô',
  '├¬': 'ê',
  '├ó': 'â',
  '├ê': 'É', // Some capital versions
  '├ë': 'É',
  '├Ç': 'À',
  '├ì': 'Í',
  '├Ò': 'Ó',
  '├Ü': 'Ú',
  '├é': 'Â',
  '├Ñ': 'å', 
  '├┐': '¿',
  '├æ': 'Ñ',
  '├Ö': 'Ù', 
  '├£': 'ü',
  '├æ': 'ñ',
  'âœ“': '✓',
  'í¢Å“â€œ': '✓'
};

// Replace sequences globally
let newContent = content;
for (const [key, val] of Object.entries(map)) {
  const regex = new RegExp(key, 'g');
  newContent = newContent.replace(regex, val);
}

// Additional manual fixes for specific strings seen in previous turns
newContent = newContent.replace(/Opera├º├úo Di├íria/g, 'Operação Diária');
newContent = newContent.replace(/Esta ├® uma reserva/g, 'Esta é uma reserva');
newContent = newContent.replace(/├ítivos/g, 'ativos');
newContent = newContent.replace(/Hist├│rico/g, 'Histórico');
newContent = newContent.replace(/├õ/g, 'õ');
newContent = newContent.replace(/├á/g, 'à');

// Specific fix for the user's report
newContent = newContent.replace(/opera├º├Áes/g, 'operações');

fs.writeFileSync(adminPath, newContent, 'utf8');
console.log("Admin.tsx successfully updated with correct Portuguese encoding!");
