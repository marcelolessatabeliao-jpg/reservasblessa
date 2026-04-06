const fs = require('fs');
const path = require('path');

const adminPath = path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

const mapping = {
  'Açíµes': 'Ações',
  'í­': 'í',
  'í¡': 'í',
  'í ': 'Á', // Targetting 'HORí RIO'
  'íƒÆ’': 'Ã', // Targetting 'NíƒÆ’O'
  'extraí­da': 'extraída',
  'extraí­das': 'extraídas',
  'SIMULAÇíO': 'SIMULAÇÃO',
  'Açãµes': 'Ações',
  'Açíµes': 'Ações',
  'Açíµes': 'Ações',
};

let newContent = content;

// Direct replacements for the most offensive ones found in grep
newContent = newContent.replace(/Açíµes/g, 'Ações');
newContent = newContent.replace(/extraí­da/g, 'extraída');
newContent = newContent.replace(/extraí­das/g, 'extraídas');
newContent = newContent.replace(/HORí RIO NíƒÆ’O DEFINIDO/g, 'HORÁRIO NÃO DEFINIDO');
newContent = newContent.replace(/íƒÆ’/g, 'Ã'); // In case of others
newContent = newContent.replace(/SIMULAÇíO/g, 'SIMULAÇÃO');

// General encoding cleanup for the weird 'í' combinations if they still exist
newContent = newContent.replace(/çíµ/g, 'çõ');
newContent = newContent.replace(/í¡/g, 'á');
newContent = newContent.replace(/í©/g, 'é');
newContent = newContent.replace(/í­/g, 'í');
newContent = newContent.replace(/í³/g, 'ó');
newContent = newContent.replace(/íº/g, 'ú');
newContent = newContent.replace(/í£/g, 'ã');

fs.writeFileSync(adminPath, newContent, 'utf8');
console.log("Admin.tsx deep-cleaned!");
