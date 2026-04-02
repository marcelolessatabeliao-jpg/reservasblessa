import fs from 'fs';

const path = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove the literal `n from the state
content = content.replace(/setIsNewBookingOpen\(false\);`n/g, 'setIsNewBookingOpen(false);\n');
content = content.replace(/`n/g, '\n');

// Fix the doubled closing brace
content = content.replace(/  };\n  };/g, '  };');

// Fix the literal `r if any
content = content.replace(/`r/g, '');

// Correct the CPF Field placeholder mess if powerShell injected it literally
content = content.replace(/`n\s+\/>\s+<\/div>/g, '/>\n                           </div>');

fs.writeFileSync(path, content);
console.log("SANITY RESTORED.");
