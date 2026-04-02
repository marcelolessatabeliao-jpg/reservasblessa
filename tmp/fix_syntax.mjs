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

console.log('\n--- Patching Syntax Error ---');
const tablePatches = {
  247: {
    find: `                                       }}`,
    replace: ``
  }
};

await patchFile('src/components/admin/BookingTable.tsx', tablePatches);
console.log('\nAll done!');
