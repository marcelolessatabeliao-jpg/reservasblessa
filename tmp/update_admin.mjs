import fs from 'fs';
import path from 'path';

const filePath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Kiosk Hover & Text Color Fix (Multiple occurrences possible)
const kioskDivRegex = /<div key={k\.id} className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between group">/g;
content = content.replace(kioskDivRegex, '<div key={k.id} className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between group hover:bg-emerald-800 transition-all cursor-default">');

// We need to fix the spans inside. Since they are children of the group, we use group-hover.
// This is safest with a replacement of the specific span classes.
content = content.replace(/className="font-black text-emerald-950 text-\[13px\]">/g, 'className="font-black text-emerald-950 text-[13px] group-hover:text-white transition-colors">');
content = content.replace(/className="text-emerald-700 font-bold italic text-\[13px\] text-right">/g, 'className="text-emerald-700 font-bold italic text-[13px] text-right group-hover:text-emerald-100 transition-colors">');
content = content.replace(/className="text-emerald-800\/80 italic font-bold text-\[13px\]">/g, 'className="text-emerald-800/80 italic font-bold text-[13px] group-hover:text-emerald-200\/50 transition-colors">');

// 2. Quad Badge Hover Fix
content = content.replace(
  /className="bg-transparent text-blue-700\/80 font-bold italic lowercase text-\[11px\] px-2 py-0 border-0 shadow-none"/g,
  'className="bg-transparent text-blue-700/80 font-bold italic lowercase text-[11px] px-2 py-0 border-0 shadow-none hover:bg-blue-600 hover:text-white hover:opacity-100 transition-all cursor-default"'
);

// 3. Header/Logo Optimization
content = content.replace(
  /<h1 className="text-5xl font-black tracking-tighter flex items-center gap-4">/g,
  '<h1 className="text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-4">'
);
content = content.replace(
  /-space-y-2/g,
  '-space-y-1 md:-space-y-2'
);
content = content.replace(
  /text-2xl text-\[#FFF033\]\/80/g,
  'text-xl md:text-2xl text-[#FFF033]/80'
);
content = content.replace(
  /text-5xl text-\[#FFF033\]/g, // The one inside the h1
  'text-4xl md:text-5xl text-[#FFF033]'
);
content = content.replace(
  /tracking-\[0\.3em\] text-\[10px\]/g,
  'tracking-[0.2em] md:tracking-[0.3em] text-[8px] md:text-[10px]'
);

// 4. Logout Button Size
content = content.replace(
  /h-12 px-8 shadow-2xl hover:scale-105 active:scale-95 transition-all border-0"/g,
  'h-10 md:h-12 px-6 md:px-8 shadow-2xl hover:scale-105 active:scale-95 transition-all border-0 text-sm md:text-base"'
);

// 5. Tabs Layout
// We already replaced the container line (1304) in previous run, but let's make it idempotent.
if (!content.includes('rounded-2xl md:rounded-3xl')) {
  content = content.replace(
    /p-2 bg-emerald-950\/60 backdrop-blur-xl rounded-3xl/g,
    'p-1.5 md:p-2 bg-emerald-950/60 backdrop-blur-xl rounded-2xl md:rounded-3xl'
  );
}

// 6. Tab Buttons - individual classes
content = content.replace(
  /px-8 py-4 rounded-2xl text-\[13px\]/g,
  'px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px]'
);
content = content.replace(
  /gap-2\.5 transition-all whitespace-nowrap/g,
  'gap-1.5 md:gap-2.5 transition-all whitespace-nowrap'
);
// Icon sizes in tabs
content = content.replace(
  /className="w-4\.5 h-4\.5"/g,
  'className="w-4 h-4 md:w-4.5 md:h-4.5"'
);

// Update Button
content = content.replace(
  /rounded-2xl bg-white\/5 border border-white\/10 font-black h-12 px-6/g,
  'rounded-xl md:rounded-2xl bg-white/5 border border-white/10 font-black h-10 md:h-12 px-4 md:px-6'
);

// 7. Content Area
if (!content.includes('p-4 md:p-8')) {
  content = content.replace(
    /bg-white\/40 backdrop-blur-md rounded-\[3rem\] p-8/g,
    'bg-white/40 backdrop-blur-md rounded-2xl md:rounded-[3rem] p-4 md:p-8'
  );
}

fs.writeFileSync(filePath, content);
console.log('Update complete v3!');
