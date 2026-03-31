import fs from 'fs';
let content = fs.readFileSync('src/components/admin/BookingTable.tsx', 'utf8');

content = content.replace('border-collapse', 'border-separate border-spacing-y-3');
content = content.replace('text-[10px] font-extrabold uppercase text-emerald-700/80', 'text-[10px] font-extrabold uppercase text-white');
content = content.replace('<tbody className=\"divide-y-4 divide-emerald-100 bg-slate-50/30\">', '<tbody className=\"bg-transparent\">');
content = content.replace('className={cn(\\r\\n                               \"group transition-all cursor-pointer duration-300\",\\r\\n                               isSelected ? \"bg-emerald-100/50\" : \"bg-white hover:bg-emerald-50\",', 'className={cn(\\n                               \"group transition-all cursor-pointer duration-300 shadow-sm hover:shadow-md\",\\r\\n                               isSelected ? \"bg-emerald-100/50 outline outline-2 outline-emerald-400\" : \"bg-white hover:bg-emerald-50/70\",');
content = content.replace('text-center\">\\r\\n                                 <input', 'text-center rounded-l-2xl border-y border-l border-emerald-100/60\">\\r\\n                                 <input');
content = content.replace('<td className=\"p-5\">\\r\\n                                 <div className=\"space-y-1 min-w-[130px]\">', '<td className=\"p-5 border-y border-emerald-100/60\">\\r\\n                                 <div className=\"space-y-2 min-w-[150px]\">');
content = content.replace('<td className=\"p-5\">\\r\\n                                 <div className=\"flex flex-col gap-0.5\">', '<td className=\"p-5 border-y border-emerald-100/60\">\\r\\n                                 <div className=\"flex flex-col gap-0.5\">');
content = content.replace('text-[13px] font-bold uppercase tracking-tight', 'text-[15px] font-black uppercase tracking-tight');
content = content.replace('text-emerald-600', 'text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md'); // For isToday
content = content.replace('text-[9px] font-bold text-emerald-950/70 uppercase tracking-widest pl-5', 'text-[10px] font-black text-emerald-800 uppercase tracking-widest pl-6');
content = content.replace('bg-emerald-50/50 text-emerald-900/80 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold text-[8px]', 'bg-slate-100 text-slate-800 border-2 border-slate-200 px-3 py-1 rounded-lg font-black text-[10px]');
content = content.replace('className=\"p-5 text-center\">\\r\\n                                 <div className=\"inline-flex', 'className=\"p-5 text-center border-y border-emerald-100/60\">\\r\\n                                 <div className=\"inline-flex');
content = content.replace('className=\"p-5 text-right\">\\r\\n                                 <div className=\"flex flex-col', 'className=\"p-5 text-right border-y border-emerald-100/60\">\\r\\n                                 <div className=\"flex flex-col');
content = content.replace('className=\"p-5 text-center\">\\r\\n                                 <Button size=\"icon\"', 'className=\"p-5 text-center border-y border-r border-emerald-100/60 rounded-r-2xl\">\\r\\n                                 <Button size=\"icon\"');

fs.writeFileSync('src/components/admin/BookingTable.tsx', content);
console.log('Update Complete');
