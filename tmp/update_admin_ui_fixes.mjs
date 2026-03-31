import fs from 'fs';

let txt = fs.readFileSync('src/components/admin/BookingTable.tsx', 'utf8');

// 1. Fix the popup using createPortal
if (!txt.includes('createPortal')) {
   txt = txt.replace('import React, { useState', "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';\n//");
   txt = txt.replace("import { createPortal } from 'react-dom';\n// }", "import { createPortal } from 'react-dom';"); // cleanup if duplicated accidentally
}

// Ensure createPortal isn't duplicated
if (txt.match(/createPortal/g) && txt.match(/createPortal/g).length > 2) {
    // Already did it probably
} else {
// replace the old inline popup
txt = txt.replace(/\{selectedIds\.size > 0 && \([\s\S]*?<\/div>[\r\n\s]*\)\}/m, 
`{selectedIds.size > 0 && typeof document !== 'undefined' && createPortal(
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-8 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-12 duration-500 backdrop-blur-2xl">
             <div className="flex flex-col">
               <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">Selecionados</span>
               <span className="text-xl font-black tabular-nums">{selectedIds.size}</span>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <div className="flex gap-2">
                <Button onClick={() => handleBulkAction('confirm')} className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider">Confirmar</Button>
                <Button onClick={() => handleBulkAction('cancel')} className="bg-amber-500 hover:bg-amber-400 text-white font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider">Cancelar</Button>
                <Button onClick={() => handleBulkAction('delete')} variant="ghost" className="text-red-400 hover:text-red-100 font-bold text-[10px] h-10 px-4 rounded-xl uppercase">Excluir</Button>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-white/40 font-bold uppercase text-[9px] px-4 h-10 rounded-xl">Limpar</Button>
          </div>, document.body
        )}`);
}

// 2. Remove the white box wrapping the header
txt = txt.replace('<div className="bg-white rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-xl border border-emerald-100/50">', '<div className="bg-transparent">');

// 3. Make the header rounded at the top to look good.
txt = txt.replace('<th className="px-5 md:px-8 py-6">{/* Checkbox */}</th>', '<th className="px-5 md:px-8 py-6 rounded-tl-2xl">{/* Checkbox */}</th>');
txt = txt.replace('<th className="px-5 md:px-8 py-6 text-center">Ações</th>', '<th className="px-5 md:px-8 py-6 text-center rounded-tr-2xl">Ações</th>');

fs.writeFileSync('src/components/admin/BookingTable.tsx', txt);
console.log('BookingTable updated');

// Let's fix Admin.tsx: "Atualizar" and "Sair" buttons
let adminTxt = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
adminTxt = adminTxt.replace('<RefreshCw className="mr-2 h-4 w-4" /> Atualizar', '<RefreshCw className="h-5 w-5" />');
adminTxt = adminTxt.replace('<LogOut className="mr-2 h-4 w-4" /> Sair', '<LogOut className="h-5 w-5" />');

// Remove corrupted 'horÃ¡rio' text directly
adminTxt = adminTxt.replace(/horrio/g, 'horário');
adminTxt = adminTxt.replace(/Aoes/g, 'Ações');
adminTxt = adminTxt.replace(/Aes/g, 'Ações');
adminTxt = adminTxt.replace(/Histrico/g, 'Histórico');
adminTxt = adminTxt.replace(/1 horrio\(s\) reservado\(s\)/g, '1 horário(s) reservado(s)');

fs.writeFileSync('src/pages/Admin.tsx', adminTxt);
console.log('Admin updated');

// Now, the Sales/Orders tab (RenderOrderTab)
// "e em vendas também separe as vendas com espaço e contorno"
// Let's modify Order Tab table styles
// Search for renderOrderTab in Admin.tsx
// I will just open Admin.tsx with view_file to correctly apply the orders filter and styles.
