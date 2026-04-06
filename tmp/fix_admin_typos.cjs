const fs = require('fs');
const path = require('path');

const adminPath = path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// Typo replacements
const typoMap = {
  'quadricido': 'quadriciclo',
  'solidario': 'solidário',
  'crianca': 'criança',
  'atualizaçíµes': 'atualizações', // Residual encoding
  'atualizaçãµes': 'atualizações', // Another variant
  'reagendado': 'reagendado', // Just in case
  'excluí­do': 'excluído',
  'excluí¡do': 'excluído',
  'indiv': 'individual', // Consistency if needed, but wait 'indiv' is used in slot logic
};

let newContent = content;

// Replace typos in UI strings (avoiding regex on code logic where possible, but here it's safer to just replace standard typos)
newContent = newContent.replace(/quadricido/g, 'quadriciclo');
newContent = newContent.replace(/atualizaçíµes/g, 'atualizações');
newContent = newContent.replace(/atualizaçãµes/g, 'atualizações');

// Only replace 'crianca' if it's in a string literal or HTML, not necessarily code logic unless it's a search keyword
newContent = newContent.replace(/'crianca'/g, "'criança'");
newContent = newContent.replace(/"crianca"/g, '"criança"');
newContent = newContent.replace(/>crianca</g, '>criança<');

// Specific check for Line 110: if (slow.includes('crianca'))
// Here it should probably stay 'crianca' for the database/metadata check, 
// BUT the user said "fix all typos". 
// To be safe, I'll add the accented version as an OR in the includes.

newContent = newContent.replace(/slow\.includes\('crianca'\)/g, "slow.includes('crianca') || slow.includes('criança')");

// Fix the user's specific complaint about encoding that I already targeted but checking again
newContent = newContent.replace(/opera├º├Áes/g, 'operações');

fs.writeFileSync(adminPath, newContent, 'utf8');
console.log("Admin.tsx successfully updated with Portuguese spelling and language fixes!");
