import fs from 'fs';

let txt = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const replacements = {
  'Ã¡': 'á', 'Ã¢': 'â', 'Ã£': 'ã', 'Ã§': 'ç', 'Ã©': 'é', 'Ãª': 'ê', 
  'Ã­': 'í', 'Ã³': 'ó', 'Ãµ': 'õ', 'Ãº': 'ú', 'Ã‡': 'Ç', 'Ã\x81': 'Á', 'Ã\x89': 'É', 'Ã\x93': 'Ó'
};

let manualFixed = txt;
for (let [bad, good] of Object.entries(replacements)) {
   manualFixed = manualFixed.split(bad).join(good);
}

// Ensure the fix is applied and we fix the specific typo mentioned 
manualFixed = manualFixed.split('HISTÃ³RICO').join('HISTÓRICO');
manualFixed = manualFixed.split('HistÃ³rico').join('Histórico');

// Also update the colors: "ainda está ruim para visualizar com o fundo verde e cor de fonte azul ao passar o mouse"
// Let's replace the pill classes in Kiosks/Quads where they have bg-emerald-700/80 and hover colors.
manualFixed = manualFixed.replace(/bg-emerald-700\/80 text-blue-900/g, 'bg-emerald-700/80 text-white');
manualFixed = manualFixed.replace(/hover:bg-emerald-600 hover:text-blue-950/g, 'hover:bg-emerald-600 hover:text-white');
// And generally text-blue-900 on green background is bad. Let's find any text-blue- inside hover:bg-emerald... and fix
manualFixed = manualFixed.replace(/text-blue-900 font-black/g, 'text-emerald-50 font-black');

// For Kiosks Pills:
manualFixed = manualFixed.replace(/bg-emerald-\d+\/\d+\s+text-blue-\d+/g, 'bg-emerald-700/90 text-white');
manualFixed = manualFixed.replace(/hover:text-blue-\d+/g, 'hover:text-white');

fs.writeFileSync('src/pages/Admin.tsx', manualFixed, 'utf8');
console.log('Mojibake fixed and Pill Colors Updated');
