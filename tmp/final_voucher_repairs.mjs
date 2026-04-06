import fs from 'fs';

// 1. UPDATE ADMIN.TSX
const adminPath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let adminContent = fs.readFileSync(adminPath, 'utf8');

if (!adminContent.includes('const [time, setTime] = useState')) {
    adminContent = adminContent.replace(
        'const [model, setModel] = useState(item.quad_type || \'individual\');',
        'const [model, setModel] = useState(item.quad_type || \'individual\');\n  const [time, setTime] = useState(item.time_slot || \'09:00\');'
    );
}

const oldSelect = `<Select value={model} onValueChange={setModel}>
                 <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="bg-white rounded-2xl shadow-xl">
                   {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => (
                     <SelectItem key={k} value={k} className="font-black uppercase text-xs py-3">{v}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>`;

const newSelects = `<Select value={model} onValueChange={setModel}>
                 <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="bg-white rounded-2xl shadow-xl">
                   {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => (
                     <SelectItem key={k} value={k} className="font-black uppercase text-xs py-3">{v}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
            </div>
            <div className="space-y-1.5">
               <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">Horário</Label>
               <Select value={time} onValueChange={setTime}>
                 <SelectTrigger className="rounded-xl border-slate-200 h-12 font-black uppercase text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="bg-white rounded-2xl shadow-xl">
                   {["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"].map(t => (
                     <SelectItem key={t} value={t} className="font-black uppercase text-xs py-3">{t}h</SelectItem>
                   ))}
                 </SelectContent>
               </Select>`;

// Careful with exact matching of the block
if (adminContent.includes(oldSelect)) {
    adminContent = adminContent.replace(oldSelect, newSelects);
}

fs.writeFileSync(adminPath, adminContent);

// 2. UPDATE VOUCHER.TSX
const voucherPath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Voucher.tsx';
let voucherContent = fs.readFileSync(voucherPath, 'utf8');

const itemDisplayLine = '{item.quantity}x {item.product_id}';
const itemWithTime = `{item.quantity}x {item.product_id}
                                {((item.product_id || '').toLowerCase().includes('quad')) && (
                                  <span className="ml-1 text-primary font-black lowercase text-[10px] bg-sun/10 px-1.5 py-0.5 rounded-md border border-sun/20">
                                    {item.metadata?.time_slot || ''}
                                  </span>
                                )}`;

if (voucherContent.includes(itemDisplayLine) && !voucherContent.includes('item.metadata?.time_slot')) {
    voucherContent = voucherContent.replace(itemDisplayLine, itemWithTime);
}

fs.writeFileSync(voucherPath, voucherContent);

console.log('Successfully updated Admin.tsx and Voucher.tsx');
