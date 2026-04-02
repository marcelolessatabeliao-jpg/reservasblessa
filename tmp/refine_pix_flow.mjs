const fs = require('fs');

// --- 1. Update Admin.tsx UI ---
const adminPath = 'src/pages/Admin.tsx';
let adminData = fs.readFileSync(adminPath, 'utf8');

// Ensure Success UI is correctly placed in the modal
const section5Start = '<div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">';
const successBlock = `{generatedPix ? (
                          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 py-10 space-y-6">
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-8 border-emerald-500/20">
                               <img src={\`data:image/png;base64,\${generatedPix.encodedImage}\`} alt="QR Code" className="w-56 h-56" />
                            </div>
                            <div className="text-center space-y-2">
                               <p className="text-emerald-400 font-black uppercase text-xs tracking-widest leading-none">PIX Copia e Cola</p>
                               <div className="flex gap-2 items-center bg-white/10 p-4 rounded-2xl border border-white/20 max-w-sm">
                                  <p className="text-[10px] font-mono break-all line-clamp-2">{generatedPix.payload}</p>
                                  <button onClick={() => {
                                      navigator.clipboard.writeText(generatedPix.payload);
                                      toast({title: 'Copiado!'});
                                  }} className="bg-emerald-500 p-2 rounded-lg text-white">COPIAR</button>
                               </div>
                            </div>
                            <Button 
                               onClick={() => {
                                  setIsNewBookingOpen(false);
                                  setGeneratedPix(null);
                                  refreshData();
                               }}
                               className="w-full h-16 bg-white hover:bg-emerald-50 text-emerald-900 rounded-2xl font-black text-lg"
                            >
                               CONCLUÍDO - FECHAR ASSISTENTE
                            </Button>
                          </div>
                        ) : (
                          <div className="bg-emerald-900 p-10 rounded-[3rem] text-white space-y-8 shadow-2xl relative overflow-hidden">`;

if (!adminData.includes('generatedPix ?')) {
    adminData = adminData.replace(section5Start, successBlock);
    // Find the end of section 5 and add closing parenthesis
    const section5End = '                        </Button>\n                        </div>';
    adminData = adminData.replace(section5End, section5End + '\n                    )}');
}

fs.writeFileSync(adminPath, adminData);

// --- 2. Update BookingTable.tsx UI ---
const tablePath = 'src/components/admin/BookingTable.tsx';
let tableData = fs.readFileSync(tablePath, 'utf8');

if (!tableData.includes('CPF (Obrigatório P/ PIX)')) {
    const searchStr = '{onFileUpload && (';
    const insertStr = `                                                      {/* Campo de CPF para PIX */}
                                                      <div className="flex items-center gap-2 bg-emerald-50/50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:bg-emerald-50">
                                                         <div className="flex flex-col">
                                                            <label className="text-[7px] font-black uppercase text-emerald-600/60 tracking-widest leading-none mb-1">CPF (Obrigatório P/ PIX)</label>
                                                            <div className="flex items-center gap-1.5">
                                                               <span className="text-[10px] text-emerald-300 font-bold">CPF</span>
                                                               <input 
                                                                  value={booking.cpf || booking.customer_cpf || ''}
                                                                  placeholder="Digitar CPF..."
                                                                  onChange={(e) => onAddNote(booking.id, e.target.value.replace(/\\D/g, ''), !!booking.is_order, 'cpf')}
                                                                  className="bg-transparent border-none focus:ring-0 text-[10px] font-black text-emerald-950 placeholder:text-emerald-300 w-28 p-0 h-4"
                                                               />
                                                            </div>
                                                         </div>
                                                      </div>\n\n                                                      `;
    tableData = tableData.replace(searchStr, insertStr + searchStr);
}

fs.writeFileSync(tablePath, tableData);
console.log("Successfully refined Admin and BookingTable UI.");
