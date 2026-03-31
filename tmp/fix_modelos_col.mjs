import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = readFileSync(filePath, 'utf8');

// FIX: Remove Qtd from Modelos column and use normalizeQuadType in Select value
// The Modelos column currently has both a Select AND a Qtd input inside a flex-col div
// We want to replace that entire block with just the Select (no Qtd)

// The pattern is the <div className="flex flex-col gap-1 w-32"> containing Select + Qtd
const oldModelosEditing = `                                   {isEditing ? (
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
                                  ) : (`;

const newModelosEditing = `                                   {isEditing ? (
                                    <Select value={normalizeQuadType(editData.quad_type || 'individual')} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                       <SelectTrigger className="h-7 text-[10px] font-bold bg-white w-36"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                  ) : (`;

// Normalize line endings for comparison
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = oldModelosEditing.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOld)) {
  const fixed = normalizedContent.replace(normalizedOld, newModelosEditing);
  // Restore CRLF line endings
  writeFileSync(filePath, fixed.replace(/\r\n/g, '\n'), 'utf8');
  console.log('✓ Fixed Modelos column: removed Qtd, added normalizeQuadType');
} else {
  console.log('⚠ Pattern not found. Checking content...');
  const idx = normalizedContent.indexOf('flex flex-col gap-1 w-32');
  if (idx > 0) {
    console.log('Found flex-col at', idx);
    console.log('Context:', JSON.stringify(normalizedContent.substring(idx - 50, idx + 400)));
  } else {
    console.log('NOT FOUND: "flex flex-col gap-1 w-32"');
    // Check if already fixed
    if (normalizedContent.includes('normalizeQuadType(editData.quad_type')) {
      console.log('✓ Already fixed! normalizeQuadType is already in use');
    }
  }
}

console.log('Done!');
