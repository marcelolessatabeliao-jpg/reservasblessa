const fs = require('fs');
const path = require('path');

// Patterns identified from grep output
const fixes = [
    { search: /Açíµes/g, replace: 'Ações' },
    { search: /extraí­da/g, replace: 'extraída' },
    { search: /extraí­das/g, replace: 'extraídas' },
    { search: /SIMULAÇíO/g, replace: 'SIMULAÇÃO' },
    { search: /HORí RIO NíƒÆ’O DEFINIDO/g, replace: 'HORÁRIO NÃO DEFINIDO' },
    { search: /âœ“/g, replace: '✓' },
    { search: /í¢Å“â€œ/g, replace: '✓' },
    { search: /Ã§Ã£o/g, replace: 'ção' },
    { search: /├º/g, replace: 'ç' },
    { search: /├í/g, replace: 'á' },
    { search: /├ú/g, replace: 'ã' },
    { search: /├®/g, replace: 'é' },
    { search: /Ã©/g, replace: 'é' },
    { search: /├│/g, replace: 'ó' },
    { search: /├║/g, replace: 'ú' },
    { search: /├¡/g, replace: 'í' },
    { search: /├Á/g, replace: 'õ' },
    { search: /├┤/g, replace: 'ô' },
    { search: /├¬/g, replace: 'ê' },
    { search: /├ó/g, replace: 'â' },
    { search: /í¡/g, replace: 'í' },
    { search: /í /g, replace: 'Á' },
];

const scanDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                scanDir(fullPath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content;
            
            for (const fix of fixes) {
                newContent = newContent.replace(fix.search, fix.replace);
            }
            
            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Fixed: ${fullPath}`);
            }
        }
    }
};

scanDir(path.resolve('c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src'));
console.log("Global Portuguese cleanup finished!");
