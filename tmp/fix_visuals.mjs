// Script para Admin.tsx: Integrar as reservas manuais (bookings) ao mapa visual do dashboard (Quiosques / Quadriciclos)

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

console.log('\n--- Patching Admin.tsx (Visual Dashboard items sync) ---');
const adminPatches = {
  807: {
    find: `const dayBookings = bookings.filter(b => b.visit_date === format(targetDate, 'yyyy-MM-dd'));`,
    replace: `const dayBookings = bookings.filter(b => b.visit_date === format(targetDate, 'yyyy-MM-dd'));
    
    // Add manual bookings representing kiosks to dayKiosks to show in visual map
    dayBookings.forEach(b => {
      const bItems = b.order_items || [];
      const hasKiosk = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quiosque'));
      if (hasKiosk && !dayKiosks.some(dk => dk.id === b.id)) {
        dayKiosks.push({
           id: b.id,
           kiosk_id: b.kiosk_id || 'MAIOR',
           customer_name: b.name || 'Cliente (Interno)',
           reservation_date: b.visit_date,
           status: b.status
        });
      }
      
      const hasQuad = bItems.some((i) => (i.product_name || '').toLowerCase().includes('quadri'));
      if (hasQuad && !dayQuads.some(dq => dq.id === b.id)) {
        bItems.filter(i => (i.product_name || '').toLowerCase().includes('quadri')).forEach(qi => {
           dayQuads.push({
              id: b.id + '-' + Math.random().toString(36).substr(2, 5),
              customer_name: b.name || 'Cliente (Interno)',
              reservation_date: b.visit_date,
              time_slot: b.quad_time_slot || '10:30',
              quantity: qi.quantity || 1,
              status: b.status
           });
        });
      }
    });`
  }
};

await patchFile('src/pages/Admin.tsx', adminPatches);
console.log('\nAll done!');
