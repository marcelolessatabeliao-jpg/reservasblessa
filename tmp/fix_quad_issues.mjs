import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = readFileSync(filePath, 'utf8');

// ─── FIX 1: Remove duplicate UPPERCASE keys from QUAD_MODELS_LABELS & add normalizeQuadType ───
const oldModelsBlock = `const QUAD_MODELS_LABELS: Record<string, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança',
  'INDIV': 'Individual',
  'DUPLA': 'Dupla'
};`;

const newModelsBlock = `const QUAD_MODELS_LABELS: Record<string, string> = {
  individual: 'Individual',
  dupla: 'Dupla',
  'adulto-crianca': 'Adulto + Criança',
};

// Normaliza quad_type para lowercase (banco pode armazenar INDIV/DUPLA em maiúsculo)
const normalizeQuadType = (qt: string): string => {
  if (!qt) return 'individual';
  const map: Record<string, string> = { 'INDIV': 'individual', 'DUPLA': 'dupla', 'ADULTO-CRIANCA': 'adulto-crianca' };
  return map[qt.toUpperCase()] ?? qt.toLowerCase();
};`;

if (content.includes("'INDIV': 'Individual'")) {
  content = content.replace(oldModelsBlock, newModelsBlock);
  console.log('✓ FIX 1: Removed duplicate model keys, added normalizeQuadType');
} else {
  console.log('⚠ FIX 1: Already applied or not found');
}

// ─── FIX 2: Fix saveEditing to normalize quad_type and use await fetchData ───
const oldSaveEditing = `      toast({ title: "✔ Alterações salvas" });
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: \`Erro ao salvar: \${err.message || err.details || 'Erro desconhecido'}\`, variant: "destructive" });
    }
  };`;

const newSaveEditing = `      toast({ title: "✔ Alterações salvas" });
      setEditingId(null);
      setEditData({});
      await fetchData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ title: \`Erro ao salvar: \${err.message || err.details || 'Erro desconhecido'}\`, variant: "destructive" });
    }
  };`;

if (content.includes(`toast({ title: "✔ Alterações salvas" });
      setEditingId(null);
      fetchData();`)) {
  content = content.replace(oldSaveEditing, newSaveEditing);
  console.log('✓ FIX 2: saveEditing now awaits fetchData');
} else {
  console.log('⚠ FIX 2: Pattern not found, checking alternative...');
  // Try with encoded checkmark
  const alt = content.includes('Alterações salvas');
  console.log('  "Alterações salvas" found:', alt);
}

// ─── FIX 3: Replace Modelos column to remove Qtd from it, use normalizeQuadType ───
const oldModelosCol = `                                  {isEditing ? (
                                    <div className="flex flex-col gap-1 w-32">
                                      <Select value={editData.quad_type || 'individual'} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                         <SelectTrigger className="h-7 text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                            {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-bold text-blue-800">Qtd:</span>
                                        <input type="number" min="1" max="20" className="w-16 h-7 text-[11px] font-black border border-blue-200 rounded px-2" value={editData.quantity || 1} onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})} />
                                      </div>

                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] border-blue-100 text-blue-700 bg-white/50 font-black tracking-widest px-2">
                                      {QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual'}
                                    </Badge>
                                  )}`;

const newModelosCol = `                                  {isEditing ? (
                                    <Select value={normalizeQuadType(editData.quad_type || 'individual')} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                       <SelectTrigger className="h-7 text-[10px] font-bold bg-white w-36"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] border-blue-100 text-blue-700 bg-white/50 font-black tracking-widest px-2">
                                      {QUAD_MODELS_LABELS[normalizeQuadType(r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual'))] || 'Individual'}
                                    </Badge>
                                  )}`;

if (content.includes('Qtd:</span>')) {
  content = content.replace(oldModelosCol, newModelosCol);
  console.log('✓ FIX 3: Modelos column cleaned up, Qtd removed from it');
} else {
  console.log('⚠ FIX 3: Qtd pattern not found in Modelos column');
}

// ─── FIX 4: Add Qtd input to Total Quadriciclos column ───
const oldQtdCell = `                                <td className="px-6 py-2 text-center">
                                  <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                </td>`;

const newQtdCell = `                                <td className="px-6 py-2 text-center">
                                  {isEditing ? (
                                    <input
                                      type="number" min="1" max="20"
                                      className="w-16 h-8 text-[12px] font-black border-2 border-blue-300 rounded-lg px-2 text-center bg-white shadow-sm"
                                      value={editData.quantity ?? r.quantity ?? 1}
                                      onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})}
                                    />
                                  ) : (
                                    <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                  )}
                                </td>`;

if (content.includes(oldQtdCell)) {
  content = content.replace(oldQtdCell, newQtdCell);
  console.log('✓ FIX 4: Qtd input added to Total Quadriciclos column');
} else {
  console.log('⚠ FIX 4: Old Qtd cell pattern not found');
}

writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Done! Saved to', filePath);
