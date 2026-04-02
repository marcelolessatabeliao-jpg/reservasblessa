import { createReadStream, createWriteStream, renameSync } from 'fs';

function patchFile(srcPath, patchMap) {
  return new Promise((resolve, reject) => {
    const dstPath = srcPath.replace('.tsx', '_new.tsx');
    const inStream = createReadStream(srcPath, { encoding: 'utf8', highWaterMark: 1024 });
    const outStream = createWriteStream(dstPath, { encoding: 'utf8' });
    let lineNum = 0;
    let buffer = '';

    inStream.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (let line of lines) {
        lineNum++;
        if (patchMap[lineNum]) {
          const { find, replace } = patchMap[lineNum];
          if (line.includes(find)) {
            line = line.replace(find, replace);
            console.log(`  Fixed line ${lineNum}`);
          } else {
            console.log(`  WARN line ${lineNum}: text not found`);
          }
        }
        outStream.write(line + '\n');
      }
    });

    inStream.on('end', () => {
      if (buffer) {
        lineNum++;
        let line = buffer;
        if (patchMap[lineNum]) {
          const { find, replace } = patchMap[lineNum];
          if (line.includes(find)) line = line.replace(find, replace);
        }
        outStream.write(line);
      }
      outStream.end(() => {
        renameSync(dstPath, srcPath);
        console.log(`  Done. Lines: ${lineNum}`);
        resolve();
      });
    });

    inStream.on('error', reject);
    outStream.on('error', reject);
  });
}

// ============================================================
// FIX 1: BookingTable.tsx
// ============================================================
console.log('\n--- Patching BookingTable.tsx ---');
const tablePatches = {
  // Remove botao Voucher duplicado (linha 247, opcao compacta)
  247: {
    find: `}} className="bg-blue-600 border border-blue-700 text-white hover:bg-blue-700 h-10 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5"><FileCheck className="w-4 h-4" />Voucher</Button>`,
    replace: `}}`
  },
  // Adicionar Gerar PIX na secao expandida (linha 521 - antes dos botoes de acao)
  521: {
    find: `<div className="grid grid-cols-2 sm:grid-cols-6 gap-3">`,
    replace: `<div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                                                  {onGeneratePayment && !['paid', 'pago', 'checked-in', 'cancelled', 'cancelado'].includes(booking.status?.toLowerCase() || '') && (
                                                    <Button onClick={(e) => { e.stopPropagation(); onGeneratePayment(booking.id, !!booking.is_order); }} className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-bold uppercase text-[9px] h-12 rounded-xl px-2 flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95 shadow-sm">
                                                      <QrCode className="w-4 h-4" />
                                                      <span>GERAR PIX</span>
                                                    </Button>
                                                  )}`
  }
};

await patchFile('src/components/admin/BookingTable.tsx', tablePatches);

console.log('\nAll done!');
