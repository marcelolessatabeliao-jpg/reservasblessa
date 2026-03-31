import fs from 'fs';

let adminTxt = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Fix the duplicate dropdown options
const oldDropdownCode = `{Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}`;

const newDropdownCode = `<SelectItem value="individual" className="text-[10px]">Individual</SelectItem>
                                            <SelectItem value="dupla" className="text-[10px]">Dupla</SelectItem>
                                            <SelectItem value="adulto-crianca" className="text-[10px]">Adulto + Criança</SelectItem>`;

adminTxt = adminTxt.replace(oldDropdownCode, newDropdownCode);

// 2. Fix the quantity field to be editable
const oldQuantityCode = `<td className="px-6 py-2 text-center">
                                  <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                </td>`;

const newQuantityCode = `<td className="px-6 py-2 text-center">
                                  {isEditing ? (
                                    <Input 
                                      type="number" 
                                      value={editData.quantity !== undefined ? editData.quantity : (r.quantity || 1)} 
                                      onChange={e => setEditData({...editData, quantity: Number(e.target.value)})}
                                      className="w-16 h-7 text-[11px] font-black mx-auto text-center"
                                      min={1}
                                    />
                                  ) : (
                                    <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                  )}
                                </td>`;

// Let's replace safely using regex if exact match fails
if (adminTxt.includes(oldQuantityCode)) {
    adminTxt = adminTxt.replace(oldQuantityCode, newQuantityCode);
} else {
    // try loosely matching
    const looseRegex = /<td className="px-6 py-2 text-center">\s*<span className="text-\[11px\] font-black text-blue-900 bg-blue-100\/50 px-2 rounded-full border border-blue-200">\{r\.quantity \|\| 1\}x<\/span>\s*<\/td>/m;
    adminTxt = adminTxt.replace(looseRegex, newQuantityCode);
}

fs.writeFileSync('src/pages/Admin.tsx', adminTxt, 'utf8');
console.log('Fixed ATV Quad Quantity and Dropdown UI');
