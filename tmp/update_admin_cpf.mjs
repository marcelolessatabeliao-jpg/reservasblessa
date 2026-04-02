const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let data = fs.readFileSync(path, 'utf8');

// 1. Add cpf: '' to newBookingData state
const statePattern = /newBookingData,\s*setNewBookingData\]\s*=\s*useState<any>\({\s*name:\s*'',\s*phone:\s*'',/;
const stateReplace = `newBookingData, setNewBookingData] = useState<any>({
    name: '',
    phone: '',
    cpf: '',`;

if (data.includes("name: '',\r\n    phone: '',")) {
    data = data.replace("name: '',\r\n    phone: '',", "name: '',\r\n    phone: '',\r\n    cpf: '',");
} else if (data.includes("name: '',\n    phone: '',")) {
    data = data.replace("name: '',\n    phone: '',", "name: '',\n    phone: '',\n    cpf: '',");
}

// 2. Update UI: change grid-cols-3 to 4 and add CPF input
const uiPattern = /<div className="grid grid-cols-1 md:grid-cols-3 gap-6">[\s\S]*?<div className="space-y-2">[\s\S]*?<label[\s\S]*?Nome do Cliente[\s\S]*?<\/label>[\s\S]*?<Input[\s\S]*?\/>[\s\S]*?<\/div>[\s\S]*?<div className="space-y-2">[\s\S]*?<label[\s\S]*?Telefone[\s\S]*?<\/label>[\s\S]*?<Input[\s\S]*?\/>[\s\S]*?<\/div>/;

const oldUi = `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> Nome do Cliente
                             </label>
                             <Input 
                               value={newBookingData.name} 
                               onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="Nome Completo"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" /> Telefone
                             </label>
                             <Input 
                               value={newBookingData.phone} 
                               onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="DDD + Número"
                             />
                           </div>`;

const newUi = `<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> Nome do Cliente
                             </label>
                             <Input 
                               value={newBookingData.name} 
                               onChange={e => setNewBookingData({...newBookingData, name: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="Nome Completo"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5" /> CPF (Obrigatório)
                             </label>
                             <Input 
                               value={newBookingData.cpf} 
                               onChange={e => setNewBookingData({...newBookingData, cpf: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="000.000.000-00"
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5" /> Telefone
                             </label>
                             <Input 
                               value={newBookingData.phone} 
                               onChange={e => setNewBookingData({...newBookingData, phone: e.target.value})}
                               className="h-14 rounded-2xl border-2 border-emerald-100 focus:ring-4 focus:ring-emerald-500/10 font-bold bg-white text-emerald-950"
                               placeholder="DDD + Número"
                             />
                           </div>`;

// Simple string replacement for UI (more fragile but easier to debug)
if (data.includes(oldUi.replace(/\n/g, '\r\n'))) {
    data = data.replace(oldUi.replace(/\n/g, '\r\n'), newUi.replace(/\n/g, '\r\n'));
} else if (data.includes(oldUi)) {
    data = data.replace(oldUi, newUi);
}

// 3. Update handleGeneratePayment (logic)
const oldPayment = `          phone: item.customer_phone || item.phone || '',
          cpf: item.cpf || '000.000.000-00',`;
const newPayment = `          phone: item.customer_phone || item.phone || '',
          cpf: (item.cpf || item.customer_cpf || '').replace(/\\D/g, ''),`;

if (data.includes(oldPayment.replace(/\n/g, '\r\n'))) {
    data = data.replace(oldPayment.replace(/\n/g, '\r\n'), newPayment.replace(/\n/g, '\r\n'));
} else if (data.includes(oldPayment)) {
    data = data.replace(oldPayment, newPayment);
}

// 4. Also update the header label
data = data.replace("Lógica Integrada • Sem CPF", "Lógica Integrada • CPF Habilitado");

fs.writeFileSync(path, data);
console.log("Successfully updated Admin.tsx via Node script.");
