import fs from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(adminPath, 'utf8');

// Align all widths to w-10 (mobile) and w-14 (desktop)
// 1. Head Cell
content = content.replace(
  /head_cell: "text-emerald-900 font-extrabold text-\[11px\] uppercase tracking-\[0.2em\] w-12 py-4"/,
  'head_cell: "text-emerald-900 font-extrabold text-[11px] uppercase tracking-[0.2em] w-10 md:w-14 py-4"'
);

// 2. Cell
content = content.replace(
  /cell: "h-10 w-10 md:h-14 md:w-14 text-center p-0 relative focus-within:z-20"/,
  'cell: "h-10 w-10 md:h-14 md:w-14 text-center p-0 relative focus-within:z-20"'
);

// 3. Day (The clickable button inside the cell)
// Must be equal or smaller than cell. We'll make it equal.
const dayRegex = /day: cn\(\n\s+"h-12 w-12 p-0 font-black text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50\/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto",\n\s+"flex flex-col items-center justify-center gap-1"\n\s+\),/;

const dayReplacement = `day: cn(
                        "h-10 w-10 md:h-14 md:w-14 p-0 font-black text-[11px] md:text-sm transition-all rounded-full border-2 border-transparent bg-transparent text-emerald-950 hover:bg-emerald-100/50 mx-auto"
                      ),`;

content = content.replace(dayRegex, dayReplacement);

// 4. Ensure table is fixed layout to force columns to follow widths
content = content.replace(
  /table: "w-full border-collapse"/,
  'table: "w-full border-collapse table-fixed"'
);

fs.writeFileSync(adminPath, content);
console.log('Calendar Alignment Fixed!');
