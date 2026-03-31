import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/pages/Admin.tsx';
let content = readFileSync(filePath, 'utf8');

// Check byte sequence for the checkmark
const idx = content.indexOf('Altera');
console.log('Snippet around "Altera":', JSON.stringify(content.substring(idx - 30, idx + 60)));

// Fix saveEditing: add setEditData({}) and await fetchData
// The file may have the corrupted checkmark "âœ"" or the real one "✔"
// We replace the block around fetchData() after the toast
const beforeFix = content;

// Pattern 1: real checkmark
content = content.replace(
  /toast\(\{ title: "✔ Alterações salvas" \}\);\r?\n\s+setEditingId\(null\);\r?\n\s+fetchData\(\);/,
  `toast({ title: "✔ Alterações salvas" });\n      setEditingId(null);\n      setEditData({});\n      await fetchData();`
);

// Pattern 2: corrupted checkmark  
content = content.replace(
  /toast\(\{ title: "â.{1,3} Altera[çc][oõ]es salvas" \}\);\r?\n\s+setEditingId\(null\);\r?\n\s+fetchData\(\);/,
  `toast({ title: "✔ Alterações salvas" });\n      setEditingId(null);\n      setEditData({});\n      await fetchData();`
);

if (content !== beforeFix) {
  console.log('✓ FIX 2: saveEditing now uses await fetchData + clears editData');
} else {
  console.log('⚠ FIX 2: No match found, trying raw line approach...');
  // Find lines 341-344 and replace directly
  const lines = content.split('\n');
  for (let i = 340; i < 350; i++) {
    console.log(`Line ${i+1}: ${JSON.stringify(lines[i])}`);
  }
}

// Fix Total Quadriciclos column: add editing input
const oldQtd = `                                <td className="px-6 py-2 text-center">\r\n                                  <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>\r\n                                </td>`;
const newQtd = `                                <td className="px-6 py-2 text-center">\r\n                                  {isEditing ? (\r\n                                    <input\r\n                                      type="number" min="1" max="20"\r\n                                      className="w-16 h-8 text-[12px] font-black border-2 border-blue-300 rounded-lg px-2 text-center bg-white shadow-sm"\r\n                                      value={editData.quantity ?? r.quantity ?? 1}\r\n                                      onChange={e => setEditData({...editData, quantity: parseInt(e.target.value) || 1})}\r\n                                    />\r\n                                  ) : (\r\n                                    <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>\r\n                                  )}\r\n                                </td>`;

if (content.includes(oldQtd)) {
  content = content.replace(oldQtd, newQtd);
  console.log('✓ FIX 4: Qtd input added to Total Quadriciclos column');
} else {
  console.log('⚠ FIX 4: CRLF pattern not found, trying LF...');
  const oldQtdLF = oldQtd.replace(/\r\n/g, '\n');
  if (content.includes(oldQtdLF)) {
    content = content.replace(oldQtdLF, newQtd.replace(/\r\n/g, '\n'));
    console.log('✓ FIX 4 (LF): Qtd input added to Total Quadriciclos column');
  } else {
    // Show the actual content around qtd
    const qtdIdx = content.indexOf('r.quantity || 1}x</span>');
    if (qtdIdx > 0) {
      console.log('Found qty span at', qtdIdx);
      console.log('Context:', JSON.stringify(content.substring(qtdIdx - 200, qtdIdx + 100)));
    }
  }
}

writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Done!');
