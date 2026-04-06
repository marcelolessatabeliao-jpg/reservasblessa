const fs = require('fs');
const path = require('path');

const files = [
  path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/components/SpecialPlansSection.tsx'),
  path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/components/LessaClubSimulator.tsx')
];

files.forEach(f => {
  if (!fs.existsSync(f)) {
      console.log(`File not found: ${f}`);
      return;
  }
  let content = fs.readFileSync(f, 'utf8');
  
  // Fix the label
  content = content.replace(/Pessoas pagantes \(12 a 59 anos\)/g, 'Total de Pessoas (Com Gratuidades)');
  
  // Fix the value
  content = content.replace(/\{payingPeople\} \{payingPeople === 1 \? 'Pessoa' : 'Pessoas'\}/g, "{totalPeople} {totalPeople === 1 ? 'Pessoa' : 'Pessoas'}");
  
  // Fix the WhatsApp message total if it still uses payingPeople for the "Total" line
  content = content.replace(/- Total: \$\{payingPeople\} pessoas pagantes/g, "- Total: ${totalPeople} pessoas");
  
  fs.writeFileSync(f, content, 'utf8');
  console.log(`Fixed: ${f}`);
});
