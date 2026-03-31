const fs = require('fs');
const path = 'c:/Users/TERMINAL 00/Desktop/RESERVA LESSA/src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8').split('\r\n');
if (content.length === 1) content = fs.readFileSync(path, 'utf8').split('\n');

// Part 1: Fix duplicated stats and header
// We'll search for the first occurrence of "{/* STATS IN HEADER */}" and the second one.
let firstStatsIdx = content.findIndex(l => l.includes('{/* STATS IN HEADER */}'));
let secondStatsIdx = content.lastIndexOf(l => l.includes('{/* STATS IN HEADER */}'));

if (firstStatsIdx !== -1 && secondStatsIdx !== -1 && firstStatsIdx !== secondStatsIdx) {
    console.log(`Found stats at ${firstStatsIdx} and ${secondStatsIdx}. Repairing...`);
    
    // We want to replace the block from firstStatsIdx-1 (the closing div) up to secondStatsIdx
    // with the DESKTOP BUTTONS and a single stats header.
    const newHeaderBlock = [
        '              {/* DESKTOP BUTTONS (RIGHT) */}',
        '              <div className="hidden xl:flex items-center gap-4 shrink-0">',
        '                 <Button ',
        '                   variant="outline"',
        '                   className="rounded-2xl bg-white/10 border-2 border-white/20 font-black h-12 px-6 hover:bg-white/20 text-[#FFF033] shadow-xl backdrop-blur-md transition-all active:scale-95" ',
        '                   onClick={fetchData} ',
        '                   disabled={loading}',
        '                 >',
        '                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}',
        '                    <span className="ml-2">Atualizar</span>',
        '                 </Button>',
        '',
        '                 <Button ',
        '                   className="rounded-2xl bg-[#FFF033] text-black font-black h-12 px-8 shadow-2xl hover:scale-105 active:scale-95 transition-all border-0 text-base" ',
        '                   onClick={handleLogout}',
        '                 >',
        '                    <LogOut className="w-5 h-5 mr-2" /> <span>Sair</span>',
        '                 </Button>',
        '              </div>',
        '          </div>',
        '',
        '          {/* STATS IN HEADER */}',
        '          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 px-0 md:px-4">'
    ];

    // Splice from firstStatsIdx-1 to secondStatsIdx+1
    content.splice(firstStatsIdx - 1, (secondStatsIdx - firstStatsIdx) + 2, ...newHeaderBlock);
}

// Part 2: Remove old buttons at the bottom of the header container
let oldButtonsIdx = content.findIndex(l => l.includes('className="flex items-center gap-2 md:gap-4 shrink-0"') && content.indexOf(l) > 1400);
if (oldButtonsIdx !== -1) {
    console.log(`Found old buttons at ${oldButtonsIdx}. Removing...`);
    // Find the next closing div for this block.
    // It's approx 19 lines.
    content.splice(oldButtonsIdx, 19, '          </div>');
}

fs.writeFileSync(path, content.join('\r\n'));
console.log('Admin.tsx fixed!');
