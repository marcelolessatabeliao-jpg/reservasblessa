import fs from 'fs';

const fixFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    let txt = fs.readFileSync(filePath, 'utf8');

    // Fix all possible mojibake with the replacement character U+FFFD
    txt = txt.replace(/A\uFFFD\uFFFDes/g, 'Ações');
    txt = txt.replace(/A\uFFFD\uFFFDES/g, 'AÇÕES');
    txt = txt.replace(/A\uFFFD\uFFFD/g, 'AÇÃ'); // Sometimes part of a word
    txt = txt.replace(/a\uFFFD\uFFFDo/g, 'ação');
    txt = txt.replace(/n\uFFFDo/g, 'não');
    txt = txt.replace(/N\uFFFDo/g, 'Não');
    txt = txt.replace(/At\uFFFD /g, 'Até ');
    txt = txt.replace(/at\uFFFD /g, 'até ');
    txt = txt.replace(/hor\uFFFDrio/g, 'horário');
    txt = txt.replace(/Hor\uFFFDrio/g, 'Horário');
    txt = txt.replace(/Hist\uFFFDrico/g, 'Histórico');
    txt = txt.replace(/hist\uFFFDrico/g, 'histórico');
    txt = txt.replace(/liberar\uFFFD/g, 'liberará');
    txt = txt.replace(/espa\uFFFDo/g, 'espaço');
    txt = txt.replace(/M\uFFFDs/g, 'Mês');
    txt = txt.replace(/m\uFFFDs/g, 'mês');
    txt = txt.replace(/S\uFFFDcio/g, 'Sócio');
    txt = txt.replace(/s\uFFFDcio/g, 'sócio');
    txt = txt.replace(/N\uFFFDo/g, 'Não'); // Fallback
    
    // Also fix those that were mangled without U+FFFD (double check)
    txt = txt.replace(/Aes/g, 'Ações');
    txt = txt.replace(/horrio/g, 'horário');
    txt = txt.replace(/Histrico/g, 'Histórico');
    txt = txt.replace(/Aoes/g, 'Ações');

    fs.writeFileSync(filePath, txt, 'utf8');
}

// Fix files
fixFile('src/pages/Admin.tsx');
fixFile('src/components/admin/BookingTable.tsx');
fixFile('src/components/admin/BookingDetail.tsx');

let adminTxt = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Sales tab updates
// 1. Add filter input to Sales tab
const filterInputStr = `
           <div className="flex items-center gap-2">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-700/50" />
                 <Input 
                   type="text" 
                   placeholder="Buscar venda (Nome, CPF, ID)..." 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="pl-9 h-10 w-[300px] border-emerald-200 bg-white/50 focus:bg-white focus:ring-emerald-500 rounded-xl font-bold shadow-sm"
                 />
              </div>
              <Badge className="bg-amber-100 text-amber-900 border-0 font-bold">Total: {orders.length}</Badge>
           </div>
`;
// Replace the old right-side div in sales tab
adminTxt = adminTxt.replace(
    /(<div className="flex items-center gap-2">\s*<Badge className="bg-amber-100 text-amber-900 border-0 font-bold">Total: \{orders\.length\}<\/Badge>\s*<\/div>)/,
    filterInputStr
);

// We need to apply the filter logic inside renderOrderTab.
// Look for where orders.map happens inside renderOrderTab.
// The code might be: `orders.map((order, idx)` or similar
// Let's replace the orders array with a filtered one.
const oldOrdersMapRegex = /(<tbody>\s*)\{orders\.map\(\s*\(\s*order(.*?), idx(.*?)(\)\s*=>\s*\{)/s;
// Let's do it safer by splitting or using replace with function
if (adminTxt.includes('orders.map((order')) {
  adminTxt = adminTxt.replace(/orders\.map\(\(order/g, `orders.filter(order => {
     if (!search) return true;
     const s = search.toLowerCase();
     return (order.customer_name || '').toLowerCase().includes(s) ||
            (order.customer_phone || '').includes(s) ||
            (order.cpf || '').includes(s) ||
            (order.id || '').toLowerCase().includes(s) ||
            (order.created_at || '').includes(s);
  }).map((order`);
}

// 2. Separate sales rows with space and outline
// Change table styling
adminTxt = adminTxt.replace(/<table className="w-full text-left">([\s\S]*?)<thead className="bg-muted\/50 text-\[10px\] font-bold uppercase text-muted-foreground tracking-widest border-b border-border\/50">/m, `<table className="w-full text-left border-separate border-spacing-y-3">
             <thead className="bg-[#0b2b24] text-[10px] font-extrabold uppercase text-white tracking-widest">`);

// Replace the th classes in the sales tab
adminTxt = adminTxt.replace(/<th className="px-6 py-4">ID \/ Data<\/th>/, '<th className="px-6 py-4 rounded-tl-2xl">ID / Data</th>');
adminTxt = adminTxt.replace(/<th className="px-6 py-4 text-right">Ações<\/th>/, '<th className="px-6 py-4 text-right rounded-tr-2xl">Ações</th>');

// Change the row styles
// tr className="border-b border-border/50 hover:bg-muted/30 transition-colors"
adminTxt = adminTxt.replace(/<tr key=\{idx\} className="border-b border-border\/50 hover:bg-muted\/30 transition-colors">/g, '<tr key={idx} className="bg-white hover:bg-amber-50/50 transition-all shadow-sm border-2 border-amber-100/50 rounded-2xl">');
// Since it's border separate, we need to add td borders if we want an outline, or just rely on shadow. 
// A typical trick: td get border-y and first/last td get border-l/r and rounded corners.
adminTxt = adminTxt.replace(/<td className="px-6 py-4">/g, '<td className="p-5 border-y border-amber-100/50">');
adminTxt = adminTxt.replace(/<td className="p-5 border-y border-amber-100\/50">\s*<div className="flex flex-col gap-1">/g, '<td className="p-5 border-y border-l border-amber-100/50 rounded-l-2xl">\n                    <div className="flex flex-col gap-1">');
adminTxt = adminTxt.replace(/<td className="px-6 py-4 text-right">/g, '<td className="p-5 text-right border-y border-r border-amber-100/50 rounded-r-2xl">');

// Also remove the tbody background/divide if any
adminTxt = adminTxt.replace(/<tbody className="divide-y-4 divide-emerald-100 bg-slate-50\/30">/, '<tbody className="bg-transparent">');

fs.writeFileSync('src/pages/Admin.tsx', adminTxt, 'utf8');
console.log('UI Fixes Applied');
