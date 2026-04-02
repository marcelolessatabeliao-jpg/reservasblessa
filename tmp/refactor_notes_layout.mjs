import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/components/admin/BookingTable.tsx';
let content = readFileSync(filePath, 'utf8');

// Step 1: Extract the Internal Notes block
const notesBlockRegex = /<div className="bg-emerald-950 text-white p-6 rounded-3xl shadow-lg border border-emerald-900 flex flex-col space-y-4">[\s\S]*?<\/div>\s+<\/div>/;
const notesMatch = content.match(notesBlockRegex);

if (!notesMatch) {
    console.error('Could not find Notes block');
    process.exit(1);
}

const originalNotesBlock = notesMatch[0];

// Step 2: Create the new Layout with 3 columns (2 for controls, 1 for notes)
// We'll replace the line 404 grid and move the notes inside it.
const gridSearch = /<div className="grid lg:grid-cols-2 gap-6 items-stretch">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/;

// The notes block needs to be resized
const resizedNotesBlock = originalNotesBlock
    .replace('p-6 rounded-3xl', 'p-4 rounded-2xl')
    .replace('space-y-4', 'space-y-2')
    .replace('min-h-[100px]', 'min-h-[80px]')
    .replace('text-xs', 'text-[10px]')
    .replace('text-sm', 'text-[9px]')
    .replace('h-10', 'h-8')
    .replace('text-[9px]', 'text-[8px]')
    .replace('bg-emerald-950', 'bg-emerald-950 lg:col-span-1');

const newGridContent = `
                                      <div className="grid lg:grid-cols-3 gap-6 items-stretch">
                                         {/* Ações Rápidas (2/3 do espaço) */}
                                         <div className="bg-white p-6 rounded-3xl shadow-lg border border-emerald-100 flex flex-col justify-between space-y-6 relative overflow-hidden group lg:col-span-2">
                                            $1
                                         </div>

                                         {/* Notas Internas (1/3 do espaço) */}
                                         ${resizedNotesBlock}
                                      </div>
`;

// First, remove the original notes block from the bottom
content = content.replace(originalNotesBlock, '');

// Then, insert the new grid
content = content.replace(gridSearch, newGridContent);

writeFileSync(filePath, content);
console.log('Successfully refactored layout to spend 1/3 on Notes and 2/3 on Controls.');
