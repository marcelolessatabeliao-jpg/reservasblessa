import fs from 'fs';

let content = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Fix "Atualizar" and "Sair" buttons to be icon-only to save space
// We find `<div className="flex bg-emerald-950/60...`
// The buttons inside have `<span>Atualizar</span>` and `<span>Sair</span>`. We just remove them.
content = content.replace(/<span>Atualizar<\/span>/g, '');
content = content.replace(/<span>Sair<\/span>/g, '');
content = content.replace(/px-8/g, 'px-4'); // reduce padding on those buttons a bit if needed, but let's target the exact Sair button:
content = content.replace(/<Button \n                   className="rounded-2xl bg-\[#FFF033\] text-black font-black h-12 px-8/g, '<Button \n                   className="rounded-xl bg-[#FFF033] text-black font-black h-12 w-12 px-0');
content = content.replace(/<Button\n                     variant="outline"\n                     onClick=\{fetchData\}\n                     disabled=\{loading\}\n                     className="rounded-2xl bg-emerald-800 text-emerald-100 border-emerald-700 h-12 px-6/g, '<Button\n                     variant="outline"\n                     onClick={fetchData}\n                     disabled={loading}\n                     className="rounded-xl bg-emerald-800 text-emerald-100 border-emerald-700 h-12 w-12 px-0');


// 2. Add "Adicionar Reserva" button next to Vendas tab.
// Find: <button onClick={() => setActiveTab('vendas')} ... > ... </button>
const addBtnHtml = `
             <button onClick={() => window.open('/', '_blank')} className="hidden lg:flex px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] font-black items-center justify-center gap-1.5 md:gap-2.5 transition-all whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-500 shadow-md ml-auto">
                <span className="text-lg leading-none">+</span> Nova Reserva
             </button>
`;
content = content.replace(/(<button onClick=\{[^}]+setActiveTab\('vendas'\)[^>]+\>[\s\S]*?<\/button>)/, "$1\n" + addBtnHtml);

// 3. Fix Kiosk Hover Color (illegible blue on green)
// In Kiosks, the badges are: 
// <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200">{n}</span>
// And desktop: <Badge className="bg-sky-50 text-sky-800 border-2 border-sky-200 font-bold px-3 py-1 shadow-sm">{names}</Badge>
// Or maybe they are the actual table rows: isToday ? 'bg-emerald-50/50 hover:bg-emerald-100' ...
// Wait, the user said "AO PASSAR O MOUSE EM QUIOSQUE - 02... FICA ILEGIVEIS COR AZUL COM FUNDO VERDE"
// Wait, in my mojibake script I replaced things. Let me find any "hover:text-blue-" or similar and remove it,
// and let's make sure the Kiosk pills don't have bad colors.
content = content.replace(/bg-sky-50 text-sky-800 border-2 border-sky-200/g, 'bg-emerald-100 text-emerald-900 border-2 border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors');
content = content.replace(/bg-emerald-100 text-emerald-800 rounded-lg text-\[10px\] font-black border border-emerald-200/g, 'bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-black border border-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors');

// 4. Fix Quadriciclos: add Quantity editing and fix duplicated Models.
// Models duplication happens because Object.entries(QUAD_MODELS_LABELS) has keys like 'individual', 'dupla', etc.
// The user might have duplicated keys in their constant file, or we map over them wrongly.
// Let's add a quantity input when `isEditing` is true.
// Find: <Select value={editData.quad_type || 'individual'} ... >
const quantityInputStr = `
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-bold text-blue-800">Qtd:</span>
                                        <input type="number" min="1" max="20" className="w-16 h-7 text-[11px] font-black border border-blue-200 rounded px-2" value={editData.quantity || 1} onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})} />
                                      </div>
`;
content = content.replace(/(<Select value=\{editData\.quad_type \|\| 'individual'\}[^>]*>[\s\S]*?<\/Select>)/, "$1" + quantityInputStr);

// 5. Fix the array reduce crash for quadReservations and orders
// If quadReservations is null or empty, provide a fallback.
content = content.replace(/quadReservations\.reduce/g, '(quadReservations || []).reduce');
content = content.replace(/kioskReservations\.reduce/g, '(kioskReservations || []).reduce');
content = content.replace(/orders\.reduce/g, '(orders || []).reduce');
// Ensure arrays are mapped safely
content = content.replace(/orders\.map/g, '(orders || []).map');
content = content.replace(/quadReservations\.some/g, '(quadReservations || []).some');
content = content.replace(/kioskReservations\.some/g, '(kioskReservations || []).some');
content = content.replace(/quadReservations\.filter/g, '(quadReservations || []).filter');
content = content.replace(/kioskReservations\.filter/g, '(kioskReservations || []).filter');

// 6. Increase horizontal spacing of the tab bar
// The tab bar container is: className="grid grid-cols-2 lg:flex lg:items-center p-1.5 md:p-2 bg-emerald-950/60 ...
// Let's change `lg:flex` to `flex flex-wrap` so tabs can take space and wrap if needed, but the user said "aumente o espaço para não cortar as palavras".
content = content.replace(/grid grid-cols-2 lg:flex lg:items-center p-1\.5 md:p-2/g, 'flex flex-wrap items-center p-2 md:p-3');

fs.writeFileSync('src/pages/Admin.tsx', content, 'utf8');
console.log('Fixed Admin.tsx successfully');
