import fs from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Global Overflow & Main Padding Fix
content = content.replace(
  /className="min-h-screen bg-\[radial-gradient\(ellipse_at_top_right,_var\(--tw-gradient-stops\)\)\] from-emerald-900 via-slate-950 to-black bg-fixed"/,
  'className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900 via-slate-950 to-black bg-fixed overflow-x-hidden"'
);
content = content.replace(
  /max-w-7xl mx-auto space-y-8 relative z-10 p-4 md:p-8/,
  'max-w-7xl mx-auto space-y-6 md:space-y-8 relative z-10 p-3 md:p-8'
);

// 2. Stats Cards Fix (Remove Height & Padding)
content = content.replace(
  /grid-cols-2 md:grid-cols-4 gap-3 flex-1 px-4/,
  'grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 flex-1 px-0 md:px-4'
);
const statsRegex = /className="cursor-pointer (bg-[a-z-]+-900) border-2 border-([a-z-]+-500|\[#FFF033\]\/50) shadow-xl rounded-2xl p-2 flex items-center justify-between hover:bg-[a-z-]+-800 transition-all group overflow-hidden relative h-\[65px\]"/g;
content = content.replace(statsRegex, 'className="cursor-pointer $1 border-2 border-$2 shadow-xl rounded-2xl p-2 md:p-3 flex items-center justify-between hover:bg-$1 transition-all group overflow-hidden relative min-h-[60px] md:h-[65px]"');

// Fix specific stats card classes that might have been slightly different
content = content.replace(
  /text-base font-black tabular-nums text-\[#FFF033\]/g,
  'text-sm md:text-base font-black tabular-nums text-[#FFF033]'
);

// 3. Move Update Button to Header
// First, find the logout button row
const logoutButtonRowRegex = /<div className="flex items-center gap-4 shrink-0">[\s\S]+?<\/div>/;
const newHeaderButtons = `              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                 <Button 
                   variant="outline"
                   className="rounded-2xl bg-white/10 border-2 border-white/20 font-black h-10 md:h-12 px-4 md:px-6 hover:bg-white/20 text-[#FFF033] shadow-xl backdrop-blur-md transition-all active:scale-95" 
                   onClick={fetchData} 
                   disabled={loading}
                 >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    <span className="ml-2 hidden md:inline">Atualizar</span>
                 </Button>

                 <Button 
                   className="rounded-2xl bg-[#FFF033] text-black font-black h-10 md:h-12 px-6 md:px-8 shadow-2xl hover:scale-105 active:scale-95 transition-all border-0 text-sm md:text-base" 
                   onClick={handleLogout}
                 >
                    <LogOut className="w-5 h-5 md:mr-2" /> <span className="hidden md:inline">Sair</span>
                 </Button>
              </div>`;
content = content.replace(logoutButtonRowRegex, newHeaderButtons);

// 4. Tabs Component Grid Conversion
const tabsContainerRegex = /<div className="flex items-center p-1\.5 md:p-2 bg-emerald-950\/60 backdrop-blur-xl rounded-2xl md:rounded-3xl w-full max-w-5xl mr-auto overflow-x-auto border border-white\/20 shadow-premium mb-6 no-scrollbar gap-1\.5 md:gap-2">/;
content = content.replace(tabsContainerRegex, '<div className="grid grid-cols-2 lg:flex lg:items-center p-1.5 md:p-2 bg-emerald-950/60 backdrop-blur-xl rounded-2xl md:rounded-3xl w-full max-w-5xl mr-auto border border-white/20 shadow-premium mb-6 gap-1.5 md:gap-2">');

// Individual tab buttons
content = content.replace(
  /flex-1 px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-\[11px\] md:text-\[13px\]/g,
  'px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px]'
);

// Make the last tab (Vendas) span 2 columns on mobile if there's an odd number? 
// No, there are 5 tabs. So 2 + 2 + 1.
content = content.replace(
  /activeTab === 'vendas' \? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white\/10"\s+\)>\s+<ShoppingBag/,
  'activeTab === \'vendas\' ? "bg-amber-500 text-amber-950 shadow-md" : "text-white hover:bg-white/10"\n             )}>\n                <ShoppingBag'
);
// Actually, let's just target the Vendas button to add col-span-2
content = content.replace(
  /"px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-\[11px\] md:text-\[13px\] font-black flex items-center justify-center gap-1\.5 md:gap-2\.5 transition-all whitespace-nowrap", \n               activeTab === 'vendas'/,
  '"col-span-2 lg:flex-1 px-4 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black flex items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap", \n               activeTab === \'vendas\''
);

// Remove the old Update button from tabs
const oldUpdateButtonAndDividerRegex = /<div className="w-px h-8 bg-white\/10 mx-2 shrink-0" \/>\s+<Button \s+variant="ghost" \s+className="rounded-xl md:rounded-2xl bg-white\/5 border border-white\/10 font-black h-10 md:h-12 px-4 md:px-6 hover:bg-white\/10 text-white transition-all backdrop-blur-md shrink-0 focus-visible:ring-0" \s+onClick=\{fetchData\} \s+disabled=\{loading\}\s+>\s+\{loading \? <Loader2 className="w-5 h-5 animate-spin" \/> : <RefreshCw className="w-5 h-5 text-\[#FFF033\]" \/>\}\s+<span className="ml-2">Atualizar<\/span>\s+<\/Button>/;
content = content.replace(oldUpdateButtonAndDividerRegex, '');

fs.writeFileSync(filePath, content);
console.log('Update complete v4!');
