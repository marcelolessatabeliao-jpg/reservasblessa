const fs = require('fs');
const path = require('path');

const filesToClean = [
  'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx',
  'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/components/SpecialPlansSection.tsx',
  'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/lib/booking-service.ts',
  'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/components/PricingComparisonSection.tsx',
];

const generalMap = {
  'íµ': 'õ',
  'í­': 'í',
  'í¡': 'á',
  'í©': 'é',
  'í³': 'ó',
  'íº': 'ú',
  'í£': 'ã',
  'í ': 'Á', 
  'íƒÆ’': 'Ã', 
  'Ã§Ã£o': 'ção',
  '├º': 'ç',
  '├í': 'á',
  '├ú': 'ã',
  '├®': 'é',
  'Ã©': 'é',
  '├│': 'ó',
  '├║': 'ú',
  '├¡': 'í',
  '├Á': 'õ',
  '├┤': 'ô',
  '├¬': 'ê',
  '├ó': 'â',
  'SIMULAÇíO': 'SIMULAÇÃO',
  'Açíµes': 'Ações',
  'Açíµes': 'Ações',
  'Açíµes': 'Ações',
  'Açíµes': 'Ações',
};

filesToClean.forEach(f => {
    const absPath = path.resolve(f);
    if (!fs.existsSync(absPath)) return;
    
    let content = fs.readFileSync(absPath, 'utf8');
    let newContent = content;
    
    // Apply general map
    for (const [key, val] of Object.entries(generalMap)) {
      newContent = newContent.replace(new RegExp(key, 'g'), val);
    }
    
    // Specific long-string fixes
    newContent = newContent.replace(/HORí RIO NíƒÆ’O DEFINIDO/g, 'HORÁRIO NÃO DEFINIDO');
    newContent = newContent.replace(/extraí­da/g, 'extraída');
    newContent = newContent.replace(/extraí­das/g, 'extraídas');
    newContent = newContent.replace(/quadricido/g, 'quadriciclo');
    newContent = newContent.replace(/solidario/g, 'solidário');
    newContent = newContent.replace(/reserva├º├úo/g, 'reserva');

    if (newContent !== content) {
        fs.writeFileSync(absPath, newContent, 'utf8');
        console.log(`Deep cleaned: ${f}`);
    }
});
