import fs from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Dashboard Padmin fixes
// Reduce p-5 to p-3 md:p-5
content = content.replace(/p-5 border-b border-amber-300 flex/g, 'p-3 md:p-5 border-b border-amber-300 flex');
content = content.replace(/p-5 border-t border-amber-300 bg-amber-100\/60/g, 'p-3 md:p-5 border-t border-amber-300 bg-amber-100/60');

// Reduce p-8 to p-4 md:p-8
content = content.replace(/p-8 border-b xl:border-b-0 xl:border-r border-amber-300 bg-emerald-100\/40/g, 'p-4 md:p-8 border-b xl:border-b-0 xl:border-r border-amber-300 bg-emerald-100/40');
content = content.replace(/p-8 bg-blue-100\/30 space-y-6/g, 'p-4 md:p-8 bg-blue-100/30 space-y-6');

// 2. Calendar Size Fix (The Master Fix)
// Cell size from w-14 h-14 to w-10 h-10 on mobile
content = content.replace(
  /cell: "h-14 w-14 text-center p-0 relative focus-within:z-20"/,
  'cell: "h-10 w-10 md:h-14 md:w-14 text-center p-0 relative focus-within:z-20"'
);
// Day container size
content = content.replace(
  /day: cn\(\n\s+"h-12 w-12 p-0 font-black text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50\/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto"/,
  'day: cn(\n                        "h-8 w-8 md:h-12 md:w-12 p-0 font-black text-[10px] md:text-sm transition-all rounded-full border-2 border-emerald-50 bg-emerald-50/20 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100 shadow-sm mx-auto"'
);

// Caption Label size
content = content.replace(
  /caption_label: "text-\[12px\] font-black text-white uppercase tracking-\[0.2em\] flex-1 text-center"/,
  'caption_label: "text-[10px] md:text-[12px] font-black text-white uppercase tracking-[0.2em] flex-1 text-center"'
);

// Nav buttons
content = content.replace(
  /nav_button: "h-9 w-9 bg-emerald-500 text-white/,
  'nav_button: "h-7 w-7 md:h-9 md:w-9 bg-emerald-500 text-white'
);

fs.writeFileSync(filePath, content);
console.log('Update complete v7 (Dashboard/Calendar)!');
