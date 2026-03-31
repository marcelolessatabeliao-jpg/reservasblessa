import fs from 'fs';

const adminPath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Update Table to be full width and fixed layout
content = content.replace(
  /table: "w-full border-collapse table-fixed"/,
  'table: "w-full border-collapse table-fixed"'
);
// In case it wasn't there or was different:
if (!content.includes('table: "w-full border-collapse table-fixed"')) {
   content = content.replace(
     /table: "w-full border-collapse"/,
     'table: "w-full border-collapse table-fixed"'
   );
}

// 2. Set Head Cell to exactly 1/7 of width (14.28%)
content = content.replace(
  /head_cell: "text-emerald-900 font-extrabold text-\[11px\] uppercase tracking-\[0.2em\] w-10 md:w-14 py-4"/,
  'head_cell: "text-emerald-900 font-extrabold text-[10px] md:text-[11px] uppercase tracking-[0.1em] md:tracking-[0.2em] w-[14.28%] py-4 text-center"'
);

// 3. Set Cell to exactly 1/7 of width
content = content.replace(
  /cell: "h-10 w-10 md:h-14 md:w-14 text-center p-0 relative focus-within:z-20"/,
  'cell: "h-10 md:h-14 w-[14.28%] text-center p-0 relative focus-within:z-20"'
);

// 4. Update Day to fill available width but keep circle shape
// We use aspect-square and max-w to keep it sane.
const dayRegex = /day: cn\(\n\s+"h-10 w-10 md:h-14 md:w-14 p-0 font-black text-\[11px\] md:text-sm transition-all rounded-full border-2 border-transparent bg-transparent text-emerald-950 hover:bg-emerald-100\/50 mx-auto"\n\s+\),/;

const dayReplacement = `day: cn(
                        "h-9 w-9 md:h-12 md:w-12 p-0 font-black text-[11px] md:text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50/10 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto",
                        "flex items-center justify-center"
                      ),`;

content = content.replace(dayRegex, dayReplacement);

fs.writeFileSync(adminPath, content);
console.log('Calendar Grid Optimized: 1/7 Width Columns + Centered Circles');
